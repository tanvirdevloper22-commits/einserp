"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { DETAILS_MAX, TITLE_MAX, addDays, isKind } from "@/lib/calendar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MISSING = "The calendar table is missing. Run supabase/024_calendar.sql in the Supabase SQL Editor first.";

function refresh() {
  revalidatePath("/calendar");
  revalidatePath("/attendance");
  revalidatePath("/portal");
}

export async function addEvent(formData: FormData) {
  const me = await requireRole(["admin"]);
  const t = (k: string) => String(formData.get(k) ?? "").trim();
  const month = /^\d{4}-\d{2}$/.test(t("month")) ? t("month") : "";
  const go = (qs: string): never => redirect(`/calendar?${month ? `month=${month}&` : ""}${qs}`);
  const fail = (m: string): never => go(`error=${encodeURIComponent(m)}`);

  const title = t("title");
  const kind = t("kind");
  const start = t("start_date");
  const end = t("end_date") || start;
  const details = t("details");
  if (!title) fail("Enter a title.");
  if (title.length > TITLE_MAX) fail(`The title can be at most ${TITLE_MAX} characters.`);
  if (!isKind(kind)) fail("Choose what kind of entry this is.");
  if (!DATE.test(start) || !DATE.test(end)) fail("Choose the date.");
  if (end < start) fail("The last day cannot be before the first day.");
  if (end > addDays(start, 60)) fail("An entry can last at most about two months. Split it into two.");
  if (details.length > DETAILS_MAX) fail(`The details can be at most ${DETAILS_MAX} characters.`);

  const supabase = await createClient();
  const { error } = await supabase.from("calendar_events").insert({
    title, kind, start_date: start, end_date: end, details: details || null, created_by: me.id, created_by_name: me.fullName || me.email,
  });
  if (error) fail(/calendar_events|schema cache|does not exist/i.test(error.message) ? MISSING : error.message);
  refresh();
  return go(`added=1`);
}

export async function deleteEvent(formData: FormData) {
  await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  const month = String(formData.get("month") ?? "");
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  await supabase.from("calendar_events").delete().eq("id", id);
  refresh();
  redirect(`/calendar?${/^\d{4}-\d{2}$/.test(month) ? `month=${month}&` : ""}deleted=1`);
}
