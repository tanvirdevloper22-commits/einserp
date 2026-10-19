import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function addExam(formData: FormData) {
  "use server";
  await requireRole(["admin"]);
  const supabase = await createClient();
  await supabase.from("exams").insert({
    name: String(formData.get("name")).trim(),
    exam_date: String(formData.get("exam_date") ?? "") || null,
  });
  revalidatePath("/exams");
}

async function addSubject(formData: FormData) {
  "use server";
  await requireRole(["admin"]);
  const supabase = await createClient();
  await supabase.from("subjects").insert({ name: String(formData.get("name")).trim() });
  revalidatePath("/exams");
}

export default async function ExamsPage() {
  const { role } = await requireRole(["admin", "teacher"]);
  const isAdmin = role === "admin";
  const supabase = await createClient();
  const [{ data: exams }, { data: subjects }] = await Promise.all([
    supabase.from("exams").select("*").order("created_at", { ascending: false }),
    supabase.from("subjects").select("*").order("name"),
  ]);

  return (
    <>
      <h1>Exams & Report Cards</h1>
      <p className="sub">Exam banayein, marks bharein aur report card print karein</p>

      {isAdmin && (
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", marginBottom: 18 }}>
        <form action={addExam} className="card">
          <h2>New exam</h2>
          <div style={{ marginBottom: 12 }}><label>Name</label><input name="name" placeholder="Half Yearly 2026" required /></div>
          <div style={{ marginBottom: 14 }}><label>Date</label><input name="exam_date" type="date" /></div>
          <button className="btn">Create exam</button>
        </form>
        <form action={addSubject} className="card">
          <h2>Subjects</h2>
          <p className="sub" style={{ marginBottom: 10 }}>{subjects?.map((s) => s.name).join(", ") || "Koi subject nahi"}</p>
          <div style={{ marginBottom: 14 }}><label>New subject</label><input name="name" required /></div>
          <button className="btn ghost">Add subject</button>
        </form>
      </div>
      )}

      <div className="card">
        <table>
          <thead><tr><th>Exam</th><th>Date</th><th /></tr></thead>
          <tbody>
            {exams?.map((e) => (
              <tr key={e.id}>
                <td>{e.name}</td>
                <td>{e.exam_date ?? "-"}</td>
                <td className="num"><Link className="btn small" href={`/exams/${e.id}`}>Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!exams?.length && <div className="empty">Abhi koi exam nahi hai.</div>}
      </div>
    </>
  );
}
