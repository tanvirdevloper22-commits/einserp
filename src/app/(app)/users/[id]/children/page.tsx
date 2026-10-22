import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Link children" };

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

async function linkChild(formData: FormData) {
  "use server";
  await requireRole(["admin"]);
  const parentId = String(formData.get("parent_id") ?? "");
  const studentId = String(formData.get("student_id") ?? "");
  const back = (q: string) => redirect(`/users/${parentId}/children?${q}`);
  if (!studentId) back("error=" + encodeURIComponent("Choose a student."));
  const supabase = await createClient();
  const { error } = await supabase.from("parent_students").insert({ parent_id: parentId, student_id: studentId });
  if (error) {
    back("error=" + encodeURIComponent(
      error.code === "23505" ? "That student is already linked to this parent."
        : /parent_students/.test(error.message) ? "The parent portal tables are missing. Run supabase/008_parent_portal.sql in the Supabase SQL Editor first."
        : error.message));
  }
  revalidatePath(`/users/${parentId}/children`);
  back("linked=1");
}

async function unlinkChild(formData: FormData) {
  "use server";
  await requireRole(["admin"]);
  const parentId = String(formData.get("parent_id") ?? "");
  const studentId = String(formData.get("student_id") ?? "");
  const supabase = await createClient();
  await supabase.from("parent_students").delete().eq("parent_id", parentId).eq("student_id", studentId);
  revalidatePath(`/users/${parentId}/children`);
  redirect(`/users/${parentId}/children?unlinked=1`);
}

export default async function ChildrenPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; linked?: string; unlinked?: string }>;
}) {
  await requireRole(["admin"]);
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: parent } = await supabase.from("profiles").select("id, email, full_name, role").eq("id", id).maybeSingle();
  if (!parent) notFound();

  const [{ data: links, error }, { data: students }] = await Promise.all([
    supabase.from("parent_students").select("student_id, students(full_name, admission_no, classes(name, section))").eq("parent_id", id),
    supabase.from("students").select("id, admission_no, full_name, classes(name, section)").eq("status", "active").order("full_name"),
  ]);
  const linked = new Set((links ?? []).map((l) => l.student_id as string));
  const available = (students ?? []).filter((s) => !linked.has(s.id));

  return (
    <>
      <PageHeader title="Link children" description={`${parent.full_name || parent.email}: the students this parent can see in the parent portal.`}>
        <Link className="btn ghost" href="/users">Back to users</Link>
      </PageHeader>

      {parent.role !== "parent" && (
        <div className="notice info">This user&apos;s role is {parent.role}. Only users with the Parent role can open the parent portal. Change the role on the Users page.</div>
      )}
      {error && <div className="error">The parent portal tables are missing. Run supabase/008_parent_portal.sql in the Supabase SQL Editor first.</div>}
      {sp.error && <div className="error">{sp.error}</div>}
      {sp.linked && <div className="notice ok">Child linked.</div>}
      {sp.unlinked && <div className="notice ok">Child removed from this parent.</div>}

      <form action={linkChild} className="card" style={{ marginBottom: 16 }}>
        <input type="hidden" name="parent_id" value={id} />
        <h2>Add a child</h2>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div className="grow" style={{ maxWidth: 420 }}>
            <label htmlFor="student_id">Student</label>
            <select id="student_id" name="student_id" defaultValue="" required>
              <option value="" disabled>Select a student</option>
              {available.map((s) => {
                const c = one(s.classes);
                return <option key={s.id} value={s.id}>{s.full_name} ({s.admission_no}){c ? ` - ${c.name} ${c.section}` : ""}</option>;
              })}
            </select>
          </div>
          <button className="btn">Link student</button>
        </div>
      </form>

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Admission no.</th><th>Class</th><th /></tr></thead>
            <tbody>
              {links?.map((l) => {
                const s = one(l.students);
                const c = s ? one(s.classes) : null;
                return (
                  <tr key={l.student_id}>
                    <td className="strong">{s?.full_name ?? "-"}</td>
                    <td>{s?.admission_no ?? "-"}</td>
                    <td>{c ? `${c.name} - ${c.section}` : "-"}</td>
                    <td className="num">
                      <form action={unlinkChild}>
                        <input type="hidden" name="parent_id" value={id} />
                        <input type="hidden" name="student_id" value={l.student_id} />
                        <button className="btn ghost small">Remove</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!links?.length && <div className="empty"><strong>No children linked yet</strong>Choose a student above to link them to this parent.</div>}
      </div>
    </>
  );
}
