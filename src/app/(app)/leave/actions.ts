"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { NOTE_MAX, REASON_MAX, checkDates, leaveDays } from "@/lib/leave";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MISSING = "The leave tables are missing. Run supabase/022_leave.sql in the Supabase SQL Editor first.";
const explain = (m: string) => (/leave_requests|my_staff_id|schema cache|does not exist/i.test(m) ? MISSING : m);

const go = (qs: string): never => redirect(`/leave?${qs}`);
const fail = (message: string): never => go(`error=${encodeURIComponent(message)}`);
const earliest = () => {
  const d = new Date(`${todayISO()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 14);
  return d.toISOString().slice(0, 10);
};

function readDates(formData: FormData) {
  const from = String(formData.get("from_date") ?? "");
  const to = String(formData.get("to_date") ?? "") || from;
  const reason = String(formData.get("reason") ?? "").trim();
  const bad = checkDates(from, to, todayISO(), earliest());
  if (bad) fail(bad);
  if (!reason) fail("Write the reason for the leave.");
  if (reason.length > REASON_MAX) fail(`The reason can be at most ${REASON_MAX} characters.`);
  return { from, to, reason };
}

/** A parent applies for leave for one of their own children. */
export async function applyStudentLeave(formData: FormData) {
  const me = await requireRole(["parent"]);
  const studentId = String(formData.get("student_id") ?? "");
  if (!UUID.test(studentId)) fail("Choose the child.");
  const { from, to, reason } = readDates(formData);

  const supabase = await createClient();
  // Only the parent's own children are visible to them, so this also confirms the child belongs to this parent.
  const { data: child } = await supabase.from("students").select("id").eq("id", studentId).maybeSingle();
  if (!child) fail("That child is not linked to your account.");
  const { error } = await supabase.from("leave_requests").insert({
    kind: "student",
    student_id: studentId,
    from_date: from,
    to_date: to,
    reason,
    applied_by: me.id,
    applied_by_name: me.fullName || me.email,
  });
  if (error) fail(explain(error.message));
  revalidatePath("/leave");
  return go("applied=1");
}

/**
 * Staff leave. A teacher with a linked staff record applies for their own leave and waits for approval.
 * An admin records leave for any staff member and it is approved straight away.
 */
export async function applyStaffLeave(formData: FormData) {
  const me = await requireRole(["admin", "teacher"]);
  const { from, to, reason } = readDates(formData);
  const supabase = await createClient();

  let staffId = String(formData.get("staff_id") ?? "");
  if (me.role === "teacher") {
    const { data: mine } = await supabase.from("staff").select("id").eq("profile_id", me.id).maybeSingle();
    if (!mine) fail("Your login is not linked to a staff record yet. Ask the admin to link it on the Staff page.");
    staffId = mine!.id as string;
  } else if (!UUID.test(staffId)) {
    fail("Choose the staff member.");
  }

  const admin = me.role === "admin";
  const { data: row, error } = await supabase
    .from("leave_requests")
    .insert({
      kind: "staff",
      staff_id: staffId,
      from_date: from,
      to_date: to,
      reason,
      status: admin ? "approved" : "pending",
      applied_by: me.id,
      applied_by_name: me.fullName || me.email,
      ...(admin ? { decided_by: me.id, decided_by_name: me.fullName || me.email, decided_at: new Date().toISOString() } : {}),
    })
    .select("id")
    .single();
  if (error || !row) return fail(explain(error?.message ?? "The leave could not be saved."));

  if (admin) {
    const err = await markStaff(supabase, staffId, from, to);
    if (err) {
      await supabase.from("leave_requests").delete().eq("id", row.id);
      return fail(`The leave was not saved because attendance could not be marked: ${err}`);
    }
  }
  revalidatePath("/leave");
  revalidatePath("/staff/attendance");
  return go(admin ? "recorded=1" : "applied=1");
}

async function markStudent(supabase: Awaited<ReturnType<typeof createClient>>, studentId: string, from: string, to: string) {
  const days = leaveDays(from, to);
  const { data } = await supabase.from("attendance").select("date, status").eq("student_id", studentId).in("date", days);
  const keep = new Set((data ?? []).filter((r) => r.status === "present" || r.status === "late").map((r) => r.date as string));
  const rows = days.filter((d) => !keep.has(d)).map((date) => ({ student_id: studentId, date, status: "leave" }));
  if (!rows.length) return null;
  const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "student_id,date" });
  return error?.message ?? null;
}

async function markStaff(supabase: Awaited<ReturnType<typeof createClient>>, staffId: string, from: string, to: string) {
  const days = leaveDays(from, to);
  const { data } = await supabase.from("staff_attendance").select("date, status").eq("staff_id", staffId).in("date", days);
  const keep = new Set((data ?? []).filter((r) => r.status === "present" || r.status === "late" || r.status === "half_day").map((r) => r.date as string));
  const rows = days.filter((d) => !keep.has(d)).map((date) => ({ staff_id: staffId, date, status: "leave" }));
  if (!rows.length) return null;
  const { error } = await supabase.from("staff_attendance").upsert(rows, { onConflict: "staff_id,date" });
  return error?.message ?? null;
}

/**
 * Approves or rejects a waiting request. Approving marks "leave" in attendance for every day of the range except Sundays,
 * leaving days already marked present or late alone. Student leave can be decided by an admin or a teacher; staff leave by an admin.
 */
export async function decideLeave(formData: FormData) {
  const me = await requireRole(["admin", "teacher"]);
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!UUID.test(id) || (decision !== "approved" && decision !== "rejected")) return;
  if (note.length > NOTE_MAX) fail(`The note can be at most ${NOTE_MAX} characters.`);

  const supabase = await createClient();
  const { data: req } = await supabase.from("leave_requests").select("*").eq("id", id).maybeSingle();
  if (!req) fail("That request could not be found.");
  if (req!.status !== "pending") fail("That request has already been decided.");
  if (req!.kind === "staff" && me.role !== "admin") fail("Only an admin can decide staff leave.");

  // Only a request that is still waiting can be changed, so two people deciding at once cannot both succeed.
  const { data: updated, error } = await supabase
    .from("leave_requests")
    .update({ status: decision, decided_by: me.id, decided_by_name: me.fullName || me.email, decided_at: new Date().toISOString(), decision_note: note || null })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (error) fail(explain(error.message));
  if (!updated?.length) fail("That request has already been decided.");

  if (decision === "approved") {
    const err = req!.kind === "student"
      ? await markStudent(supabase, req!.student_id as string, req!.from_date as string, req!.to_date as string)
      : await markStaff(supabase, req!.staff_id as string, req!.from_date as string, req!.to_date as string);
    if (err) {
      await supabase.from("leave_requests").update({ status: "pending", decided_by: null, decided_by_name: null, decided_at: null, decision_note: null }).eq("id", id);
      fail(`The leave was not approved because attendance could not be marked: ${err}`);
    }
  }
  revalidatePath("/leave");
  revalidatePath("/attendance");
  revalidatePath("/staff/attendance");
  revalidatePath("/portal");
  return go(`${decision}=1`);
}

/** Withdraws a request that is still waiting (the person who applied, or an admin). */
export async function withdrawLeave(formData: FormData) {
  await requireRole(["admin", "teacher", "parent"]);
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  await supabase.from("leave_requests").delete().eq("id", id).eq("status", "pending");
  revalidatePath("/leave");
  return go("withdrawn=1");
}
