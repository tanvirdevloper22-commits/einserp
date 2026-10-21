import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client with the service-role key. It bypasses RLS and can manage auth users,
 * so it must only be used inside server actions or route handlers, after a role check.
 * The key must never be exposed to the browser (no NEXT_PUBLIC_ prefix).
 */
export function hasServiceRoleKey() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
