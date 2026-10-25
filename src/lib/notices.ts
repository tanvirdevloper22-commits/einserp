import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/dates";
import type { Role } from "@/lib/auth";

export type Audience = "all" | "staff" | "parents" | "class";

export type Notice = {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  class_id: string | null;
  pinned: boolean;
  expires_on: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  classes: { name: string; section: string } | { name: string; section: string }[] | null;
};

export const AUDIENCE_LABEL: Record<Audience, string> = {
  all: "Everyone",
  staff: "Staff only",
  parents: "All parents",
  class: "One class",
};

/** Audiences each role is allowed to post to. Parents and accountants cannot post. */
export function postableAudiences(role: Role): Audience[] {
  if (role === "admin") return ["all", "staff", "parents", "class"];
  if (role === "teacher") return ["class", "staff"];
  return [];
}

export const TITLE_MAX = 120;
export const BODY_MAX = 2000;

/**
 * Notices visible to the signed-in user (row level security decides which), pinned first, newest first.
 * Expired notices are left out unless includeExpired is set (admins and teachers use that to manage them).
 */
export async function getNotices(opts: { limit?: number; includeExpired?: boolean } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("notices")
    .select("id, title, body, audience, class_id, pinned, expires_on, created_by, created_by_name, created_at, classes(name, section)")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (!opts.includeExpired) query = query.or(`expires_on.is.null,expires_on.gte.${todayISO()}`);
  if (opts.limit) query = query.limit(opts.limit);
  const { data, error } = await query;
  return { notices: (data ?? []) as Notice[], error };
}
