export const LOAN_DAYS = 14;
export const FINE_PER_DAY = 1; // ₹ per day late, a suggestion the admin can change at return time

export type Book = {
  id: string;
  accession_no: string;
  title: string;
  author: string | null;
  category: string | null;
  isbn: string | null;
  shelf: string | null;
  copies: number;
};

export type Loan = {
  id: string;
  book_id: string;
  student_id: string | null;
  staff_id: string | null;
  issued_on: string;
  due_on: string;
  returned_on: string | null;
  fine: number;
  issued_by_name: string | null;
};

const DAY = 86400000;
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** The day this many days after a YYYY-MM-DD date. */
export function addDays(iso: string, days: number): string {
  const d = new Date(ms(iso));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days a book is late: 0 when on time, counted until `until` (return date, or today for an open loan). */
export function daysLate(due: string, until: string): number {
  return Math.max(0, Math.round((ms(until) - ms(due)) / DAY));
}

/** Suggested fine for a late return. */
export function suggestedFine(due: string, returned: string, perDay = FINE_PER_DAY): number {
  return Math.round(daysLate(due, returned) * perDay * 100) / 100;
}

/** Copies still on the shelf. */
export const available = (copies: number, out: number) => Math.max(0, copies - out);
