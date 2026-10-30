import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/dates";
import { NOTE_MAX, REASON_MAX, LEAVE_COLUMNS, STATUS_BADGE, STATUS_LABEL, dayCount, type LeaveRow } from "@/lib/leave";
import PageHeader from "@/components/PageHeader";
import ConfirmButton from "@/components/ConfirmButton";
import { applyStaffLeave, applyStudentLeave, decideLeave, withdrawLeave } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leave" };

type SP = { error?: string; applied?: string; recorded?: string; approved?: string; rejected?: string; withdrawn?: string };
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

function who(r: LeaveRow) {
  if (r.kind === "student") {
    const s = one(r.students);
    const c = one(s?.classes);
    return { name: s?.full_name ?? "Student", sub: `${s ? `Adm. no. ${s.admission_no}` : ""}${c ? ` · ${c.name} - ${c.section}` : ""}` };
  }
  const st = one(r.staff);
  return { name: st?.full_name ?? "Staff member", sub: st ? `Staff · ${st.employee_no}` : "Staff" };
}

function Dates({ r }: { r: LeaveRow }) {
  const n = dayCount(r.from_date, r.to_date);
  return (
    <>
      {r.from_date === r.to_date ? formatDate(r.from_date) : `${formatDate(r.from_date)} to ${formatDate(r.to_date)}`}
      <span className="cell-sub">{n} day{n === 1 ? "" : "s"} (Sundays not counted)</span>
    </>
  );
}

function ApplyFields({ min }: { min: string }) {
  return (
    <>
      <div><label htmlFor="from_date">From</label><input id="from_date" name="from_date" type="date" min={min} required /></div>
      <div><label htmlFor="to_date">To (leave empty for one day)</label><input id="to_date" name="to_date" type="date" min={min} /></div>
      <div style={{ gridColumn: "1 / -1" }}>
        <label htmlFor="reason">Reason</label>
        <textarea id="reason" name="reason" rows={3} required maxLength={REASON_MAX} placeholder="e.g. Fever, doctor has advised rest" />
      </div>
    </>
  );
}

