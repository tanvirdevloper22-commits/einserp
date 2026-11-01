export type PlanOptions = {
  /** First paper: YYYY-MM-DD and HH:MM. */
  firstDate: string;
  firstStart: string;
  /** Length of every paper in minutes. 0 leaves the end time empty. */
  lengthMin: number;
  /** Gap between two papers. In hours it is counted from the end of the previous paper, in days from its date. */
  gap: number;
  unit: "hours" | "days";
  skipSunday: boolean;
  /** Most papers on one day when the gap is in hours. 0 means as many as fit before midnight. */
  perDay?: number;
};

export type PlannedPaper = { date: string; start: string; end: string };

const DAY_END = 23 * 60 + 59;

const toMin = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};
const fromMin = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

/** The date `days` after a YYYY-MM-DD date, moved on to Monday when it lands on a Sunday and skipSunday is on. */
export function addDays(iso: string, days: number, skipSunday: boolean): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  if (skipSunday && d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Dates and times for `count` papers in order.
 * Hours: the next paper starts `gap` hours after the previous one ends; if that would run past midnight it moves to the next day at the first start time.
 * Days: every paper starts at the first start time, `gap` days (at least 1) after the previous one.
 * Returns an error text instead when the options cannot work.
 */
export function planPapers(count: number, o: PlanOptions): { papers: PlannedPaper[] } | { error: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.firstDate)) return { error: "Choose the date of the first paper." };
  const start0 = toMin(o.firstStart);
  if (Number.isNaN(start0)) return { error: "Choose the start time of the first paper." };
  if (!(o.lengthMin >= 0) || o.lengthMin > 12 * 60) return { error: "The length of a paper must be between 0 and 12 hours." };
  if (!(o.gap >= 0) || o.gap > 90) return { error: "The gap is not valid." };
  if (o.unit === "hours" && o.lengthMin <= 0) return { error: "Enter how long each paper is, so the gap can be counted from where it ends." };
  if (start0 + o.lengthMin > DAY_END) return { error: "The first paper would run past midnight." };

  const papers: PlannedPaper[] = [];
  let date = addDays(o.firstDate, 0, o.skipSunday);
  let start = start0;
  let today = 1;
  for (let i = 0; i < count; i++) {
    if (i > 0) {
      if (o.unit === "days") {
        date = addDays(date, Math.max(1, Math.round(o.gap)), o.skipSunday);
        start = start0;
        today = 1;
      } else {
        const next = start + o.lengthMin + Math.round(o.gap * 60);
        if (next + o.lengthMin > DAY_END || ((o.perDay ?? 0) > 0 && today >= (o.perDay ?? 0))) {
          date = addDays(date, 1, o.skipSunday);
          start = start0;
          today = 1;
        } else {
          start = next;
          today++;
        }
      }
    }
    papers.push({ date, start: fromMin(start), end: o.lengthMin > 0 ? fromMin(start + o.lengthMin) : "" });
  }
  return { papers };
}
