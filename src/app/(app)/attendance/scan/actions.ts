"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { parseStudentQr, type ClassStat, type ScanResult } from "@/lib/qr-attendance";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Marks the student whose QR code was scanned as present (or late) for today. The work is done by a database function
 * so the gate attender needs no access to the tables. Already present/late stays as it is, a student on leave is left
 * alone, and an absent mark is corrected.
 */
export async function scanAttendance(text: string, mode: "present" | "late"): Promise<ScanResult> {
  await requireRole(["admin", "teacher", "attender"]);
  const id = parseStudentQr(String(text ?? "").slice(0, 200));
  if (!id) return { ok: false, kind: "error", message: "This is not a student ID card QR code." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("scan_attendance_mark", { p_student: id, p_status: mode === "late" ? "late" : "present" });
  if (error) {
    return {
      ok: false,
      kind: "error",
      message: /scan_attendance_mark|schema cache|does not exist/i.test(error.message)
        ? "Scanning is not set up yet. Run supabase/019_attender.sql in the Supabase SQL Editor first."
        : error.message,
    };
  }
  const r = (data ?? {}) as { kind?: string; name?: string; admission_no?: string; class?: string; status?: string };
  const who = { name: r.name, admissionNo: r.admission_no, className: r.class };
  switch (r.kind) {
    case "marked":
      revalidatePath("/attendance");
      return { ok: true, kind: "marked", message: `Marked ${r.status}.`, status: r.status, ...who };
    case "already":
      return { ok: true, kind: "already", message: `Already marked ${r.status} today.`, status: r.status, ...who };
    case "leave":
      return { ok: false, kind: "leave", message: "Marked on leave today, so it was not changed.", status: "leave", ...who };
    case "left":
      return { ok: false, kind: "error", message: "This student has left the school.", ...who };
    case "notfound":
      return { ok: false, kind: "error", message: "No student found for this card." };
    default:
      return { ok: false, kind: "error", message: "Unexpected answer from the database." };
  }
}

/** Today's numbers for every class, for the live panel on the scan page. */
export async function getTodayStats(): Promise<{ rows: ClassStat[]; error?: string }> {
  await requireRole(["admin", "teacher", "attender"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("attendance_today");
  if (error) {
    return {
      rows: [],
      error: /attendance_today|schema cache|does not exist/i.test(error.message)
        ? "Run supabase/019_attender.sql in the Supabase SQL Editor to see today's numbers."
        : error.message,
    };
  }
  const rows = ((data ?? []) as { cls_id: string | null; cls_name: string | null; cls_section: string | null; total: number; present: number; late: number; on_leave: number; absent_marked: number }[]).map((r) => ({
    classId: r.cls_id,
    label: r.cls_name ? `${r.cls_name} - ${r.cls_section}` : "No class",
    total: r.total,
    present: r.present,
    late: r.late,
    onLeave: r.on_leave,
    absentMarked: r.absent_marked,
  }));
  return { rows };
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
