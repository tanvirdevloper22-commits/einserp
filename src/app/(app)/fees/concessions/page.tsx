import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/dates";
import { KIND_LABEL, MODE_LABEL, describeConcession } from "@/lib/concessions";
import { fetchAll, lateFineCandidates } from "@/lib/late-fines";
import { PAGE_SIZE, pageRange, parsePage } from "@/lib/pagination";
import PageHeader from "@/components/PageHeader";
import Pagination from "@/components/Pagination";
import ConfirmButton from "@/components/ConfirmButton";
import { addConcession, applyLateFines, deleteConcession, saveLateFine, setConcessionActive } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fee concessions" };

const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

type SP = { error?: string; added?: string; fine_saved?: string; fined?: string; adm?: string; kind?: string; page?: string };

export default async function ConcessionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireRole(["admin", "accountant"]);
  const isAdmin = me.role === "admin";
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const { from, to } = pageRange(page);
  const supabase = await createClient();
  const today = todayISO();

  const [list, settingsRes, studentsRes] = await Promise.all([
    supabase
      .from("fee_concessions")
      .select("id, kind, mode, value, applies_to, note, active, created_at, students(full_name, admission_no, classes(name, section))", { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to),
    supabase.from("school_settings").select("late_fine_amount, late_fine_grace_days").eq("id", 1).maybeSingle(),
    fetchAll<{ id: string; admission_no: string; full_name: string; guardian_name: string | null; guardian_phone: string | null; admission_date: string | null; classes: { name: string; section: string } | { name: string; section: string }[] | null }>(
      (a, b) =>
        supabase
          .from("students")
          .select("id, admission_no, full_name, guardian_name, guardian_phone, admission_date, classes(name, section)")
          .eq("status", "active")
          .not("guardian_phone", "is", null)
          .order("id")
          .range(a, b),
    ),
  ]);

  const missing = list.error || settingsRes.error;
  const rows = list.data ?? [];
  const total = list.count ?? rows.length;
  const fineAmount = Number(settingsRes.data?.late_fine_amount ?? 0);
  const graceDays = Number(settingsRes.data?.late_fine_grace_days ?? 0);

  // Late fine preview: how many unpaid fees would be fined right now.
  const preview = !missing && fineAmount > 0 ? await lateFineCandidates(supabase, graceDays, today) : null;

  // Sibling suggestions: active students who share a guardian phone number. The earliest admitted is treated as the eldest.
  const groups = new Map<string, typeof studentsRes.rows>();
  for (const s of studentsRes.rows) {
    const digits = (s.guardian_phone ?? "").replace(/\D/g, "").slice(-10);
    if (digits.length < 10) continue;
    groups.set(digits, [...(groups.get(digits) ?? []), s]);
  }
  const { data: sibRows } = await supabase.from("fee_concessions").select("student_id, students(admission_no)").eq("kind", "sibling").eq("active", true);
  const hasSibling = new Set((sibRows ?? []).map((r) => one(r.students)?.admission_no).filter(Boolean));
  const sibGroups = [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => [...g].sort((x, y) => (x.admission_date ?? "9999").localeCompare(y.admission_date ?? "9999") || x.admission_no.localeCompare(y.admission_no)))
    .filter((g) => g.slice(1).some((s) => !hasSibling.has(s.admission_no)))
    .slice(0, 30);

  const finedParts = (sp.fined ?? "").split("|");

  return (
    <>
      <PageHeader
        title="Fee concessions"
        description="Sibling discounts, scholarships, RTE free seats and late fines."
      >
        <Link className="btn ghost" href="/fees">Back to fees</Link>
      </PageHeader>

      {sp.error && <div className="error">{sp.error}</div>}
      {sp.added && <div className="notice ok">Concession added for {sp.added}. It applies to fees you generate or add from now on.</div>}
      {sp.fine_saved && <div className="notice ok">Late fine settings saved.</div>}
      {sp.fined && (
        <div className="notice ok">
          {finedParts[0] === "0" ? "No fees needed a late fine." : `${finedParts[0]} late fine${finedParts[0] === "1" ? "" : "s"} added, ${finedParts[1]} in total.`}
        </div>
      )}
      {missing && (
        <div className="error">The concessions tables are missing. Run supabase/016_fee_concessions.sql in the Supabase SQL Editor first.</div>
      )}

      <div className="notice info">
        A concession is applied when fees are <strong>generated</strong> (Fee structure) or <strong>added</strong> (Fees page). Fees that already exist are not changed.
        If a student has more than one concession, they are added together, but never more than the fee itself. Pause or delete a concession to stop it.
      </div>

      {isAdmin && (
        <form action={addConcession} className="card" style={{ marginBottom: 24 }}>
          <h2>Add a concession</h2>
          <div className="form-grid">
            <div>
              <label htmlFor="admission_no">Student admission number</label>
              <input id="admission_no" name="admission_no" required defaultValue={sp.adm ?? ""} placeholder="e.g. 1042" />
            </div>
            <div>
              <label htmlFor="kind">Type</label>
              <select id="kind" name="kind" defaultValue={sp.kind && sp.kind in KIND_LABEL ? sp.kind : "sibling"}>
                {Object.entries(KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="mode">How it is given</label>
              <select id="mode" name="mode" defaultValue="percent">
                {Object.entries(MODE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="value">Percentage or amount (not needed for fully waived)</label>
              <input id="value" name="value" type="number" min="0" step="0.01" placeholder="e.g. 10 or 500" />
            </div>
            <div>
              <label htmlFor="applies_to">Only for fee titled (optional)</label>
              <input id="applies_to" name="applies_to" maxLength={60} placeholder="e.g. Tuition. Empty means every fee" />
            </div>
            <div>
              <label htmlFor="note">Note (optional)</label>
              <input id="note" name="note" maxLength={200} placeholder="e.g. Second child" />
            </div>
          </div>
          <div className="form-actions"><button className="btn">Add concession</button></div>
        </form>
      )}

      {sibGroups.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h2>Possible siblings</h2>
          <p className="sub" style={{ marginTop: 0 }}>
            Active students who share a guardian phone number. The earliest admitted is listed first. Giving a sibling discount to the others is usual.
          </p>
          <div className="stack">
            {sibGroups.map((g) => (
              <div key={g[0].id} className="row" style={{ justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                <div>
                  <span className="strong">{g[0].guardian_name || "Guardian"}</span>
                  <span className="cell-sub">{g[0].guardian_phone}</span>
                </div>
                <div className="row tight" style={{ alignItems: "center" }}>
                  {g.map((s, i) => {
                    const c = one(s.classes);
                    const label = `${s.full_name} (${s.admission_no}${c ? `, ${c.name}-${c.section}` : ""})`;
                    return i === 0 || !isAdmin || hasSibling.has(s.admission_no) ? (
                      <span key={s.id} className="badge neutral">{label}{hasSibling.has(s.admission_no) ? " · has discount" : ""}</span>
                    ) : (
                      <Link key={s.id} className="btn ghost small" href={`/fees/concessions?adm=${encodeURIComponent(s.admission_no)}&kind=sibling`}>
                        Discount for {label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <h2>Late fine</h2>
        <p className="sub" style={{ marginTop: 0 }}>
          A flat fine is added once to every fee that is still unpaid after its due date plus the grace days. Each fee is fined only once, and fines are never fined again.
        </p>
        {isAdmin ? (
          <form action={saveLateFine} className="row" style={{ marginBottom: 14 }}>
            <div>
              <label htmlFor="late_fine_amount">Fine per late fee (₹)</label>
              <input id="late_fine_amount" name="late_fine_amount" type="number" min="0" step="0.01" defaultValue={fineAmount || ""} placeholder="0 = no fine" style={{ width: 160 }} />
            </div>
            <div>
              <label htmlFor="late_fine_grace_days">Grace days after due date</label>
              <input id="late_fine_grace_days" name="late_fine_grace_days" type="number" min="0" max="365" step="1" defaultValue={graceDays} style={{ width: 160 }} />
            </div>
            <button className="btn ghost">Save settings</button>
          </form>
        ) : (
          <p className="sub">Current fine: {fineAmount > 0 ? `${inr(fineAmount)} after ${graceDays} grace day${graceDays === 1 ? "" : "s"}` : "not set"}.</p>
        )}
        {fineAmount > 0 && !missing && (
          <form action={applyLateFines} className="row" style={{ alignItems: "center" }}>
            <ConfirmButton
              className="btn"
              disabled={!preview || preview.candidates.length === 0}
              message={`Add ${preview?.candidates.length ?? 0} late fines of ${inr(fineAmount)} each? This adds new fees for the students.`}
            >
              Apply late fines now
            </ConfirmButton>
            <span className="cell-sub" style={{ display: "inline" }}>
              {preview?.error
                ? preview.error
                : preview && preview.candidates.length > 0
                  ? `${preview.candidates.length} unpaid fee${preview.candidates.length === 1 ? " is" : "s are"} late and not yet fined (${inr(preview.candidates.length * fineAmount)} in total).`
                  : "No unpaid fee is late and unfined right now."}
            </span>
          </form>
        )}
      </div>

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Student</th><th>Type</th><th>Concession</th><th>Applies to</th><th>Note</th><th>Added</th><th>Status</th>{isAdmin && <th />}</tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const st = one(r.students);
                const c = st ? one(st.classes) : null;
                return (
                  <tr key={r.id}>
                    <td>
                      <span className="strong">{st?.full_name ?? "-"}</span>
                      <span className="cell-sub">{st?.admission_no ?? ""}{c ? ` · ${c.name} - ${c.section}` : ""}</span>
                    </td>
                    <td>{KIND_LABEL[r.kind] ?? r.kind}</td>
                    <td>{describeConcession(r)}</td>
                    <td>{r.applies_to || "Every fee"}</td>
                    <td>{r.note || "-"}</td>
                    <td>{formatDate(r.created_at)}</td>
                    <td><span className={`badge ${r.active ? "ok" : "neutral"}`}>{r.active ? "Active" : "Paused"}</span></td>
                    {isAdmin && (
                      <td>
                        <div className="row tight" style={{ justifyContent: "flex-end" }}>
                          <form action={setConcessionActive}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="active" value={String(!r.active)} />
                            <button className="btn ghost small">{r.active ? "Pause" : "Resume"}</button>
                          </form>
                          <form action={deleteConcession}>
                            <input type="hidden" name="id" value={r.id} />
                            <ConfirmButton className="btn danger small" message="Delete this concession? Fees already created keep their discount.">Delete</ConfirmButton>
                          </form>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && !missing && (
          <div className="empty">
            <strong>No concessions yet</strong>
            {isAdmin ? "Add one above, or start from the possible siblings list." : "An admin can add concessions here."}
          </div>
        )}
        <Pagination basePath="/fees/concessions" params={{}} page={page} total={total} size={PAGE_SIZE} />
      </div>
    </>
  );
}
