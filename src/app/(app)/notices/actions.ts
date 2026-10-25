"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { postableAudiences, TITLE_MAX, BODY_MAX, type Audience } from "@/lib/notices";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const fail = (message: string): never => redirect(`/notices?error=${encodeURIComponent(message)}`);

function refresh() {
  revalidatePath("/notices");
  revalidatePath("/");
  revalidatePath("/portal");
}

export async function createNotice(formData: FormData) {
  const me = await requireRole(["admin", "teacher"]);
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const audience = String(formData.get("audience") ?? "") as Audience;
  const classId = String(formData.get("class_id") ?? "");
  const expiresOn = String(formData.get("expires_on") ?? "");
  const pinned = me.role === "admin" && formData.get("pinned") === "on";

  if (!title) fail("Enter a title for the notice.");
  if (title.length > TITLE_MAX) fail(`The title can be at most ${TITLE_MAX} characters.`);
  if (!body) fail("Write the notice text.");
  if (body.length > BODY_MAX) fail(`The notice can be at most ${BODY_MAX} characters.`);
  if (!postableAudiences(me.role).includes(audience)) fail("You cannot post a notice to that audience.");
  if (audience === "class" && !UUID.test(classId)) fail("Choose the class this notice is for.");
  if (expiresOn && (!DATE.test(expiresOn) || expiresOn < todayISO())) fail("The expiry date must be today or later.");

  const supabase = await createClient();
  const { error } = await supabase.from("notices").insert({
    title,
    body,
    audience,
    class_id: audience === "class" ? classId : null,
    pinned,
    expires_on: expiresOn || null,
    created_by: me.id,
    created_by_name: me.fullName || me.email,
  });
  if (error) {
    fail(
      /relation .*notices.* does not exist|schema cache/i.test(error.message)
        ? "The notices table is missing. Run supabase/011_notices.sql in the Supabase SQL Editor first."
        : error.message,
    );
  }

  refresh();
  redirect("/notices?posted=1");
}

/** Admins can delete any notice; teachers only their own (the database enforces this too). */
export async function deleteNotice(formData: FormData) {
  await requireRole(["admin", "teacher"]);
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  await supabase.from("notices").delete().eq("id", id);
  refresh();
}

export async function togglePin(formData: FormData) {
  await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;
  const pinned = formData.get("pinned") === "true";
  const supabase = await createClient();
  await supabase.from("notices").update({ pinned: !pinned }).eq("id", id);
  refresh();
}
