export type StaffStatus = "present" | "absent" | "late" | "half_day" | "leave";

export const STAFF_STATUSES: { value: StaffStatus; label: string; cls: string }[] = [
  { value: "present", label: "Present", cls: "p" },
  { value: "late", label: "Late", cls: "l" },
  { value: "half_day", label: "Half day", cls: "h" },
  { value: "absent", label: "Absent", cls: "a" },
  { value: "leave", label: "Leave", cls: "v" },
];

export const VALID_STATUSES = STAFF_STATUSES.map((s) => s.value) as string[];

/** Days a person is counted as having worked: a late arrival counts as a full day, a half day as 0.5. */
export function workedDays(c: Record<string, number>): number {
  return (c.present ?? 0) + (c.late ?? 0) + (c.half_day ?? 0) * 0.5;
}

/** Reads ?month=YYYY-MM safely, falling back to the given current month. */
export function parseMonth(value: string | undefined, current: string): string {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : current;
}

/** First and last calendar day (YYYY-MM-DD) of a YYYY-MM month. */
export function monthBounds(month: string): { start: string; end: string; days: number } {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(days).padStart(2, "0")}`, days };
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}
