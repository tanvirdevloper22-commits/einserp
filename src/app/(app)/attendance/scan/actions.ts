"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { parseStudentQr, type ScanResult } from "@/lib/qr-attendance";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/**
 * Marks the student whose QR code was scanned as present (or late) for today.
 * Already present/late stays as it is, a student on leave is left alone, and an absent mark is corrected.
 */
export async function scanAttendance(text: string, mode: "present" | "late"): Promise<ScanResult> {
  await requireRole(["admin", "teacher"]);
  const id = parseStudentQr(String(text ?? "").slice(0, 200));
  if (!id) return { ok: false, kind: "error", message: "This is not a student ID card QR code." };
  const status = mode === "late" ? "late" : "present";

  const supabase = await createClient();
  const { data: s, error } = await supabase
    .from("students")
    .select("id, full_name, admission_no, status, classes(name, section)")
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, kind: "error", message: error.message };
  if (!s) return { ok: false, kind: "error", message: "No student found for this card." };
  const cls = one(s.classes);
  const who = { name: s.full_name, admissionNo: s.admission_no, className: cls ? `${cls.name} - ${cls.section}` : "No class" };
  if (s.status !== "active") return { ok: false, kind: "error", message: "This student has left the school.", ...who };

  const date = todayISO();
  const { data: existing } = await supabase.from("attendance").select("status").eq("student_id", id).eq("date", date).maybeSingle();
  if (existing?.status === "present" || existing?.status === "late") {
    return { ok: true, kind: "already", message: `Already marked ${existing.status} today.`, status: existing.status, ...who };
  }
  if (existing?.status === "leave") {
    return { ok: false, kind: "leave", message: "Marked on leave today, so it was not changed.", status: "leave", ...who };
  }
  const { error: saveError } = await supabase.from("attendance").upsert({ student_id: id, date, status }, { onConflict: "student_id,date" });
  if (saveError) return { ok: false, kind: "error", message: saveError.message, ...who };
  revalidatePath("/attendance");
  return { ok: true, kind: "marked", message: `Marked ${status}.`, status, ...who };
}

/** Counts the active students of a class that have no attendance saved for today. */
export async function countUnmarked(classId: string): Promise<number> {
  await requireRole(["admin", "teacher"]);
  if (!UUID.test(classId)) return 0;
  return (await unmarkedIds(classId)).length;
}

async function unmarkedIds(classId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data: students } = await supabase.from("students").select("id").eq("class_id", classId).eq("status", "active").limit(1000);
  const ids = (students ?? []).map((s) => s.id as string);
  if (!ids.length) return [];
  const { data: done } = await supabase.from("attendance").select("student_id").eq("date", todayISO()).in("student_id", ids);
  const marked = new Set((done ?? []).map((r) => r.student_id as string));
  return ids.filter((i) => !marked.has(i));
}

/** After scanning, everyone in the class with no record for today is marked absent. Existing records are never overwritten. */
export async function markRestAbsent(classId: string): Promise<{ ok: boolean; message: string }> {
  await requireRole(["admin", "teacher"]);
  if (!UUID.test(classId)) return { ok: false, message: "Choose a class first." };
  const ids = await unmarkedIds(classId);
  if (!ids.length) return { ok: true, message: "Nobody is left unmarked in this class." };
  const supabase = await createClient();
  const date = todayISO();
  const { error } = await supabase
    .from("attendance")
    .upsert(ids.map((student_id) => ({ student_id, date, status: "absent" })), { onConflict: "student_id,date", ignoreDuplicates: true });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/attendance");
  return { ok: true, message: `${ids.length} student${ids.length === 1 ? "" : "s"} marked absent.` };
}
