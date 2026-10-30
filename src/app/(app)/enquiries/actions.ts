"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { STATUS_LABEL, isSource, isStatus } from "@/lib/enquiries";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE = /^[0-9+\-\s()]{7,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MISSING = "The enquiry tables are missing. Run supabase/023_enquiries_and_categories.sql in the Supabase SQL Editor first.";
const explain = (m: string) => (/enquir|schema cache|does not exist/i.test(m) ? MISSING : m);

type Me = Awaited<ReturnType<typeof requireRole>>;
const who = (me: Me) => me.fullName || me.email;

async function logNote(supabase: Awaited<ReturnType<typeof createClient>>, enquiryId: string, me: Me, body: string) {
  await supabase.from("enquiry_notes").insert({ enquiry_id: enquiryId, body: body.slice(0, 500), created_by: me.id, created_by_name: who(me) });
}

export async function addEnquiry(formData: FormData) {
  const me = await requireRole(["admin"]);
  const t = (k: string) => String(formData.get(k) ?? "").trim();
  const fail = (m: string): never => redirect(`/enquiries?error=${encodeURIComponent(m)}`);

  const child = t("child_name");
  const phone = t("phone");
  const email = t("email");
  const source = t("source");
  const followUp = t("follow_up_date");
  const note = t("note");
  if (!child) fail("Enter the child's name.");
  if (child.length > 100) fail("The child's name is too long.");
  if (!PHONE.test(phone)) fail("Enter a phone number that parents can be called on.");
  if (email && !EMAIL.test(email)) fail("The email address does not look right.");
  if (!isSource(source)) fail("Choose how the parent reached the school.");
  if (followUp && (!DATE.test(followUp) || followUp < todayISO())) fail("The follow-up date must be today or later.");
  if (note.length > 500) fail("The note can be at most 500 characters.");

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("enquiries")
    .insert({
      child_name: child,
      class_applied: t("class_applied") || null,
      guardian_name: t("guardian_name") || null,
      phone,
      email: email || null,
      source,
      follow_up_date: followUp || null,
      created_by: me.id,
      created_by_name: who(me),
    })
    .select("id")
    .single();
  if (error || !row) return fail(explain(error?.message ?? "The enquiry could not be saved."));
  if (note) await logNote(supabase, row.id, me, note);
  revalidatePath("/enquiries");
  redirect(`/enquiries/${row.id}?added=1`);
}

/** Changes the status and/or follow-up date of an enquiry. Every status change is written into its history. */
export async function updateEnquiry(formData: FormData) {
  const me = await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return redirect("/enquiries");
  const back = (qs: string): never => redirect(`/enquiries/${id}?${qs}`);
  const status = String(formData.get("status") ?? "");
  const followUp = String(formData.get("follow_up_date") ?? "").trim();
  if (!isStatus(status)) return back(`error=${encodeURIComponent("Choose a status.")}`);
  if (followUp && !DATE.test(followUp)) return back(`error=${encodeURIComponent("The follow-up date is not valid.")}`);

  const supabase = await createClient();
  const { data: before } = await supabase.from("enquiries").select("status, follow_up_date").eq("id", id).maybeSingle();
  if (!before) return back(`error=${encodeURIComponent("That enquiry could not be found.")}`);

  const { error } = await supabase
    .from("enquiries")
    .update({ status, follow_up_date: followUp || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return back(`error=${encodeURIComponent(explain(error.message))}`);

  if (before.status !== status) await logNote(supabase, id, me, `Status changed from ${STATUS_LABEL[before.status as keyof typeof STATUS_LABEL] ?? before.status} to ${STATUS_LABEL[status]}.`);
  if ((before.follow_up_date ?? "") !== followUp) await logNote(supabase, id, me, followUp ? `Follow-up set for ${followUp}.` : "Follow-up date cleared.");
  revalidatePath("/enquiries");
  revalidatePath(`/enquiries/${id}`);
  return back("saved=1");
}

export async function addNote(formData: FormData) {
  const me = await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!UUID.test(id)) return redirect("/enquiries");
  if (!body) return redirect(`/enquiries/${id}?error=${encodeURIComponent("Write the note first.")}`);
  if (body.length > 500) return redirect(`/enquiries/${id}?error=${encodeURIComponent("A note can be at most 500 characters.")}`);
  const supabase = await createClient();
  await logNote(supabase, id, me, body);
  await supabase.from("enquiries").update({ updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath(`/enquiries/${id}`);
  return redirect(`/enquiries/${id}`);
}

export async function deleteEnquiry(formData: FormData) {
  await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  await supabase.from("enquiries").delete().eq("id", id);
  revalidatePath("/enquiries");
  redirect("/enquiries?deleted=1");
}
