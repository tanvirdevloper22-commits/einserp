export const DAYS = [
  { no: 1, short: "Mon", long: "Monday" },
  { no: 2, short: "Tue", long: "Tuesday" },
  { no: 3, short: "Wed", long: "Wednesday" },
  { no: 4, short: "Thu", long: "Thursday" },
  { no: 5, short: "Fri", long: "Friday" },
  { no: 6, short: "Sat", long: "Saturday" },
] as const;

/** "08:40:00" or "08:40" -> "8:40 AM" */
export function fmtTime(value: string | null | undefined) {
  if (!value) return "";
  const [h, m] = value.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export type SlotLike = { class_id: string; day_no: number; period_no: number; teacher_id: string | null };

/**
 * Finds teachers who would be in two places at once. `incoming` are the slots about to be saved for one class,
 * `others` are the existing slots of every other class.
 */
export function findClashes(incoming: SlotLike[], others: SlotLike[]) {
  const clashes: { teacher_id: string; day_no: number; period_no: number; otherClassId: string }[] = [];
  const taken = new Map<string, SlotLike>();
  for (const o of others) {
    if (o.teacher_id) taken.set(`${o.teacher_id}|${o.day_no}|${o.period_no}`, o);
  }
  for (const s of incoming) {
    if (!s.teacher_id) continue;
    const hit = taken.get(`${s.teacher_id}|${s.day_no}|${s.period_no}`);
    if (hit && hit.class_id !== s.class_id) {
      clashes.push({ teacher_id: s.teacher_id, day_no: s.day_no, period_no: s.period_no, otherClassId: hit.class_id });
    }
  }
  return clashes;
}
