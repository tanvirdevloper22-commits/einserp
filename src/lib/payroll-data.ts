import type { createClient } from "@/lib/supabase/server";
import { monthBounds } from "@/lib/staff-attendance";

type Client = Awaited<ReturnType<typeof createClient>>;

const PAGE = 1000; // Supabase returns at most this many rows per request, so a month for many staff is read in pages.

/** Counts of each attendance status per staff member for a YYYY-MM month, and how many attendance rows exist in total. */
export async function fetchMonthCounts(supabase: Client, month: string) {
  const { start, end } = monthBounds(month);
  const counts = new Map<string, Record<string, number>>();
  let total = 0;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("staff_attendance")
      .select("staff_id, status")
      .gte("date", start)
      .lte("date", end)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) return { counts, total, error: error.message };
    for (const r of data ?? []) {
      const c = counts.get(r.staff_id as string) ?? {};
      c[r.status as string] = (c[r.status as string] ?? 0) + 1;
      counts.set(r.staff_id as string, c);
      total += 1;
    }
    if (!data || data.length < PAGE) break;
  }
  return { counts, total, error: null as string | null };
}
