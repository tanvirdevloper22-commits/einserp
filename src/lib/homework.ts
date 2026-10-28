import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/dates";

export const TITLE_MAX = 120;
export const DETAILS_MAX = 2000;

export type Homework = {
  id: string;
  class_id: string;
  title: string;
  details: string | null;
  assigned_on: string;
  due_date: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  subjects: { name: string } | { name: string }[] | null;
  classes: { name: string; section: string } | { name: string; section: string }[] | null;
};

const COLUMNS =
  "id, class_id, title, details, assigned_on, due_date, created_by, created_by_name, created_at, subjects(name), classes(name, section)";

/**
 * Homework for one class that is still relevant: due today or later, with no due date and posted in the last 14 days,
 * or due in the last 3 days. Closest due date first. Used on the parent portal.
 */
export async function getCurrentHomework(classId: string, limit = 10) {
  const supabase = await createClient();
  const today = todayISO();
  const recently = new Date(Date.now() - 14 * 86400000).toISOString();
  const lastDue = daysFrom(today, -3);
  const { data, error } = await supabase
    .from("homework")
    .select(COLUMNS)
    .eq("class_id", classId)
    .or(`due_date.gte.${lastDue},and(due_date.is.null,created_at.gte.${recently})`)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  return { homework: (data ?? []) as Homework[], error };
}

/** The day this many days after (or, if negative, before) a YYYY-MM-DD date. */
export function daysFrom(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "Due today", "Due tomorrow", "Due in 3 days" or "Past due". Empty when there is no due date. */
export function dueLabel(due: string | null, today: string): { text: string; tone: "warn" | "ok" | "neutral" | "bad" } | null {
  if (!due) return null;
  if (due < today) return { text: "Past due", tone: "neutral" };
  if (due === today) return { text: "Due today", tone: "bad" };
  if (due === daysFrom(today, 1)) return { text: "Due tomorrow", tone: "warn" };
  const gap = Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  return { text: `Due in ${gap} days`, tone: "ok" };
}
