import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "pending" | "admin" | "accountant" | "teacher" | "parent" | "attender";

export const STAFF_ROLES: Role[] = ["admin", "accountant", "teacher"];

/**
 * The signed-in user and their role. Wrapped in cache() so the layout, the page and any helper that ask for it
 * during the same request share one lookup instead of repeating it.
 */
export const getProfile = cache(async () => {
  const supabase = await createClient();
  // Token check without a network round trip; the middleware has already refreshed the session if needed.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", claims.sub)
    .single();

  return {
    id: claims.sub as string,
    email: (claims.email as string | undefined) ?? "",
    fullName: (data?.full_name as string | null) ?? "",
    role: ((data?.role as Role | undefined) ?? "pending") as Role,
  };
});

/** Restricts a page or action to the given roles; anyone else is redirected to the dashboard. */
export async function requireRole(roles: Role[]) {
  const profile = await getProfile();
  if (!roles.includes(profile.role)) redirect("/");
  return profile;
}
