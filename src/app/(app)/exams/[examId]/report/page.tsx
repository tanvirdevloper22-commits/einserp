import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { loadClassResults } from "@/lib/results";
import PrintButton from "@/components/PrintButton";
import PageHeader from "@/components/PageHeader";
import ReportCard from "@/components/ReportCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Report cards" };

export default async function ClassReportCards({
  params,
  searchParams,
}: {
  params: Promise<{ examId: string }>;
  searchParams: Promise<{ class?: string }>;
}) {
  await requireRole(["admin", "teacher"]);
  const { examId } = await params;
  const sp = await searchParams;
  if (!sp.class) notFound();
  const supabase = await createClient();

  const [{ data: exam }, { data: cls }, school] = await Promise.all([
    supabase.from("exams").select("name, exam_date").eq("id", examId).maybeSingle(),
    supabase.from("classes").select("name, section").eq("id", sp.class).maybeSingle(),
    getSettings(),
  ]);
  if (!exam || !cls) notFound();

  const { students, subjects, results } = await loadClassResults(supabase, examId, sp.class);
  const className = `${cls.name} - ${cls.section}`;

  return (
    <div className="report-page">
      <PageHeader title="Report cards" description={`${className} - ${exam.name}. One card per page.`}>
        <Link className="btn ghost" href={`/exams/${examId}/results?class=${sp.class}`}>Back to results</Link>
        <PrintButton />
      </PageHeader>

      {!students.length && (
        <div className="empty card"><strong>No active students in this class</strong></div>
      )}
      {students.map((s) => (
        <div className="report-sheet" key={s.id}>
          <ReportCard
            school={school}
            exam={exam}
            className={className}
            student={s}
            subjects={subjects}
            result={results.get(s.id)!}
            classSize={students.length}
          />
        </div>
      ))}
    </div>
  );
}
