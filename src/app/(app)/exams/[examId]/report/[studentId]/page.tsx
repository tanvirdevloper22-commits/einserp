import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { loadClassResults } from "@/lib/results";
import { createAdminClient, hasServiceRoleKey } from "@/lib/supabase/admin";
import PrintButton from "@/components/PrintButton";
import PageHeader from "@/components/PageHeader";
import ReportCard from "@/components/ReportCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Report card" };

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export default async function ReportCardPage({ params }: { params: Promise<{ examId: string; studentId: string }> }) {
  const me = await requireRole(["admin", "teacher", "parent"]);
  const isParent = me.role === "parent";
  const { examId, studentId } = await params;
  const supabase = await createClient();

  const [{ data: exam }, { data: stu }, school] = await Promise.all([
    supabase.from("exams").select("name, exam_date").eq("id", examId).maybeSingle(),
    supabase.from("students").select("id, class_id, classes(name, section)").eq("id", studentId).maybeSingle(),
    getSettings(),
  ]);
  if (!exam || !stu || !stu.class_id) notFound();

  const cls = one(stu.classes);
  // A parent can only read their own child's rows, so the class position is worked out with the server key.
  // The page still shows nothing but this child's own data.
  const canRank = !isParent || hasServiceRoleKey();
  const { students, subjects, results } = await loadClassResults(isParent && canRank ? createAdminClient() : supabase, examId, stu.class_id);
  const student = students.find((s) => s.id === studentId);
  const result = results.get(studentId);
  if (!student || !result) notFound();
  if (!canRank) result.rank = null;

  return (
    <div className="report-page">
      <PageHeader title="Report card" description={`${student.full_name} - ${exam.name}`}>
        <Link className="btn ghost" href={isParent ? "/portal" : `/exams/${examId}?class=${stu.class_id}`}>{isParent ? "Back" : "Back to marks"}</Link>
        {!isParent && <Link className="btn ghost" href={`/exams/${examId}/report?class=${stu.class_id}`}>Print whole class</Link>}
        <PrintButton />
      </PageHeader>
      <ReportCard
        school={school}
        exam={exam}
        className={cls ? `${cls.name} - ${cls.section}` : "Not assigned"}
        student={student}
        subjects={subjects}
        result={result}
        classSize={students.length}
      />
    </div>
  );
}
