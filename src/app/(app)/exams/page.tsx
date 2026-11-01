import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import PageHeader from "@/components/PageHeader";
import ConfirmButton from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Exams" };

const fail = (m: string): never => redirect(`/exams?error=${encodeURIComponent(m)}`);

async function addExam(formData: FormData) {
  "use server";
  await requireRole(["admin"]);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) fail("Enter the exam name.");
  const supabase = await createClient();
  const { error } = await supabase.from("exams").insert({ name, exam_date: String(formData.get("exam_date") ?? "") || null });
  if (error) fail(`The exam could not be created: ${error.message}`);
  revalidatePath("/exams");
  redirect("/exams?added=exam");
}

async function addSubject(formData: FormData) {
  "use server";
  await requireRole(["admin"]);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) fail("Enter the subject name.");
  const supabase = await createClient();
  const { error } = await supabase.from("subjects").insert({ name });
  if (error) fail(error.code === "23505" ? `"${name}" is already added.` : `The subject could not be added: ${error.message}`);
  revalidatePath("/exams");
  redirect("/exams?added=subject");
}

async function deleteExam(formData: FormData) {
  "use server";
  await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("exams").delete().eq("id", id);
  if (error) fail(`The exam could not be deleted: ${error.message}`);
  revalidatePath("/exams");
  redirect("/exams?added=examdeleted");
}

async function renameSubject(formData: FormData) {
  "use server";
  await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  if (!name || name.length > 60) fail("Enter the subject name (up to 60 characters).");
  const supabase = await createClient();
  const { error } = await supabase.from("subjects").update({ name }).eq("id", id);
  if (error) fail(error.code === "23505" ? `"${name}" is already added.` : `The subject could not be renamed: ${error.message}`);
  revalidatePath("/exams");
  redirect("/exams?added=renamed");
}

async function deleteSubject(formData: FormData) {
  "use server";
  await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const supabase = await createClient();
  // Marks belong to a subject and would be erased with it, so a subject that already has marks is kept.
  const { count } = await supabase.from("marks").select("id", { count: "exact", head: true }).eq("subject_id", id);
  if ((count ?? 0) > 0) fail(`This subject already has ${count} mark${count === 1 ? "" : "s"} entered, so it cannot be deleted. You can rename it instead.`);
  const { error } = await supabase.from("subjects").delete().eq("id", id);
  if (error) fail(`The subject could not be deleted: ${error.message}`);
  revalidatePath("/exams");
  redirect("/exams?added=deleted");
}

export default async function ExamsPage({ searchParams }: { searchParams: Promise<{ error?: string; added?: string }> }) {
  const sp = await searchParams;
  const { role } = await requireRole(["admin", "teacher"]);
  const isAdmin = role === "admin";
  const supabase = await createClient();
  const [{ data: exams }, { data: subjects }] = await Promise.all([
    supabase.from("exams").select("*").order("created_at", { ascending: false }),
    supabase.from("subjects").select("*").order("name"),
  ]);

  // How many marks each exam holds, so the delete warning can say what would be lost.
  const markCount = new Map<string, number>();
  if (isAdmin) {
    await Promise.all((exams ?? []).map(async (e) => {
      const { count } = await supabase.from("marks").select("id", { count: "exact", head: true }).eq("exam_id", e.id);
      markCount.set(e.id as string, count ?? 0);
    }));
  }

  return (
    <>
      <PageHeader
        title="Exams"
        description="Create exams, enter marks by subject and print report cards."
      />

      {sp.error && <div className="error">{sp.error}</div>}
      {sp.added && <div className="notice ok">{sp.added === "exam" ? "Exam created." : sp.added === "examdeleted" ? "Exam deleted." : sp.added === "renamed" ? "Subject renamed." : sp.added === "deleted" ? "Subject deleted." : "Subject added."}</div>}

      {isAdmin && (
        <div className="grid two">
          <form action={addExam} className="card">
            <h2>Create an exam</h2>
            <div className="form-grid one">
              <div><label htmlFor="exam_name">Exam name</label><input id="exam_name" name="name" placeholder="Half Yearly 2026" required /></div>
              <div><label htmlFor="exam_date">Date</label><input id="exam_date" name="exam_date" type="date" /></div>
            </div>
            <div className="form-actions"><button className="btn">Create exam</button></div>
          </form>

          <div className="card">
            <h2>Subjects</h2>
            {subjects?.length ? (
              <div className="stack" style={{ gap: 8, marginBottom: 16 }}>
                {subjects.map((s) => (
                  <div key={s.id} className="row tight" style={{ alignItems: "center" }}>
                    <form action={renameSubject} className="row tight" style={{ flex: 1, alignItems: "center" }}>
                      <input type="hidden" name="id" value={s.id} />
                      <input name="name" defaultValue={s.name} maxLength={60} required aria-label={`Subject name ${s.name}`} style={{ flex: 1 }} />
                      <button className="btn ghost small">Rename</button>
                    </form>
                    <form action={deleteSubject}>
                      <input type="hidden" name="id" value={s.id} />
                      <ConfirmButton className="btn ghost small" message={`Delete the subject "${s.name}"? Its date sheet entries are removed too. A subject with marks cannot be deleted.`}>Delete</ConfirmButton>
                    </form>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--muted)" }}>No subjects yet.</p>
            )}
            <form action={addSubject}>
              <div className="form-grid one">
                <div><label htmlFor="subject_name">New subject</label><input id="subject_name" name="name" required /></div>
              </div>
              <div className="form-actions"><button className="btn ghost">Add subject</button></div>
            </form>
          </div>
        </div>
      )}

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Exam</th><th>Date</th><th /></tr></thead>
            <tbody>
              {exams?.map((e) => (
                <tr key={e.id}>
                  <td className="strong">{e.name}</td>
                  <td>{formatDate(e.exam_date)}</td>
                  <td className="num">
                    <Link className="btn ghost small" href={`/exams/${e.id}/schedule`}>Date sheet</Link>{" "}
                    <Link className="btn ghost small" href={`/exams/${e.id}/admit-cards`}>Admit cards</Link>{" "}
                    <Link className="btn ghost small" href={`/exams/${e.id}`}>Enter marks</Link>{" "}
                    <Link className="btn ghost small" href={`/exams/${e.id}/results`}>Results</Link>
                    {isAdmin && (
                      <form action={deleteExam} style={{ display: "inline", marginLeft: 6 }}>
                        <input type="hidden" name="id" value={e.id} />
                        <ConfirmButton
                          className="btn ghost small"
                          message={
                            (markCount.get(e.id as string) ?? 0) > 0
                              ? `Delete "${e.name}"? ${markCount.get(e.id as string)} marks entered for it, its report cards and its date sheet will be permanently deleted. This cannot be undone.`
                              : `Delete "${e.name}" and its date sheet? This cannot be undone.`
                          }
                        >
                          Delete
                        </ConfirmButton>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!exams?.length && (
          <div className="empty">
            <strong>No exams yet</strong>
            {isAdmin ? "Create the first exam using the form above." : "An admin needs to create an exam first."}
          </div>
        )}
      </div>
    </>
  );
}
