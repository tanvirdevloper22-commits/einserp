import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { DEFAULT_INSTRUCTIONS, INSTRUCTIONS_MAX, paperSubject, sortPapers, timeRange, weekday, type Paper } from "@/lib/admit";
import PageHeader from "@/components/PageHeader";
import ConfirmButton from "@/components/ConfirmButton";
import { addPapers, deletePaper, saveInstructions } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Exam date sheet" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SP = { class?: string; error?: string; added?: string; saved?: string };

export default async function SchedulePage({ params, searchParams }: { params: Promise<{ examId: string }>; searchParams: Promise<SP> }) {
  const me = await requireRole(["admin", "teacher"]);
  const isAdmin = me.role === "admin";
  const { examId } = await params;
  const sp = await searchParams;
  if (!UUID.test(examId)) notFound();
  const filter = sp.class && UUID.test(sp.class) ? sp.class : "";
  const supabase = await createClient();

  const { data: exam } = await supabase.from("exams").select("*").eq("id", examId).maybeSingle();
  if (!exam) notFound();

  let q = supabase
    .from("exam_papers")
    .select("id, class_id, paper_date, start_time, end_time, subjects(name)")
    .eq("exam_id", examId)
    .limit(1000);
  if (filter) q = q.eq("class_id", filter);
  const [{ data: papersData, error }, { data: classes }, { data: subjects }] = await Promise.all([
    q,
    supabase.from("classes").select("id, name, section").order("name").order("section"),
    supabase.from("subjects").select("id, name").order("name"),
  ]);
  const papers = sortPapers((papersData ?? []) as unknown as Paper[]);
  const classLabel = new Map((classes ?? []).map((c) => [c.id, `${c.name} - ${c.section}`]));
  const byClass = new Map<string, Paper[]>();
  for (const p of papers) byClass.set(p.class_id, [...(byClass.get(p.class_id) ?? []), p]);
  const groups = [...byClass.entries()].sort((a, b) => (classLabel.get(a[0]) ?? "").localeCompare(classLabel.get(b[0]) ?? "", undefined, { numeric: true }));
  const back = filter ? `class=${filter}` : "";

  return (
    <>
      <PageHeader title="Date sheet" description={`${exam.name}${exam.exam_date ? ` · starts ${formatDate(exam.exam_date)}` : ""}`}>
        <Link className="btn ghost" href="/exams">Back to exams</Link>
        <Link className="btn" href={`/exams/${examId}/admit-cards${filter ? `?class=${filter}` : ""}`}>Admit cards</Link>
      </PageHeader>

      {sp.added && <div className="notice ok">Saved for {sp.added} class{sp.added === "1" ? "" : "es"}.</div>}
      {sp.saved && <div className="notice ok">Instructions saved.</div>}
      {sp.error && <div className="error">{sp.error}</div>}
      {error && <div className="error">The date sheet tables are missing. Run supabase/021_exam_schedule.sql in the Supabase SQL Editor first.</div>}

      {isAdmin && (
        <form action={addPapers} className="card" style={{ marginBottom: 24 }}>
          <input type="hidden" name="exam_id" value={examId} />
          <h2 style={{ marginTop: 0 }}>Add a paper</h2>
          <p className="sub" style={{ marginTop: -6 }}>Tick every class that writes this paper on the same day. Adding a subject that is already on a class&apos;s date sheet updates it.</p>
          <div className="form-grid">
            <div>
              <label htmlFor="subject_id">Subject</label>
              <select id="subject_id" name="subject_id" required defaultValue="">
                <option value="" disabled>Choose a subject</option>
                {(subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><label htmlFor="paper_date">Date</label><input id="paper_date" name="paper_date" type="date" required defaultValue={exam.exam_date ?? ""} /></div>
            <div><label htmlFor="start_time">Starts (optional)</label><input id="start_time" name="start_time" type="time" /></div>
            <div><label htmlFor="end_time">Ends (optional)</label><input id="end_time" name="end_time" type="time" /></div>
          </div>
          <div style={{ marginTop: 14 }}>
            <label>Classes</label>
            <div className="row tight" style={{ flexWrap: "wrap", gap: 8 }}>
              {(classes ?? []).map((c) => (
                <label key={c.id} className="badge neutral" style={{ display: "inline-flex", gap: 6, alignItems: "center", cursor: "pointer", margin: 0, padding: "6px 10px" }}>
                  <input type="checkbox" name="class_id" value={c.id} defaultChecked={filter === c.id} style={{ width: "auto", minHeight: 0 }} /> {c.name} - {c.section}
                </label>
              ))}
            </div>
            {!(classes ?? []).length && <span className="cell-sub">Add classes first.</span>}
          </div>
          <div className="form-actions"><button className="btn">Save paper</button></div>
        </form>
      )}

      <form method="get" className="card toolbar">
        <div className="row">
          <div className="grow" style={{ maxWidth: 280 }}>
            <label htmlFor="f">Show class</label>
            <select id="f" name="class" defaultValue={filter}>
              <option value="">All classes</option>
              {(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
            </select>
          </div>
          <button className="btn ghost">Filter</button>
        </div>
      </form>

      {groups.map(([cid, list]) => (
        <div key={cid} className="card flush" style={{ marginBottom: 16 }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}><h2 style={{ margin: 0 }}>{classLabel.get(cid) ?? "Class"}</h2></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Day</th><th>Subject</th><th>Time</th>{isAdmin && <th />}</tr></thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.paper_date)}</td>
                    <td>{weekday(p.paper_date)}</td>
                    <td className="strong">{paperSubject(p)}</td>
                    <td>{timeRange(p.start_time, p.end_time)}</td>
                    {isAdmin && (
                      <td className="num">
                        <form action={deletePaper}>
                          <input type="hidden" name="exam_id" value={examId} />
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="back" value={back} />
                          <ConfirmButton className="btn danger small" message="Remove this paper from the date sheet?">Remove</ConfirmButton>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {!groups.length && !error && (
        <div className="card empty"><strong>No papers yet</strong>{isAdmin ? "Add the first paper using the form above." : "The date sheet has not been added yet."}</div>
      )}

      {isAdmin && (
        <form action={saveInstructions} className="card">
          <input type="hidden" name="exam_id" value={examId} />
          <h2 style={{ marginTop: 0 }}>Instructions on the admit card</h2>
          <p className="sub" style={{ marginTop: -6 }}>One instruction per line. Leave it empty to print the standard instructions.</p>
          <textarea name="instructions" rows={5} maxLength={INSTRUCTIONS_MAX} defaultValue={exam.instructions ?? ""} placeholder={DEFAULT_INSTRUCTIONS.join("\n")} />
          <div className="form-actions"><button className="btn">Save instructions</button></div>
        </form>
      )}
    </>
  );
}
