import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Exam marks" };

async function saveMarks(formData: FormData) {
  "use server";
  await requireRole(["admin", "teacher"]);
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
  await requireRole(["admin", "teacher"]);
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
      <PageHeader
        title={exam.name}
        description="Enter marks one subject at a time, then open a report card for any student."
      >
        <Link className="btn ghost" href="/exams">All exams</Link>
      </PageHeader>

      <form method="get" className="card toolbar">
        <div className="row">
          <div className="grow" style={{ maxWidth: 260 }}>
            <label htmlFor="class">Class</label>
            <select id="class" name="class" defaultValue={classId}>
              {classes?.map((c) => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
            </select>
          </div>
          <div className="grow" style={{ maxWidth: 260 }}>
            <label htmlFor="subject">Subject</label>
            <select id="subject" name="subject" defaultValue={subjectId}>
              {subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <button className="btn ghost">Load</button>
        </div>
      </form>

      <form action={saveMarks} className="card flush">
        <input type="hidden" name="exam_id" value={examId} />
        <input type="hidden" name="subject_id" value={subjectId ?? ""} />
        <div style={{ padding: 16, borderBottom: "1px solid var(--border)", maxWidth: 220 }}>
          <label htmlFor="max_marks">Maximum marks</label>
          <input id="max_marks" name="max_marks" type="number" min="1" defaultValue={maxDefault} />
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Admission no.</th><th>Student</th><th style={{ width: 160 }}>Marks</th><th /></tr></thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.admission_no}</td>
                  <td className="strong">{s.full_name}</td>
                  <td>
                    <input
                      name={`marks_${s.id}`}
                      type="number"
                      min="0"
                      step="0.5"
                      aria-label={`Marks for ${s.full_name}`}
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
        </div>
        {!students.length && (
          <div className="empty">
            <strong>No active students in this class</strong>
            Pick another class, or assign students to this one first.
          </div>
        )}
        {students.length > 0 && (
          <div style={{ padding: 16, borderTop: "1px solid var(--border)" }}>
            <button className="btn">Save marks</button>
          </div>
        )}
      </form>
    </>
  );
}
