import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function saveMarks(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const examId = String(formData.get("exam_id"));
  const subjectId = String(formData.get("subject_id"));
  const maxMarks = Number(formData.get("max_marks")) || 100;
  const rows: {
    exam_id: string;
    subject_id: string;
    student_id: string;
    marks_obtained: number;
    max_marks: number;
  }[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("marks_") && String(value).trim() !== "") {
      rows.push({
        exam_id: examId,
        subject_id: subjectId,
        student_id: key.slice(6),
        marks_obtained: Math.min(Number(value), maxMarks),
        max_marks: maxMarks,
      });
    }
  }
  if (rows.length) {
    await supabase.from("marks").upsert(rows, { onConflict: "exam_id,student_id,subject_id" });
  }
  revalidatePath(`/exams/${examId}`);
}

export default async function ExamPage({
  params,
  searchParams,
}: {
  params: Promise<{ examId: string }>;
  searchParams: Promise<{ class?: string; subject?: string }>;
}) {
  const { examId } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: exam } = await supabase.from("exams").select("*").eq("id", examId).single();
  if (!exam) notFound();

  const [{ data: classes }, { data: subjects }] = await Promise.all([
    supabase.from("classes").select("*").order("name"),
    supabase.from("subjects").select("*").order("name"),
  ]);
  const classId = sp.class ?? classes?.[0]?.id;
  const subjectId = sp.subject ?? subjects?.[0]?.id;

  let students: { id: string; admission_no: string; full_name: string }[] = [];
  const existing = new Map<string, { marks_obtained: number; max_marks: number }>();
  if (classId) {
    const { data } = await supabase
      .from("students")
      .select("id, admission_no, full_name")
      .eq("class_id", classId)
      .eq("status", "active")
      .order("full_name");
    students = data ?? [];
    if (students.length && subjectId) {
      const { data: m } = await supabase
        .from("marks")
        .select("student_id, marks_obtained, max_marks")
        .eq("exam_id", examId)
        .eq("subject_id", subjectId)
        .in("student_id", students.map((s) => s.id));
      m?.forEach((r) => existing.set(r.student_id, r));
    }
  }
  const maxDefault = existing.values().next().value?.max_marks ?? 100;

  return (
    <>
      <div className="header-row">
        <div>
          <h1>{exam.name}</h1>
          <p className="sub">Subject-wise marks bharein, phir har student ka report card kholein</p>
        </div>
        <Link className="btn ghost small" href="/exams">← All exams</Link>
      </div>

      <form method="get" className="row card" style={{ marginBottom: 18 }}>
        <div className="grow">
          <label>Class</label>
          <select name="class" defaultValue={classId}>
            {classes?.map((c) => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
          </select>
        </div>
        <div className="grow">
          <label>Subject</label>
          <select name="subject" defaultValue={subjectId}>
            {subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <button className="btn ghost">Load</button>
      </form>

      <form action={saveMarks} className="card">
        <input type="hidden" name="exam_id" value={examId} />
        <input type="hidden" name="subject_id" value={subjectId ?? ""} />
        <div style={{ maxWidth: 160, marginBottom: 14 }}>
          <label>Max marks</label>
          <input name="max_marks" type="number" min="1" defaultValue={maxDefault} />
        </div>
        <table>
          <thead><tr><th>Adm. no.</th><th>Name</th><th style={{ width: 140 }}>Marks</th><th /></tr></thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>{s.admission_no}</td>
                <td>{s.full_name}</td>
                <td>
                  <input
                    name={`marks_${s.id}`}
                    type="number"
                    min="0"
                    step="0.5"
                    defaultValue={existing.get(s.id)?.marks_obtained ?? ""}
                  />
                </td>
                <td className="num">
                  <Link className="btn ghost small" href={`/exams/${examId}/report/${s.id}`}>Report card</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!students.length && <div className="empty">Is class mein koi active student nahi hai.</div>}
        {students.length > 0 && <div style={{ marginTop: 14 }}><button className="btn">Save marks</button></div>}
      </form>
    </>
  );
}
