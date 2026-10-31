export type EventKind = "holiday" | "event" | "exam" | "meeting" | "other";

export const KINDS: { value: EventKind; label: string; badge: string }[] = [
  { value: "holiday", label: "Holiday", badge: "bad" },
  { value: "event", label: "Event", badge: "accent" },
  { value: "exam", label: "Exam", badge: "warn" },
  { value: "meeting", label: "Meeting", badge: "ok" },
  { value: "other", label: "Other", badge: "neutral" },
];
export const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.label])) as Record<EventKind, string>;
export const KIND_BADGE = Object.fromEntries(KINDS.map((k) => [k.value, k.badge])) as Record<EventKind, string>;
export const isKind = (v: string): v is EventKind => KINDS.some((k) => k.value === v);

export const TITLE_MAX = 100;
export const DETAILS_MAX = 500;

export type CalEvent = {
  id: string;
  title: string;
  kind: EventKind;
  start_date: string;
  end_date: string;
  details: string | null;
  created_by_name: string | null;
};

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => iso(new Date(day(s).getTime() + n * 86400000));

/** The weeks of a YYYY-MM month as rows of 7 dates (Sunday first). Days outside the month are included to fill the first and last week. */
export function monthWeeks(month: string): string[][] {
  const first = `${month}-01`;
  const start = addDays(first, -day(first).getUTCDay());
  const [y, m] = month.split("-").map(Number);
  const last = iso(new Date(Date.UTC(y, m, 0)));
  const end = addDays(last, 6 - day(last).getUTCDay());
  const weeks: string[][] = [];
  for (let d = start; d <= end; d = addDays(d, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
  return weeks;
}

export const eventsOn = (events: CalEvent[], date: string) => events.filter((e) => e.start_date <= date && e.end_date >= date);
export const holidayOn = (events: CalEvent[], date: string) => eventsOn(events, date).find((e) => e.kind === "holiday") ?? null;

/** The month before or after a YYYY-MM month. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "12 Nov" for one day, "12 to 14 Nov" or "30 Nov to 2 Dec" for a range. */
export function rangeLabel(start: string, end: string): string {
  const f = (s: string, withMonth: boolean) =>
    day(s).toLocaleDateString("en-IN", { day: "numeric", ...(withMonth ? { month: "short" } : {}), timeZone: "UTC" });
  if (start === end) return f(start, true);
  return start.slice(0, 7) === end.slice(0, 7) ? `${f(start, false)} to ${f(end, true)}` : `${f(start, true)} to ${f(end, true)}`;
}

export const EVENT_COLUMNS = "id, title, kind, start_date, end_date, details, created_by_name";
