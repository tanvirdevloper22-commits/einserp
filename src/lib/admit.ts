export const INSTRUCTIONS_MAX = 1200;

export const DEFAULT_INSTRUCTIONS = [
  "Bring this admit card to every paper. You may not be allowed to sit the exam without it.",
  "Reach the exam hall at least 15 minutes before the start time.",
  "Bring only the stationery you need. Mobile phones and smart watches are not allowed.",
  "Follow the invigilator's instructions at all times. Unfair means will lead to disciplinary action.",
];

/** The instruction lines to print: the exam's own text (one per line) or the default list. */
export function instructionLines(text: string | null | undefined): string[] {
  const own = (text ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return own.length ? own : DEFAULT_INSTRUCTIONS;
}

/** "09:00" or "09:00:00" as "9:00 AM". Empty for a missing time. */
export function formatTime(t: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t ?? "");
  if (!m) return "";
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

/** "9:00 AM to 12:00 PM", "9:00 AM", or "-" when no time is set. */
export function timeRange(start: string | null | undefined, end: string | null | undefined): string {
  const a = formatTime(start);
  const b = formatTime(end);
  return a && b ? `${a} to ${b}` : a || (b ? `Until ${b}` : "-");
}

/** Short weekday for a YYYY-MM-DD date, in Indian time: "Mon". */
export function weekday(date: string): string {
  const d = new Date(`${date}T00:00:00+05:30`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" });
}

export type Paper = {
  id: string;
  class_id: string;
  paper_date: string;
  start_time: string | null;
  end_time: string | null;
  subjects: { name: string } | { name: string }[] | null;
};

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
export const paperSubject = (p: Paper) => one(p.subjects)?.name ?? "-";

/** Papers in the order they are written: by date, then start time, then subject. */
export function sortPapers<T extends Paper>(papers: T[]): T[] {
  return [...papers].sort(
    (a, b) =>
      a.paper_date.localeCompare(b.paper_date) ||
      (a.start_time ?? "").localeCompare(b.start_time ?? "") ||
      paperSubject(a).localeCompare(paperSubject(b)),
  );
}
