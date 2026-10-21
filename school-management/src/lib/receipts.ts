export type PaymentRow = {
  id: string;
  receipt_no: number | string;
  amount: number | string;
  paid_on: string;
  mode: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const total = (rows: { amount: number | string }[]) => round2(rows.reduce((s, r) => s + Number(r.amount), 0));
const byReceipt = (a: PaymentRow, b: PaymentRow) => Number(a.receipt_no) - Number(b.receipt_no);

/** Payments in the order they were made, each with the balance that was left right after it. */
export function withRunningBalance<T extends PaymentRow>(feeAmount: number, payments: T[]) {
  let paid = 0;
  return [...payments].sort(byReceipt).map((p) => {
    paid = round2(paid + Number(p.amount));
    return { ...p, balanceAfter: round2(Math.max(feeAmount - paid, 0)) };
  });
}

/**
 * What a single payment's receipt shows: the payments made before it, this payment, and the balance left right after it.
 * Later payments are ignored for the numbers, so a receipt always reads as it did on the day it was issued.
 */
export function summarizePayment<T extends PaymentRow>(feeAmount: number, payments: T[], paymentId: string) {
  const sorted = [...payments].sort(byReceipt);
  const index = sorted.findIndex((p) => p.id === paymentId);
  if (index < 0) return null;

  const previous = sorted.slice(0, index);
  const current = sorted[index];
  const later = sorted.slice(index + 1);
  const previousTotal = total(previous);
  const paidSoFar = round2(previousTotal + Number(current.amount));

  return {
    previous,
    current,
    previousTotal,
    paidSoFar,
    balanceAfter: round2(Math.max(feeAmount - paidSoFar, 0)),
    isLatest: later.length === 0,
  };
}
