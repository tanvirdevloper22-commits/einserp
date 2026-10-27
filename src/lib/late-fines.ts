import type { createClient } from "@/lib/supabase/server";
import { LATE_FINE_PREFIX } from "@/lib/concessions";

type Client = Awaited<ReturnType<typeof createClient>>;

const PAGE = 1000; // Supabase returns at most this many rows per request.

/** Reads every row of a query by asking for it page by page. */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) return { rows, error: error.message };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return { rows, error: null };
}

/** The day this many days before a YYYY-MM-DD date. */
export function daysBefore(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export type FineCandidate = { student_id: string; title: string; due_date: string; due: number };

/**
 * Unpaid fees that are past their due date plus the grace days and have not been fined yet.
 * Late fines themselves are never fined again, and each fee is fined only once.
 */
export async function lateFineCandidates(supabase: Client, graceDays: number, today: string) {
  const cutoff = daysBefore(today, graceDays); // a fee is late when its due date is before this day

  const overdue = await fetchAll<{ student_id: string; title: string; due_date: string; due: number }>((from, to) =>
    supabase
      .from("fee_balances")
      .select("student_id, title, due_date, due")
      .gt("due", 0)
      .lt("due_date", cutoff)
      .order("fee_id")
      .range(from, to),
  );
  if (overdue.error) return { candidates: [] as FineCandidate[], error: overdue.error };

  const fines = await fetchAll<{ student_id: string; title: string }>((from, to) =>
    supabase.from("fees").select("student_id, title").like("title", `${LATE_FINE_PREFIX}%`).order("id").range(from, to),
  );
  if (fines.error) return { candidates: [] as FineCandidate[], error: fines.error };
  const fined = new Set(fines.rows.map((f) => `${f.student_id}|${f.title}`));

  const candidates = overdue.rows
    .filter((f) => !f.title.startsWith(LATE_FINE_PREFIX))
    .filter((f) => !fined.has(`${f.student_id}|${LATE_FINE_PREFIX}${f.title}`))
    .map((f) => ({ student_id: f.student_id, title: f.title, due_date: f.due_date, due: Number(f.due) }));
  return { candidates, error: null as string | null };
}
