"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { monthBounds } from "@/lib/staff-attendance";
import { fetchMonthCounts } from "@/lib/payroll-data";
import { PAYMENT_MODES, computePayslip, parseMoney, round2 } from "@/lib/payroll";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

const back = (month: string, key: string, value: string): never =>
  redirect(`/payroll?month=${month}&${key}=${encodeURIComponent(value)}`);

const missingTables = (message: string) =>
  /monthly_salary|payslips|staff_attendance|does not exist|schema cache/i.test(message)
    ? "The payroll tables are missing. Run supabase/012_staff.sql, 013_staff_attendance.sql and 014_payroll.sql in the Supabase SQL Editor first."
    : message;

/**
 * Creates or refreshes the draft payslips for a month from each active person's salary and the attendance marked that month.
 * Payslips already marked paid are left untouched, and amounts typed into a draft (allowances, deductions, note) are kept.
 */
export async function generatePayslips(formData: FormData) {
  await requireRole(["admin"]);
  const month = String(formData.get("month") ?? "");
  if (!MONTH.test(month)) redirect(`/payroll?error=${encodeURIComponent("Choose a valid month.")}`);
  const fail = (message: string): never => back(month, "error", message);

  if (month > todayISO().slice(0, 7)) return fail("You cannot generate payslips for a future month.");
  const allowed = Number(String(formData.get("paid_leave") ?? "0"));
  if (!Number.isInteger(allowed) || allowed < 0 || allowed > 31) return fail("Paid leave days must be a whole number from 0 to 31.");

  const supabase = await createClient();
  const { days } = monthBounds(month);

  const { data: people, error: peopleError } = await supabase
    .from("staff")
    .select("id, monthly_salary")
    .eq("status", "active")
    .gt("monthly_salary", 0);
  if (peopleError) return fail(missingTables(peopleError.message));
  const { count: activeCount } = await supabase.from("staff").select("id", { count: "exact", head: true }).eq("status", "active");

  const { data: existingRows, error: existingError } = await supabase
    .from("payslips")
    .select("staff_id, status, allowances, deductions, deduction_note")
    .eq("month", month);
  if (existingError) return fail(missingTables(existingError.message));
  const existing = new Map((existingRows ?? []).map((r) => [r.staff_id as string, r]));

  const att = await fetchMonthCounts(supabase, month);
  if (att.error) return fail(missingTables(att.error));

  const now = new Date().toISOString();
  const rows = [];
  for (const p of people ?? []) {
    const old = existing.get(p.id as string);
    if (old?.status === "paid") continue;
    const basic = Number(p.monthly_salary);
    const calc = computePayslip(basic, days, att.counts.get(p.id as string) ?? {}, allowed);
    const allowances = Number(old?.allowances ?? 0);
    const deductions = Number(old?.deductions ?? 0);
    rows.push({
      staff_id: p.id,
      month,
      basic,
      days_in_month: days,
      unpaid_days: calc.unpaid,
      paid_leave_allowed: allowed,
      payable_days: calc.payable,
      earned: calc.earned,
      allowances,
      deductions,
      deduction_note: old?.deduction_note ?? null,
      net: Math.max(0, round2(calc.earned + allowances - deductions)),
      status: "draft",
      updated_at: now,
    });
  }

  if (rows.length) {
    const { error } = await supabase.from("payslips").upsert(rows, { onConflict: "staff_id,month" });
    if (error) return fail(missingTables(error.message));
  }

  const skipped = Math.max(0, (activeCount ?? 0) - (people?.length ?? 0));
  revalidatePath("/payroll");
  redirect(`/payroll?month=${month}&generated=${rows.length}&skipped=${skipped}${att.total === 0 ? "&warn=1" : ""}`);
}

/** Saves a draft's allowances, deductions and note, and optionally marks it paid. */
async function applyEdit(formData: FormData, pay: boolean) {
  await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) redirect("/payroll");

  const supabase = await createClient();
  const { data: slip } = await supabase.from("payslips").select("id, month, earned, status").eq("id", id).maybeSingle();
  if (!slip) redirect("/payroll");
  const month = slip.month as string;
  const fail = (message: string): never => back(month, "error", message);

  if (slip.status === "paid") return fail("This payslip is already paid. Mark it unpaid first if you need to change it.");

  const allowances = parseMoney(String(formData.get("allowances") ?? ""));
  const deductions = parseMoney(String(formData.get("deductions") ?? ""));
  if (allowances === null || deductions === null) return fail("Enter allowances and deductions as plain amounts, like 500 or 1250.50.");
  const net = round2(Number(slip.earned) + allowances - deductions);
  if (net < 0) return fail("The deductions are more than the earnings plus allowances.");

  const mode = String(formData.get("payment_mode") ?? "cash");
  const update: Record<string, unknown> = {
    allowances,
    deductions,
    deduction_note: String(formData.get("deduction_note") ?? "").trim().slice(0, 200) || null,
    net,
    updated_at: new Date().toISOString(),
  };
  if (pay) {
    update.status = "paid";
    update.paid_on = todayISO();
    update.payment_mode = PAYMENT_MODES.some((m) => m.value === mode) ? mode : "cash";
  }

  const { error } = await supabase.from("payslips").update(update).eq("id", id);
  if (error) return fail(missingTables(error.message));

  revalidatePath("/payroll");
  redirect(`/payroll?month=${month}&${pay ? "paid" : "saved"}=1`);
}

export async function savePayslip(formData: FormData) {
  await applyEdit(formData, false);
}

export async function markPayslipPaid(formData: FormData) {
  await applyEdit(formData, true);
}

export async function markPayslipUnpaid(formData: FormData) {
  await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  const { data: slip } = await supabase
    .from("payslips")
    .update({ status: "draft", paid_on: null, payment_mode: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("month")
    .maybeSingle();
  revalidatePath("/payroll");
  if (slip) redirect(`/payroll?month=${slip.month}&unpaid=1`);
}
