import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getTeachers } from "@/lib/teachers";
import PageHeader from "@/components/PageHeader";
import PrintButton from "@/components/PrintButton";
import TimetableGrid, { type GridCell } from "@/components/TimetableGrid";

export const dynamic = "force-dynamic";
export const metadata = { title: "Timetable" };

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export default async function TimetablePage({ searchParams }: { searchParams: Promise<{ class?: string; teacher?: string; saved?: string }> }) {
  const me = await getProfile();
  if (!["admin", "teacher", "accountant"].includes(me.role)) return null;
  const sp = await searchParams;
  const isAdmin = me.role === "admin";
  const supabase = await createClient();

  const [{ data: classes }, { data: periods, error: periodsError }, teachers, school] = await Promise.all([
    supabase.from("classes").select("id, name, section").order("name"),
    supabase.from("timetable_periods").select("*").order("period_no"),
    getTeachers(),
    getSettings(),
  ]);

  // A teacher opens their own week by default; everyone else opens the first class.
  const teacherId = sp.teacher ?? (!sp.class && me.role === "teacher" ? me.id : undefined);
  const classId = teacherId ? undefined : (sp.class ?? classes?.[0]?.id);
  const cls = classes?.find((c) => c.id === classId);
  const teacherName = teacherId ? (teachers.find((t) => t.id === teacherId)?.name ?? (teacherId === me.id ? me.fullName || "You" : "Teacher")) : null;

  const query = supabase
    .from("timetable_slots")
    .select("class_id, day_no, period_no, subject_id, teacher_id, subjects(name), classes(name, section)");
  const { data: slots, error: slotsError } = teacherId
    ? await query.eq("teacher_id", teacherId)
    : classId ? await query.eq("class_id", classId) : { data: [], error: null };

  const nameOfTeacher = new Map(teachers.map((t) => [t.id, t.name]));
  const cells = new Map<string, GridCell>();
  for (const s of slots ?? []) {
    const subject = one(s.subjects)?.name ?? "Unassigned";
    const c = one(s.classes);
    cells.set(`${s.day_no}|${s.period_no}`, teacherId
      ? { subject, className: c ? `${c.name} - ${c.section}` : undefined }
      : { subject, teacher: s.teacher_id ? nameOfTeacher.get(s.teacher_id) : undefined });
  }

  const missing = periodsError || slotsError;
  const title = teacherId ? `${teacherName}'s timetable` : cls ? `Class ${cls.name} - ${cls.section} timetable` : "Timetable";

  return (
    <div className="timetable-page">
      <PageHeader title="Timetable" description="Weekly schedule by class or by teacher.">
        {isAdmin && <Link className="btn ghost" href="/timetable/periods">Period timings</Link>}
        {isAdmin && classId && <Link className="btn ghost" href={`/timetable/edit?class=${classId}`}>Edit this timetable</Link>}
        <PrintButton />
      </PageHeader>

      {sp.saved && <div className="notice ok">Timetable saved.</div>}

      {missing && (
        <div className="error">
          The timetable tables are missing. Run supabase/007_timetable.sql in the Supabase SQL Editor first.
        </div>
      )}

      <form method="get" className="card toolbar">
        <div className="row">
          <div className="grow" style={{ maxWidth: 240 }}>
            <label htmlFor="class">Class</label>
            <select id="class" name="class" defaultValue={classId ?? ""}>
              <option value="">Choose a class</option>
              {classes?.map((c) => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
            </select>
          </div>
          <button className="btn ghost">Show class</button>
          {teachers.length > 0 && (
            <>
              <div className="grow" style={{ maxWidth: 240 }}>
                <label htmlFor="teacher">Teacher</label>
                <select id="teacher" name="teacher" defaultValue={teacherId ?? ""} form="teacher-form">
                  <option value="">Choose a teacher</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <button className="btn ghost" form="teacher-form">Show teacher</button>
            </>
          )}
        </div>
      </form>
      <form id="teacher-form" method="get" />

      {!missing && (
        <div className="card tt-card">
          <div className="tt-title">
            <strong>{school.school_name}</strong>
            <span>{title}{school.session_label ? ` | Session ${school.session_label}` : ""}</span>
          </div>
          {periods?.length ? (
            <TimetableGrid periods={periods} cells={cells} />
          ) : (
            <div className="empty"><strong>No periods set up</strong>{isAdmin ? "Add the period timings first." : "An admin needs to set up the period timings."}</div>
          )}
          {periods?.length ? (
            !slots?.length && (
              <p className="cell-sub" style={{ margin: "12px 0 0" }}>
                {teacherId ? "No periods are assigned to this teacher yet." : isAdmin ? "Nothing scheduled for this class yet. Use Edit this timetable to fill it in." : "Nothing scheduled for this class yet."}
              </p>
            )
          ) : null}
        </div>
      )}
    </div>
  );
}
