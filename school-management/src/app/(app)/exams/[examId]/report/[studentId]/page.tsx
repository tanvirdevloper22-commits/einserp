import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "@/components/PrintButton";
import PageHeader from "@/components/PageHeader";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Report card" };

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
      <PageHeader title="Report card" description={exam.name}>
        <Link className="btn ghost" href={`/exams/${examId}`}>Back to marks</Link>
        <PrintButton />
      </PageHeader>

      <div className="card" style={{ maxWidth: 820 }}>
        <div className="form-grid" style={{ marginBottom: 20 }}>
          <div><span className="cell-sub">Student</span><strong>{student.full_name}</strong></div>
          <div><span className="cell-sub">Admission number</span><strong>{student.admission_no}</strong></div>
          <div><span className="cell-sub">Class</span><strong>{cls ? `${cls.name} - ${cls.section}` : "Not assigned"}</strong></div>
          <div><span className="cell-sub">Guardian</span><strong>{student.guardian_name ?? "-"}</strong></div>
        </div>

        {rows.length > 0 ? (
          <div className="table-wrap" style={{ border: "1px solid var(--border)", borderRadius: 8 }}>
            <table>
              <thead>
                <tr><th>Subject</th><th className="num">Marks</th><th className="num">Out of</th><th className="num">Percentage</th><th>Grade</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.subject}>
                    <td className="strong">{r.subject}</td>
                    <td className="num">{r.got}</td>
                    <td className="num">{r.max}</td>
                    <td className="num">{r.pct.toFixed(1)}%</td>
                    <td><span className={`badge ${r.pct >= 40 ? "ok" : "bad"}`}>{grade(r.pct)}</span></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="strong">Total</td>
                  <td className="num strong">{totalGot}</td>
                  <td className="num strong">{totalMax}</td>
                  <td className="num strong">{overall.toFixed(1)}%</td>
                  <td><span className={`badge ${overall >= 40 ? "ok" : "bad"}`}>{grade(overall)}</span></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="empty">
            <strong>No marks entered</strong>
            Marks for this student have not been entered for this exam yet.
          </div>
        )}
      </div>
    </>
  );
}
