export const PAYMENT_MODES: { value: string; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank transfer" },
  { value: "upi", label: "UPI" },
  { value: "cheque", label: "Cheque" },
];

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Reads a rupee amount typed in a form. Empty means 0. Returns null when it is not a valid amount. */
export function parseMoney(value: string): number | null {
  const t = value.trim();
  if (t === "") return 0;
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(t)) return null;
  return Number(t);
}

/**
 * Pay for one person for one month.
 *
 * Only marked absences reduce the salary: each absent day is unpaid, a half day loses half a day, and leave is paid up to the
 * allowed number of paid leave days and unpaid beyond that. Days that were never marked (Sundays, holidays) stay paid.
 * Late arrivals are paid in full.
 */
export function computePayslip(basic: number, daysInMonth: number, counts: Record<string, number>, paidLeaveAllowed: number) {
  const absent = counts.absent ?? 0;
  const half = counts.half_day ?? 0;
  const leave = counts.leave ?? 0;
  const unpaid = absent + half * 0.5 + Math.max(0, leave - paidLeaveAllowed);
  const payable = Math.max(0, daysInMonth - unpaid);
  return { unpaid, payable, earned: round2((basic * payable) / daysInMonth) };
}
