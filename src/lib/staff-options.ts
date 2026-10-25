import { createClient } from "@/lib/supabase/server";

export type ClassOption = { id: string; label: string; taken: boolean };
export type AccountOption = { id: string; label: string };

/**
 * Choices for the staff form: classes (marking those that already have a class teacher) and login accounts
 * that are not yet linked to someone else. Pass the id of the staff record being edited so its own choices stay available.
 * Call it only from a page that already checked the admin role.
 */
export async function getStaffFormOptions(currentStaffId?: string) {
  const supabase = await createClient();
  const [{ data: classes }, { data: profiles }, { data: staffRows }] = await Promise.all([
    supabase.from("classes").select("id, name, section").order("name"),
    supabase.from("profiles").select("id, full_name, email, role").in("role", ["admin", "teacher", "accountant"]).order("full_name"),
    supabase.from("staff").select("id, profile_id, class_teacher_of"),
  ]);

  const others = (staffRows ?? []).filter((s) => s.id !== currentStaffId);
  const linked = new Set(others.map((s) => s.profile_id).filter(Boolean));
  const classTaken = new Set(others.map((s) => s.class_teacher_of).filter(Boolean));

  const classOptions: ClassOption[] = (classes ?? []).map((c) => ({
    id: c.id as string,
    label: `${c.name} - ${c.section}`,
    taken: classTaken.has(c.id),
  }));
  const accountOptions: AccountOption[] = (profiles ?? [])
    .filter((p) => !linked.has(p.id))
    .map((p) => ({
      id: p.id as string,
      label: `${(p.full_name as string | null) || "Unnamed"} (${p.email ?? "no email"}, ${p.role})`,
    }));

  return { classOptions, accountOptions };
}
