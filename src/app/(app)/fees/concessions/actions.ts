"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { KIND_LABEL, LATE_FINE_PREFIX, MODE_LABEL } from "@/lib/concessions";
import { lateFineCandidates } from "@/lib/late-fines";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

const go = (key: string, value: string): never => redirect(`/fees/concessions?${key}=${encodeURIComponent(value)}`);

function explain(message: string): string {
  return /fee_concessions|late_fine|schema cache|does not exist/i.test(message)
    ? "The concessions tables are missing. Run supabase/016_fee_concessions.sql in the Supabase SQL Editor first."
    : message;
}

export async function addConcession(formData: FormData) {
  const me = await requireRole(["admin"]);
  const admissionNo = String(formData.get("admission_no") ?? "").trim();
  const kind = String(formData.get("kind") ?? "");
  const mode = String(formData.get("mode") ?? "");
  const rawValue = String(formData.get("value") ?? "").trim();
  const appliesTo = String(formData.get("applies_to") ?? "").trim().slice(0, 60);
  const note = String(formData.get("note") ?? "").trim().slice(0, 200);
  const fail = (message: string): never =>
    redirect(`/fees/concessions?error=${encodeURIComponent(message)}&adm=${encodeURIComponent(admissionNo)}&kind=${encodeURIComponent(kind)}`);

  if (!admissionNo) return fail("Enter the student's admission number.");
  if (!(kind in KIND_LABEL)) return fail("Choose the type of concession.");
  if (!(mode in MODE_LABEL)) return fail("Choose how the concession is given.");

  let value = 0;
  if (mode !== "full") {
    if (!/^\d{1,8}(\.\d{1,2})?$/.test(rawValue)) return fail("Enter the percentage or amount as a number.");
    value = Number(rawValue);
    if (mode === "percent" && (value < 1 || value > 100)) return fail("A percentage must be between 1 and 100.");
    if (mode === "fixed" && value <= 0) return fail("The amount must be more than zero.");
  }

  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("id, full_name, status")
    .eq("admission_no", admissionNo)
    .maybeSingle();
  if (!student) return fail(`No student has the admission number "${admissionNo}".`);

  const { error } = await supabase.from("fee_concessions").insert({
    student_id: student.id,
    kind,
    mode,
    value,
    applies_to: appliesTo || null,
    note: note || null,
    created_by: me.id,
  });
  if (error) return fail(explain(error.message));

  revalidatePath("/fees/concessions");
  return go("added", String(student.full_name));
}

export async function setConcessionActive(formData: FormData) {
  await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;
  const active = formData.get("active") === "true";
  const supabase = await createClient();
  await supabase.from("fee_concessions").update({ active }).eq("id", id);
  revalidatePath("/fees/concessions");
}

export async function deleteConcession(formData: FormData) {
  await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  await supabase.from("fee_concessions").delete().eq("id", id);
  revalidatePath("/fees/concessions");
}

export async function saveLateFine(formData: FormData) {
  await requireRole(["admin"]);
  const rawAmount = String(formData.get("late_fine_amount") ?? "").trim() || "0";
  const rawGrace = String(formData.get("late_fine_grace_days") ?? "").trim() || "0";
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(rawAmount)) return go("error", "Enter the late fine as an amount, like 100 or 50.50.");
  const grace = Number(rawGrace);
  if (!Number.isInteger(grace) || grace < 0 || grace > 365) return go("error", "Grace days must be a whole number from 0 to 365.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("school_settings")
    .upsert({ id: 1, late_fine_amount: Number(rawAmount), late_fine_grace_days: grace, updated_at: new Date().toISOString() });
  if (error) return go("error", explain(error.message));
  revalidatePath("/fees/concessions");
  return go("fine_saved", "1");
}

/** Adds one late-fine fee for every unpaid fee that is past its due date plus the grace days and has not been fined yet. */
export async function applyLateFines() {
  await requireRole(["admin", "accountant"]);
  const supabase = await createClient();
  const { data: settings, error: settingsError } = await supabase
    .from("school_settings")
    .select("late_fine_amount, late_fine_grace_days")
    .eq("id", 1)
    .maybeSingle();
  if (settingsError) return go("error", explain(settingsError.message));
  const amount = Number(settings?.late_fine_amount ?? 0);
  const grace = Number(settings?.late_fine_grace_days ?? 0);
  if (!(amount > 0)) return go("error", "Set a late fine amount first.");

  const today = todayISO();
  const { candidates, error } = await lateFineCandidates(supabase, grace, today);
  if (error) return go("error", explain(error));
  if (!candidates.length) return go("fined", "0");

  const rows = candidates.map((c) => ({
    student_id: c.student_id,
    title: `${LATE_FINE_PREFIX}${c.title}`,
    amount,
    due_date: today,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error: insertError } = await supabase.from("fees").insert(rows.slice(i, i + 500));
    if (insertError) return go("error", `Some fines could not be saved: ${insertError.message}`);
  }

  revalidatePath("/fees");
  revalidatePath("/fees/defaulters");
  revalidatePath("/fees/concessions");
  return go("fined", `${rows.length}|${inr(rows.length * amount)}`);
}
