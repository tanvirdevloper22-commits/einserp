import { round2 } from "@/lib/payroll";

export type ConcessionKind = "sibling" | "scholarship" | "rte" | "staff_child" | "other";
export type ConcessionMode = "percent" | "fixed" | "full";

export const KIND_LABEL: Record<string, string> = {
  sibling: "Sibling discount",
  scholarship: "Scholarship",
  rte: "RTE free seat",
  staff_child: "Staff child",
  other: "Other",
};

export const MODE_LABEL: Record<string, string> = {
  percent: "Percentage off",
  fixed: "Fixed amount off",
  full: "Fully waived",
};

export type Concession = {
  kind: string;
  mode: string;
  value: number;
  applies_to: string | null;
};

const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

/** "10% off", "₹500 off" or "Fully waived". */
export function describeConcession(c: Pick<Concession, "mode" | "value">): string {
  if (c.mode === "full") return "Fully waived";
  if (c.mode === "percent") return `${Number(c.value)}% off`;
  return `${inr(Number(c.value))} off`;
}

/** Does a concession cover a fee with this title? An empty "applies to" covers every fee. */
export function appliesTo(c: Pick<Concession, "applies_to">, title: string): boolean {
  const a = (c.applies_to ?? "").trim().toLowerCase();
  return !a || title.trim().toLowerCase().startsWith(a);
}

/**
 * The amount a student pays for one fee after their concessions.
 * Each concession is worked out on the original amount and they are added together, but never more than the fee itself.
 */
export function applyConcessions(title: string, gross: number, list: Concession[]) {
  let discount = 0;
  const parts: string[] = [];
  for (const c of list) {
    if (!appliesTo(c, title)) continue;
    const d = c.mode === "full" ? gross : c.mode === "percent" ? (gross * Number(c.value)) / 100 : Number(c.value);
    if (d <= 0) continue;
    discount += d;
    parts.push(`${KIND_LABEL[c.kind] ?? "Concession"} (${describeConcession(c)})`);
  }
  discount = round2(Math.min(discount, gross));
  return {
    gross: round2(gross),
    discount,
    net: round2(gross - discount),
    note: discount > 0 ? parts.join(", ") : null,
  };
}

/**
 * The fee row fields for a fee after concessions. "amount" is what is payable. The extra columns (original amount, concession,
 * note) are included only when a concession applies, so fees without one still save even if migration 016 has not been run yet.
 */
export function feeAmounts(title: string, gross: number, list: Concession[]): {
  amount: number;
  gross_amount?: number;
  concession_amount?: number;
  concession_note?: string | null;
} {
  const r = applyConcessions(title, gross, list);
  return r.discount > 0
    ? { amount: r.net, gross_amount: r.gross, concession_amount: r.discount, concession_note: r.note }
    : { amount: r.gross };
}

/** Groups concessions by student id. */
export function groupByStudent<T extends { student_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) map.set(r.student_id, [...(map.get(r.student_id) ?? []), r]);
  return map;
}

export const LATE_FINE_PREFIX = "Late fine - ";
