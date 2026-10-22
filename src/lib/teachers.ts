import { createAdminClient, hasServiceRoleKey } from "@/lib/supabase/admin";

export type Teacher = { id: string; name: string };

/**
 * People who can be put on a timetable: teachers (and admins who also teach). Names come from the service-role client
 * because a teacher's own login can only read their own profile. Call it only from a page or action that already checked the role.
 */
export async function getTeachers(): Promise<Teacher[]> {
  if (!hasServiceRoleKey()) return [];
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id, full_name, role").in("role", ["teacher", "admin"]).order("full_name");
  return (data ?? []).map((p) => ({ id: p.id as string, name: ((p.full_name as string | null) || "Unnamed user") + (p.role === "admin" ? " (admin)" : "") }));
}
