import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { STUDENT_BUCKET } from "@/lib/students";
import { sortPapers, type Paper } from "@/lib/admit";
import PageHeader from "@/components/PageHeader";
import PrintButton from "@/components/PrintButton";
import AdmitCard, { type AdmitStudent } from "@/components/AdmitCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admit cards" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const PER_PAGE = 2;

export default async function AdmitCardsPage({
  params,
  searchParams,
}: {
  params: Promise<{ examId: string }>;
  searchParams: Promise<{ class?: string; student?: string }>;
}) {
  const me = await requireRole(["admin", "teacher", "parent"]);
  const isParent = me.role === "parent";
  const { examId } = await params;
  const sp = await searchParams;
  if (!UUID.test(examId)) notFound();
  const classId = !isParent && sp.class && UUID.test(sp.class) ? sp.class : "";
  const studentId = sp.student && UUID.test(sp.student) ? sp.student : "";
  const supabase = await createClient();
  const school = await getSettings();

  const { data: exam } = await supabase.from("exams").select("*").eq("id", examId).maybeSingle();
  if (!exam) notFound();
  const { data: classes } = isParent ? { data: [] as { id: string; name: string; section: string }[] } : await supabase.from("classes").select("id, name, section").order("name").order("section");

  let students: AdmitStudent[] = [];
  let papers: Paper[] = [];
  let loadError = "";
  if (studentId || classId) {
    let q = supabase
      .from("students")
      .select("id, full_name, admission_no, dob, guardian_name, photo_path, class_id, classes(name, section)")
      .order("full_name")
      .limit(500);
    q = studentId ? q.eq("id", studentId) : q.eq("class_id", classId).eq("status", "active");
    const { data, error } = await q;
    if (error) loadError = error.message;
    const rows = data ?? [];

    const paths = rows.map((r) => r.photo_path).filter((p): p is string => Boolean(p));
    const urls = new Map<string, string>();
    if (paths.length) {
      const { data: signed } = await supabase.storage.from(STUDENT_BUCKET).createSignedUrls(paths, 3600);
      signed?.forEach((s) => { if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl); });
    }
    students = rows.map((r) => {
      const cls = one(r.classes);
      return {
        id: r.id,
        full_name: r.full_name,
        admission_no: r.admission_no,
        dob: r.dob,
        guardian_name: r.guardian_name,
        className: cls ? `${cls.name} - ${cls.section}` : "-",
        photoUrl: r.photo_path ? urls.get(r.photo_path) ?? null : null,
        class_id: r.class_id as string | null,
      } as AdmitStudent & { class_id: string | null };
    });

    const classIds = [...new Set(rows.map((r) => r.class_id as string | null).filter((c): c is string => Boolean(c)))];
    if (classIds.length) {
      const { data: p, error: pErr } = await supabase
        .from("exam_papers")
        .select("id, class_id, paper_date, start_time, end_time, subjects(name)")
        .eq("exam_id", examId)
        .in("class_id", classIds)
        .limit(1000);
      if (pErr && !loadError) loadError = /exam_papers|schema cache|does not exist/i.test(pErr.message) ? "The date sheet tables are missing. Run supabase/021_exam_schedule.sql in the Supabase SQL Editor first." : pErr.message;
      papers = sortPapers((p ?? []) as unknown as Paper[]);
    }
  }
  const papersFor = (s: AdmitStudent) => papers.filter((p) => p.class_id === (s as AdmitStudent & { class_id?: string | null }).class_id);

  const pages: AdmitStudent[][] = [];
  for (let i = 0; i < students.length; i += PER_PAGE) pages.push(students.slice(i, i + PER_PAGE));

  return (
    <div className="admit-page">
      <PageHeader title="Admit cards" description={exam.name}>
        <Link className="btn ghost" href={isParent ? "/portal" : "/exams"}>{isParent ? "Back" : "Back to exams"}</Link>
        {!isParent && <Link className="btn ghost" href={`/exams/${examId}/schedule${classId ? `?class=${classId}` : ""}`}>Date sheet</Link>}
        {students.length > 0 && <PrintButton />}
      </PageHeader>

      {loadError && <div className="error">{loadError}</div>}

      {!isParent && (
        <form method="get" className="card toolbar no-print">
          <div className="row">
            <div className="grow" style={{ maxWidth: 320 }}>
              <label htmlFor="class">Class</label>
              <select id="class" name="class" defaultValue={classId}>
                <option value="">Choose a class</option>
                {(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
              </select>
            </div>
            <button className="btn ghost">Show admit cards</button>
          </div>
        </form>
      )}

      {students.length > 0 && !papers.length && !loadError && (
        <div className="notice info no-print">
          No date sheet has been added for {students.length === 1 ? "this class" : "this class"} yet, so the cards print without paper dates.
          {!isParent && <> Add it under <Link href={`/exams/${examId}/schedule`} style={{ textDecoration: "underline" }}>Date sheet</Link>.</>}
        </div>
      )}

      {pages.map((page, i) => (
        <div key={i} className="admit-sheet">
          {page.map((s) => <AdmitCard key={s.id} school={school} exam={exam} student={s} papers={papersFor(s)} />)}
        </div>
      ))}

      {!students.length && (studentId || classId) && !loadError && (
        <div className="card empty"><strong>No students found</strong>There are no active students in this class.</div>
      )}
      {!studentId && !classId && !isParent && (
        <div className="card empty"><strong>Choose a class</strong>Pick a class above to see its admit cards, two to a page.</div>
      )}
    </div>
  );
}
