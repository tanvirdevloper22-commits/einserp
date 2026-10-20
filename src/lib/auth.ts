import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "pending" | "admin" | "accountant" | "teacher" | "parent";

export const STAFF_ROLES: Role[] = ["admin", "accountant", "teacher"];

export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: (data?.full_name as string | null) ?? "",
    role: ((data?.role as Role | undefined) ?? "pending") as Role,
  };
}

/** Restricts a page or action to the given roles; anyone else is redirected to the dashboard. */
export async function requireRole(roles: Role[]) {
  const profile = await getProfile();
  if (!roles.includes(profile.role)) redirect("/");
  return profile;
}
