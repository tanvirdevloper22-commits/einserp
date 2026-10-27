import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { getSettings } from "@/lib/settings";
import { fetchAll } from "@/lib/late-fines";
import { PASS_OUT, classLabel, suggestNextClass, type ClassRow } from "@/lib/promotion";
import PageHeader from "@/components/PageHeader";
import ConfirmButton from "@/components/ConfirmButton";
import { promoteClass, undoPromotion } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Year-end promotion" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SP = { from?: string; to?: string; error?: string; done?: string; skipped?: string; undone?: string; of?: string };

/** The session label that follows this one: "2026-27" -> "2027-28". Empty when the format is not recognised. */
function nextSession(label: string): string {
  const m = /^(\d{4})\s*[-/]\s*(\d{2}|\d{4})$/.exec(label.trim());
  if (!m) return "";
  const start = Number(m[1]) + 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

export default async function PromotionPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const supabase = await createClient();
  const settings = await getSettings();

  const [{ data: classRows }, active, batches] = await Promise.all([
    supabase.from("classes").select("id, name, section").order("name").order("section"),
    fetchAll<{ id: string; class_id: string | null }>((a, b) =>
      supabase.from("students").select("id, class_id").eq("status", "active").order("id").range(a, b),
    ),
    supabase.from("promotion_batches").select("*").order("created_at", { ascending: false }).limit(25),
  ]);
  const classes = (classRows ?? []) as ClassRow[];
  const counts = new Map<string, number>();
  for (const s of active.rows) if (s.class_id) counts.set(s.class_id, (counts.get(s.class_id) ?? 0) + 1);

  const from = sp.from && UUID.test(sp.from) ? classes.find((c) => c.id === sp.from) : undefined;
  const suggestion = from ? suggestNextClass(from, classes) : null;

  let students: { id: string; admission_no: string; full_name: string }[] = [];
  if (from) {
    const { data } = await supabase
      .from("students")
      .select("id, admission_no, full_name")
      .eq("class_id", from.id)
      .eq("status", "active")
      .order("full_name")
      .limit(500);
    students = data ?? [];
  }

  const missing = Boolean(batches.error);
  const suggestedSession = nextSession(settings.session_label);

  return (
    <>
      <PageHeader title="Year-end promotion" description="Move a class to the next class, or mark the last class as passed out.">
        <Link className="btn ghost" href="/students">Back to students</Link>
      </PageHeader>

      {sp.done && (
        <div className="notice ok">
          {sp.done} student{sp.done === "1" ? "" : "s"} moved to {sp.to}.
          {Number(sp.skipped) > 0 && ` ${sp.skipped} could not be moved because they had changed since the list was opened.`}
          {" "}New fees for the new session can be generated from Fees → Fee structure.
        </div>
      )}
      {sp.undone && <div className="notice ok">{sp.undone} of {sp.of} students put back. Any who had moved again since were left alone.</div>}
      {sp.error && <div className="error">{sp.error}</div>}
      {missing && <div className="error">The promotion tables are missing. Run supabase/017_promotions.sql in the Supabase SQL Editor first.</div>}

      <div className="notice info">
        Promote the <strong>highest class first</strong> and work downwards (Class 10, then Class 9, and so on), so that each class is empty before the one below it moves in.
        Students you untick stay in their class, which is how you keep students who are detained. Every run is saved below and can be undone.
      </div>

      <form method="get" className="card toolbar">
        <div className="row">
          <div className="grow" style={{ maxWidth: 320 }}>
            <label htmlFor="from">Class to promote</label>
            <select id="from" name="from" defaultValue={from?.id ?? ""}>
              <option value="">Choose a class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{classLabel(c)} ({counts.get(c.id) ?? 0} students)</option>)}
            </select>
          </div>
          <button className="btn ghost">Show students</button>
        </div>
      </form>

      {from && (
        <form action={promoteClass} className="card flush" style={{ marginBottom: 24 }}>
          <input type="hidden" name="from" value={from.id} />
          <div style={{ padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>{classLabel(from)}</h2>
            <div className="form-grid">
              <div>
                <label htmlFor="to">Move to</label>
                <select id="to" name="to" defaultValue={sp.to ?? suggestion?.id ?? ""} required>
                  <option value="" disabled>Choose the new class</option>
                  {classes.filter((c) => c.id !== from.id).map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
                  <option value={PASS_OUT}>Passed out (leaves the school)</option>
                </select>
                <span className="cell-sub" style={{ marginTop: 6 }}>
                  {suggestion ? `Suggested: ${classLabel(suggestion)}.` : "No next class was found. Pick one, or choose Passed out if this is the last class."}
                </span>
              </div>
              <div>
                <label htmlFor="new_session">New academic session (optional)</label>
                <input id="new_session" name="new_session" maxLength={30} defaultValue="" placeholder={suggestedSession || "e.g. 2027-28"} />
                <span className="cell-sub" style={{ marginTop: 6 }}>
                  Now: {settings.session_label || "not set"}. Leave empty to keep it. Type it once, with the first class you promote.
                </span>
              </div>
            </div>
          </div>

          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", color: "var(--muted)", fontSize: 13 }}>
            {students.length} active student{students.length === 1 ? "" : "s"}. Untick anyone who should stay in this class.
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th style={{ width: 70 }}>Move</th><th>Admission no.</th><th>Student</th></tr></thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td><input type="checkbox" name="student" value={s.id} defaultChecked style={{ width: "auto", minHeight: 0 }} aria-label={`Move ${s.full_name}`} /></td>
                    <td>{s.admission_no}</td>
                    <td className="strong">{s.full_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!students.length && (
            <div className="empty"><strong>No active students in this class</strong>Choose another class above.</div>
          )}
          {students.length > 0 && (
            <div style={{ padding: 16, borderTop: "1px solid var(--border)" }}>
              <ConfirmButton className="btn" message="Move the ticked students now? You can undo this later from the history below.">
                Promote selected students
              </ConfirmButton>
            </div>
          )}
        </form>
      )}

      <div className="card flush">
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}><h2 style={{ margin: 0 }}>History</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>From</th><th>To</th><th className="num">Students</th><th>Session</th><th>By</th><th>Status</th><th /></tr></thead>
            <tbody>
              {(batches.data ?? []).map((b) => (
                <tr key={b.id}>
                  <td>{formatDate(b.created_at)}</td>
                  <td className="strong">{b.from_label}</td>
                  <td>{b.kind === "pass_out" ? "Passed out" : b.to_label ?? "-"}</td>
                  <td className="num">{b.student_count}</td>
                  <td>{b.session_from && b.session_to && b.session_from !== b.session_to ? `${b.session_from} → ${b.session_to}` : b.session_to ?? "-"}</td>
                  <td>{b.created_by_name ?? "-"}</td>
                  <td><span className={`badge ${b.undone_at ? "neutral" : "ok"}`}>{b.undone_at ? "Undone" : "Done"}</span></td>
                  <td>
                    {!b.undone_at && (
                      <form action={undoPromotion} style={{ textAlign: "right" }}>
                        <input type="hidden" name="id" value={b.id} />
                        <ConfirmButton className="btn ghost small" message={`Undo this promotion of ${b.student_count} students from ${b.from_label}?`}>
                          Undo
                        </ConfirmButton>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!(batches.data ?? []).length && !missing && (
          <div className="empty"><strong>No promotions yet</strong>Choose a class above to start.</div>
        )}
      </div>
    </>
  );
}
