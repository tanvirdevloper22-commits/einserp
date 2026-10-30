export const MAX_DAYS = 60;
export const REASON_MAX = 500;
export const NOTE_MAX = 300;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type LeaveStatus = "pending" | "approved" | "rejected";

export const STATUS_BADGE: Record<LeaveStatus, string> = { pending: "warn", approved: "ok", rejected: "bad" };
export const STATUS_LABEL: Record<LeaveStatus, string> = { pending: "Waiting", approved: "Approved", rejected: "Rejected" };

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Every calendar day from the first to the last date, both included. Empty when the dates are invalid or the range is longer than MAX_DAYS. */
export function allDays(from: string, to: string): string[] {
  if (!DATE.test(from) || !DATE.test(to) || to < from) return [];
  const out: string[] = [];
  for (let d = day(from); iso(d) <= to; d = new Date(d.getTime() + 86400000)) {
    out.push(iso(d));
    if (out.length > MAX_DAYS + 1) return [];
  }
  return out.length > MAX_DAYS + 1 ? [] : out;
}

/** The days that get a "leave" mark: every day of the range except Sundays, so that a Sunday never uses up paid leave. */
export function leaveDays(from: string, to: string): string[] {
  return allDays(from, to).filter((d) => day(d).getUTCDay() !== 0);
}

/** Checks an application's dates. Returns an error message, or null when they are fine. */
export function checkDates(from: string, to: string, today: string, earliest: string): string | null {
  if (!DATE.test(from) || !DATE.test(to)) return "Choose the first and last day of the leave.";
  if (from < earliest) return "The leave cannot start more than 14 days in the past.";
  if (to < from) return "The last day cannot be before the first day.";
  if (allDays(from, to).length === 0) return "Leave can be at most about two months long. Split it into two applications.";
  if (leaveDays(from, to).length === 0) return "That range only has Sundays, so there is nothing to mark.";
  return null;
}

/** "12 Nov to 14 Nov 2026 (3 days)" style summary pieces. */
export function dayCount(from: string, to: string): number {
  return leaveDays(from, to).length;
}

export type LeaveRow = {
  id: string;
  kind: "student" | "staff";
  student_id: string | null;
  staff_id: string | null;
  from_date: string;
  to_date: string;
  reason: string;
  status: LeaveStatus;
  applied_by_name: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  students?: { full_name: string; admission_no: string; classes: { name: string; section: string } | { name: string; section: string }[] | null } | { full_name: string; admission_no: string; classes: { name: string; section: string } | { name: string; section: string }[] | null }[] | null;
  staff?: { full_name: string; employee_no: string } | { full_name: string; employee_no: string }[] | null;
};

export const LEAVE_COLUMNS =
  "id, kind, student_id, staff_id, from_date, to_date, reason, status, applied_by_name, decided_by_name, decided_at, decision_note, created_at, students(full_name, admission_no, classes(name, section)), staff(full_name, employee_no)";
