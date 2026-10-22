import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getTeachers } from "@/lib/teachers";
import { DAYS, fmtTime, findClashes, type SlotLike } from "@/lib/timetable";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit timetable" };

async function saveTimetable(formData: FormData) {
  "use server";
  await requireRole(["admin"]);
  const classId = String(formData.get("class_id") ?? "");
  const back = (q: string) => redirect(`/timetable/edit?class=${classId}&${q}`);
  if (!classId) redirect("/timetable");
  const supabase = await createClient();

  const filled: { class_id: string; day_no: number; period_no: number; subject_id: string | null; teacher_id: string | null }[] = [];
  const cleared: { day_no: number; period_no: number }[] = [];
  for (const [key] of formData.entries()) {
    const m = /^s_(\d+)_(\d+)$/.exec(key);
    if (!m) continue;
    const day = Number(m[1]);
    const period = Number(m[2]);
    const subject = String(formData.get(`s_${day}_${period}`) ?? "") || null;
    const teacher = String(formData.get(`t_${day}_${period}`) ?? "") || null;
    if (subject || teacher) filled.push({ class_id: classId, day_no: day, period_no: period, subject_id: subject, teacher_id: teacher });
    else cleared.push({ day_no: day, period_no: period });
  }

  // Refuse a teacher who is already teaching another class in the same period.
  const teacherIds = [...new Set(filled.map((f) => f.teacher_id).filter(Boolean))] as string[];
  if (teacherIds.length) {
    const { data: others } = await supabase
      .from("timetable_slots")
      .select("class_id, day_no, period_no, teacher_id, classes(name, section)")
      .in("teacher_id", teacherIds)
      .neq("class_id", classId);
    const clashes = findClashes(filled as SlotLike[], (others ?? []) as SlotLike[]);
    if (clashes.length) {
      const teachers = await getTeachers();
      const c = clashes[0];
      const other = (others ?? []).find((o) => o.class_id === c.otherClassId && o.day_no === c.day_no && o.period_no === c.period_no);
      const oc = Array.isArray(other?.classes) ? other?.classes[0] : other?.classes;
      const day = DAYS.find((d) => d.no === c.day_no)?.long ?? `day ${c.day_no}`;
      const name = teachers.find((t) => t.id === c.teacher_id)?.name ?? "That teacher";
      const more = clashes.length > 1 ? ` (and ${clashes.length - 1} more clash${clashes.length > 2 ? "es" : ""})` : "";
      back("error=" + encodeURIComponent(`${name} is already teaching ${oc ? `${oc.name} - ${oc.section}` : "another class"} in period ${c.period_no} on ${day}${more}. Nothing was saved.`));
    }
  }

  if (filled.length) {
    const { error } = await supabase.from("timetable_slots").upsert(filled, { onConflict: "class_id,day_no,period_no" });
    if (error) {
      back("error=" + encodeURIComponent(error.code === "23505" ? "A teacher is booked in two classes in the same period." : `The timetable could not be saved: ${error.message}`));
    }
  }
  for (const c of cleared) {
    await supabase.from("timetable_slots").delete().eq("class_id", classId).eq("day_no", c.day_no).eq("period_no", c.period_no);
  }

  revalidatePath("/timetable");
  redirect(`/timetable?class=${classId}&saved=1`);
}

export default async function EditTimetablePage({ searchParams }: { searchParams: Promise<{ class?: string; error?: string }> }) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  if (!sp.class) notFound();
  const supabase = await createClient();

  const [{ data: cls }, { data: periods }, { data: subjects }, { data: slots }, teachers] = await Promise.all([
    supabase.from("classes").select("name, section").eq("id", sp.class).maybeSingle(),
    supabase.from("timetable_periods").select("*").order("period_no"),
    supabase.from("subjects").select("id, name").order("name"),
    supabase.from("timetable_slots").select("day_no, period_no, subject_id, teacher_id").eq("class_id", sp.class),
    getTeachers(),
  ]);
  if (!cls) notFound();

  const current = new Map((slots ?? []).map((s) => [`${s.day_no}|${s.period_no}`, s]));
  const teaching = (periods ?? []).filter((p) => !p.is_break);

  return (
    <>
      <PageHeader title={`Edit timetable: ${cls.name} - ${cls.section}`} description="Pick a subject and teacher for each period. Leave both empty for a free period.">
        <Link className="btn ghost" href={`/timetable?class=${sp.class}`}>Cancel</Link>
      </PageHeader>

      {sp.error && <div className="error">{sp.error}</div>}
      {!subjects?.length && (
        <div className="notice info">No subjects yet. Add them on the <Link href="/exams" style={{ textDecoration: "underline", fontWeight: 600 }}>Exams page</Link> first.</div>
      )}
      {!teachers.length && (
        <div className="notice info">No teachers to choose from. Create users with the Teacher role on the Users page.</div>
      )}

      <form action={saveTimetable} className="card flush">
        <input type="hidden" name="class_id" value={sp.class} />
        <div className="table-wrap tt-wrap">
          <table className="tt tt-edit">
            <thead>
              <tr><th>Period</th>{DAYS.map((d) => <th key={d.no}>{d.long}</th>)}</tr>
            </thead>
            <tbody>
              {teaching.map((p) => (
                <tr key={p.period_no}>
                  <td className="tt-time"><span className="strong">{p.label || `Period ${p.period_no}`}</span><span className="cell-sub">{fmtTime(p.start_time)} - {fmtTime(p.end_time)}</span></td>
                  {DAYS.map((d) => {
                    const c = current.get(`${d.no}|${p.period_no}`);
                    return (
                      <td key={d.no}>
                        <select name={`s_${d.no}_${p.period_no}`} defaultValue={c?.subject_id ?? ""} aria-label={`${d.long} period ${p.period_no} subject`}>
                          <option value="">Free</option>
                          {subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <select name={`t_${d.no}_${p.period_no}`} defaultValue={c?.teacher_id ?? ""} aria-label={`${d.long} period ${p.period_no} teacher`} style={{ marginTop: 6 }}>
                          <option value="">No teacher</option>
                          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!teaching.length && <div className="empty"><strong>No periods yet</strong>Set up the <Link href="/timetable/periods">period timings</Link> first.</div>}
        {teaching.length > 0 && (
          <div style={{ padding: 16, borderTop: "1px solid var(--border)" }}>
            <button className="btn">Save timetable</button>
          </div>
        )}
      </form>
    </>
  );
}
