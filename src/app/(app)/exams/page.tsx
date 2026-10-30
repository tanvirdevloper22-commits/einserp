import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import PageHeader from "@/components/PageHeader";

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

export default async function ExamsPage({ searchParams }: { searchParams: Promise<{ error?: string; added?: string }> }) {
  const sp = await searchParams;
  const { role } = await requireRole(["admin", "teacher"]);
  const isAdmin = role === "admin";
  const supabase = await createClient();
  const [{ data: exams }, { data: subjects }] = await Promise.all([
    supabase.from("exams").select("*").order("created_at", { ascending: false }),
    supabase.from("subjects").select("*").order("name"),
  ]);

  return (
    <>
      <PageHeader
        title="Exams"
        description="Create exams, enter marks by subject and print report cards."
      />

      {sp.error && <div className="error">{sp.error}</div>}
      {sp.added && <div className="notice ok">{sp.added === "exam" ? "Exam created." : "Subject added."}</div>}

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

          <form action={addSubject} className="card">
            <h2>Subjects</h2>
            <div className="row tight" style={{ marginBottom: 16 }}>
              {subjects?.length
                ? subjects.map((s) => <span key={s.id} className="badge neutral">{s.name}</span>)
                : <span style={{ color: "var(--muted)" }}>No subjects yet.</span>}
            </div>
            <div className="form-grid one">
              <div><label htmlFor="subject_name">New subject</label><input id="subject_name" name="name" required /></div>
            </div>
            <div className="form-actions"><button className="btn ghost">Add subject</button></div>
          </form>
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
