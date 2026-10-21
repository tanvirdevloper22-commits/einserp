export const inr = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

/** "2026-10-19" -> "19 Oct 2026" (date-only strings, timezone-safe) */
export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export const todayISO = () => new Date().toISOString().slice(0, 10);