export default async function LeavePage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireRole(["admin", "teacher", "parent"]);
  const sp = await searchParams;
  const supabase = await createClient();
  const isAdmin = me.role === "admin";
  const isTeacher = me.role === "teacher";
  const isParent = me.role === "parent";
  const min = (() => { const d = new Date(`${todayISO()}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 14); return d.toISOString().slice(0, 10); })();

  const { data, error } = await supabase.from("leave_requests").select(LEAVE_COLUMNS).order("created_at", { ascending: false }).limit(150);
  const all = (data ?? []) as unknown as LeaveRow[];
  const waiting = all.filter((r) => r.status === "pending").reverse();
  const decided = all.filter((r) => r.status !== "pending").slice(0, 40);

  const [children, staffList, myStaff] = await Promise.all([
    isParent
      ? supabase.from("parent_students").select("students(id, full_name)").then((r) => (r.data ?? []).map((l) => one(l.students)).filter((s): s is { id: string; full_name: string } => Boolean(s)))
      : Promise.resolve([] as { id: string; full_name: string }[]),
    isAdmin
      ? supabase.from("staff").select("id, full_name, employee_no").eq("status", "active").order("full_name").then((r) => r.data ?? [])
      : Promise.resolve([] as { id: string; full_name: string; employee_no: string }[]),
    isTeacher ? supabase.from("staff").select("id").eq("profile_id", me.id).maybeSingle().then((r) => r.data) : Promise.resolve(null),
  ]);

  const canDecide = (r: LeaveRow) => r.status === "pending" && (isAdmin || (isTeacher && r.kind === "student"));
  const canWithdraw = (r: LeaveRow) => r.status === "pending" && (isAdmin || isParent || (isTeacher && r.kind === "staff"));

  const table = (rows: LeaveRow[], showDecision: boolean) => (
    <div className="table-wrap">
      <table>
        <thead><tr>{!isParent && <th>Who</th>}{isParent && <th>Child</th>}<th>Dates</th><th>Reason</th><th>Status</th><th /></tr></thead>
        <tbody>
          {rows.map((r) => {
            const w = who(r);
            return (
              <tr key={r.id}>
                <td><span className="strong">{w.name}</span><span className="cell-sub">{w.sub}</span></td>
                <td><Dates r={r} /></td>
                <td style={{ maxWidth: 320 }}>
                  {r.reason}
                  <span className="cell-sub">Applied by {r.applied_by_name ?? "-"} on {formatDate(r.created_at)}</span>
                </td>
                <td>
                  <span className={`badge ${STATUS_BADGE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  {r.status !== "pending" && (
                    <span className="cell-sub">{r.decided_by_name ? `by ${r.decided_by_name}` : ""}{r.decision_note ? ` · ${r.decision_note}` : ""}</span>
                  )}
                </td>
                <td style={{ minWidth: showDecision ? 250 : undefined }}>
                  {showDecision && canDecide(r) && (
                    <form action={decideLeave} className="row tight" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <input type="hidden" name="id" value={r.id} />
                      <input name="note" maxLength={NOTE_MAX} placeholder="Note (optional)" aria-label="Note" style={{ maxWidth: 160 }} />
                      <button className="btn small" name="decision" value="approved">Approve</button>
                      <button className="btn ghost small" name="decision" value="rejected">Reject</button>
                    </form>
                  )}
                  {canWithdraw(r) && (!showDecision || !canDecide(r) || isParent) && (
                    <form action={withdrawLeave} style={{ textAlign: "right" }}>
                      <input type="hidden" name="id" value={r.id} />
                      <ConfirmButton className="btn ghost small" message="Withdraw this leave application?">Withdraw</ConfirmButton>
                    </form>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Leave"
        description={isParent ? "Apply for your child's leave and see its status." : "Approve student leave, and apply for or record staff leave."}
      >
        {!isParent && waiting.length > 0 && <span className="badge warn">{waiting.length} waiting</span>}
      </PageHeader>

      {sp.applied && <div className="notice ok">{isParent ? "Leave application sent. The school will approve or reject it." : "Your leave application was sent to the admin."}</div>}
      {sp.recorded && <div className="notice ok">Leave recorded and marked on the staff attendance.</div>}
      {sp.approved && <div className="notice ok">Leave approved and marked in attendance.</div>}
      {sp.rejected && <div className="notice ok">Leave rejected.</div>}
      {sp.withdrawn && <div className="notice ok">Application withdrawn.</div>}
      {sp.error && <div className="error">{sp.error}</div>}
      {error && <div className="error">The leave tables are missing. Run supabase/022_leave.sql in the Supabase SQL Editor first.</div>}

      {isParent && (
        <form action={applyStudentLeave} className="card" style={{ marginBottom: 24 }}>
          <h2 style={{ marginTop: 0 }}>Apply for leave</h2>
          {children.length === 0 ? (
            <p className="sub">No child is linked to your account yet. Please ask the school office to link your child.</p>
          ) : (
            <>
              <div className="form-grid">
                <div>
                  <label htmlFor="student_id">Child</label>
                  <select id="student_id" name="student_id" required defaultValue={children.length === 1 ? children[0].id : ""}>
                    {children.length > 1 && <option value="" disabled>Choose a child</option>}
                    {children.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </div>
                <div />
                <ApplyFields min={min} />
              </div>
              <div className="form-actions"><button className="btn">Send application</button></div>
            </>
          )}
        </form>
      )}

      {isTeacher && myStaff && (
        <form action={applyStaffLeave} className="card" style={{ marginBottom: 24 }}>
          <h2 style={{ marginTop: 0 }}>Apply for my leave</h2>
          <div className="form-grid"><ApplyFields min={min} /></div>
          <div className="form-actions"><button className="btn">Send to admin</button></div>
        </form>
      )}

      {isAdmin && (
        <form action={applyStaffLeave} className="card" style={{ marginBottom: 24 }}>
          <h2 style={{ marginTop: 0 }}>Record staff leave</h2>
          <p className="sub" style={{ marginTop: -6 }}>Approved straight away and marked as leave on the staff attendance (Sundays are skipped).</p>
          <div className="form-grid">
            <div>
              <label htmlFor="staff_id">Staff member</label>
              <select id="staff_id" name="staff_id" required defaultValue="">
                <option value="" disabled>Choose a staff member</option>
                {staffList.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.employee_no})</option>)}
              </select>
            </div>
            <div />
            <ApplyFields min={min} />
          </div>
          <div className="form-actions"><button className="btn">Record leave</button></div>
        </form>
      )}

      {!isParent && (
        <div className="card flush" style={{ marginBottom: 24 }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}><h2 style={{ margin: 0 }}>Waiting for a decision</h2></div>
          {waiting.length ? table(waiting, true) : <div className="empty"><strong>Nothing is waiting</strong>New leave applications appear here.</div>}
        </div>
      )}

      <div className="card flush">
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ margin: 0 }}>{isParent ? "Your applications" : "Recent decisions"}</h2>
        </div>
        {(isParent ? all : decided).length ? table(isParent ? all : decided, false) : <div className="empty"><strong>No applications yet</strong></div>}
      </div>
    </>
  );
}
