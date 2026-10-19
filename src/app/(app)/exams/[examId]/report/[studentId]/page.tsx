import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "@/components/PrintButton";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

function grade(pct: number) {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  if (pct >= 40) return "D";
  return "F";
}

export default async function ReportCard({
  params,
}: {
  params: Promise<{ examId: string; studentId: string }>;
}) {
  await requireRole(["admin", "teacher"]);
  const { examId, studentId } = await params;
  const supabase = await createClient();

  const [{ data: exam }, { data: student }, { data: marks }] = await Promise.all([
    supabase.from("exams").select("*").eq("id", examId).single(),
    supabase
      .from("students")
      .select("full_name, admission_no, dob, guardian_name, classes(name, section)")
      .eq("id", studentId)
      .single(),
    supabase
      .from("marks")
      .select("marks_obtained, max_marks, subjects(name)")
      .eq("exam_id", examId)
      .eq("student_id", studentId),
  ]);
  if (!exam || !student) notFound();

  const cls = Array.isArray(student.classes) ? student.classes[0] : student.classes;
  const rows = (marks ?? []).map((m) => {
    const subj = Array.isArray(m.subjects) ? m.subjects[0] : m.subjects;
    const got = Number(m.marks_obtained);
    const max = Number(m.max_marks);
    return { subject: subj?.name ?? "-", got, max, pct: (got / max) * 100 };
  });
  rows.sort((a, b) => a.subject.localeCompare(b.subject));

  const totalGot = rows.reduce((s, r) => s + r.got, 0);
  const totalMax = rows.reduce((s, r) => s + r.max, 0);
  const overall = totalMax ? (totalGot / totalMax) * 100 : 0;

  return (
    <>
      <div className="header-row no-print">
        <Link className="btn ghost small" href={`/exams/${examId}`}>← Back to marks</Link>
        <PrintButton />
      </div>
      <div className="card">
        <h1>Report card</h1>
        <p className="sub">{exam.name}</p>
        <div className="form-grid" style={{ marginBottom: 18 }}>
          <div><strong>Name:</strong> {student.full_name}</div>
          <div><strong>Adm. no.:</strong> {student.admission_no}</div>
          <div><strong>Class:</strong> {cls ? `${cls.name} - ${cls.section}` : "-"}</div>
          <div><strong>Guardian:</strong> {student.guardian_name ?? "-"}</div>
        </div>
        <table>
          <thead>
            <tr><th>Subject</th><th className="num">Marks</th><th className="num">Out of</th><th className="num">%</th><th>Grade</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.subject}>
                <td>{r.subject}</td>
                <td className="num">{r.got}</td>
                <td className="num">{r.max}</td>
                <td className="num">{r.pct.toFixed(1)}</td>
                <td><span className={`badge ${r.pct >= 40 ? "ok" : "bad"}`}>{grade(r.pct)}</span></td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td><strong>Total</strong></td>
                <td className="num"><strong>{totalGot}</strong></td>
                <td className="num"><strong>{totalMax}</strong></td>
                <td className="num"><strong>{overall.toFixed(1)}</strong></td>
                <td><span className={`badge ${overall >= 40 ? "ok" : "bad"}`}>{grade(overall)}</span></td>
              </tr>
            </tfoot>
          )}
        </table>
        {!rows.length && <div className="empty">Is exam ke liye abhi marks nahi bhare gaye.</div>}
      </div>
    </>
  );
}
