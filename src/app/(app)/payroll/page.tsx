import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/dates";
import { PAYMENT_MODES } from "@/lib/payroll";
import { monthLabel, parseMonth } from "@/lib/staff-attendance";
import PageHeader from "@/components/PageHeader";
import { generatePayslips, markPayslipPaid, markPayslipUnpaid, savePayslip } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payroll" };

const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const modeLabel = (v: string | null) => PAYMENT_MODES.find((m) => m.value === v)?.label ?? v ?? "-";

type SP = { month?: string; saved?: string; paid?: string; unpaid?: string; generated?: string; skipped?: string; warn?: string; error?: string };

export default async function PayrollPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const thisMonth = todayISO().slice(0, 7);
  const month = parseMonth(sp.month, thisMonth);
  const supabase = await createClient();

  const { data: slips, error } = await supabase
    .from("payslips")
    .select("id, basic, days_in_month, unpaid_days, payable_days, earned, allowances, deductions, deduction_note, net, status, paid_on, payment_mode, paid_leave_allowed, staff(full_name, employee_no, designation)")
    .eq("month", month);
  const rows = [...(slips ?? [])].sort((a, b) => (one(a.staff)?.full_name ?? "").localeCompare(one(b.staff)?.full_name ?? ""));

  const total = rows.reduce((s, r) => s + Number(r.net), 0);
  const paidTotal = rows.filter((r) => r.status === "paid").reduce((s, r) => s + Number(r.net), 0);
  const pendingCount = rows.filter((r) => r.status !== "paid").length;
  const leaveAllowed = rows[0]?.paid_leave_allowed ?? 1;

  return (
    <>
      <PageHeader title="Payroll" description={`Salary for ${monthLabel(month)}`}>
        <Link className="btn ghost" href="/staff/attendance/report">Attendance report</Link>
      </PageHeader>

      {sp.generated && (
        <div className="notice ok">
          {sp.generated} payslip{sp.generated === "1" ? "" : "s"} generated or refreshed.
          {Number(sp.skipped) > 0 && ` ${sp.skipped} active staff ${sp.skipped === "1" ? "has" : "have"} no monthly salary set and ${sp.skipped === "1" ? "was" : "were"} skipped. Set it on the Staff page.`}
        </div>
      )}
      {sp.warn && (
        <div className="notice info">
          No staff attendance has been marked for this month, so everyone is paid in full. Mark attendance and generate again to apply absences.
        </div>
      )}
      {sp.saved && <div className="notice ok">Payslip saved.</div>}
      {sp.paid && <div className="notice ok">Payslip marked as paid.</div>}
      {sp.unpaid && <div className="notice ok">Payslip moved back to draft.</div>}
      {sp.error && <div className="error">{sp.error}</div>}
      {error && (
        <div className="error">
          The payroll tables are missing. Run supabase/012_staff.sql, 013_staff_attendance.sql and 014_payroll.sql in the Supabase SQL Editor first.
        </div>
      )}

      <div className="card toolbar">
        <div className="row">
          <form method="get" className="row">
            <div>
              <label htmlFor="month">Month</label>
              <input id="month" name="month" type="month" max={thisMonth} defaultValue={month} />
            </div>
            <button className="btn ghost">Load</button>
          </form>
          <form action={generatePayslips} className="row" style={{ marginLeft: "auto" }}>
            <input type="hidden" name="month" value={month} />
            <div>
              <label htmlFor="paid_leave">Paid leave days per person</label>
              <input id="paid_leave" name="paid_leave" type="number" min={0} max={31} step={1} defaultValue={leaveAllowed} style={{ width: 110 }} />
            </div>
            <button className="btn">{rows.length ? "Refresh payslips" : "Generate payslips"}</button>
          </form>
        </div>
        <p className="sub" style={{ margin: "12px 0 0" }}>
          Each absent day is unpaid and a half day loses half a day. Leave is paid up to the number above, then unpaid. Late arrivals and
          days that were never marked (Sundays, holidays) are paid in full. Refreshing keeps allowances and deductions you typed and never touches paid payslips.
        </p>
      </div>

      {rows.length > 0 && (
        <div className="grid stats">
          <div className="card stat"><span className="label">Payslips</span><span className="value">{rows.length}</span></div>
          <div className="card stat"><span className="label">Total net pay</span><span className="value">{inr(total)}</span></div>
          <div className="card stat"><span className="label">Paid so far</span><span className="value">{inr(paidTotal)}</span></div>
          <div className="card stat"><span className="label">Still to pay</span><span className="value">{inr(total - paidTotal)}</span><span className="hint">{pendingCount} payslip{pendingCount === 1 ? "" : "s"}</span></div>
        </div>
      )}

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th><th className="num">Basic</th><th>Payable days</th><th className="num">Earned</th>
                <th>Allowances</th><th>Deductions</th><th className="num">Net pay</th><th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const st = one(r.staff);
                const paid = r.status === "paid";
                const fid = `ps-${r.id}`;
                return (
                  <tr key={r.id}>
                    <td>
                      <span className="strong">{st?.full_name ?? "-"}</span>
                      <span className="cell-sub">{[st?.employee_no, st?.designation].filter(Boolean).join(" · ")}</span>
                    </td>
                    <td className="num">{inr(Number(r.basic))}</td>
                    <td>
                      {Number(r.payable_days)} / {r.days_in_month}
                      {Number(r.unpaid_days) > 0 && <span className="cell-sub">{Number(r.unpaid_days)} unpaid</span>}
                    </td>
                    <td className="num">{inr(Number(r.earned))}</td>
                    <td>
                      {paid ? inr(Number(r.allowances)) : (
                        <input form={fid} name="allowances" type="number" min="0" step="0.01" defaultValue={Number(r.allowances) || ""} placeholder="0" style={{ width: 100 }} />
                      )}
                    </td>
                    <td>
                      {paid ? (
                        <>
                          {inr(Number(r.deductions))}
                          {r.deduction_note && <span className="cell-sub">{r.deduction_note}</span>}
                        </>
                      ) : (
                        <>
                          <input form={fid} name="deductions" type="number" min="0" step="0.01" defaultValue={Number(r.deductions) || ""} placeholder="0" style={{ width: 100 }} />
                          <input form={fid} name="deduction_note" maxLength={200} defaultValue={r.deduction_note ?? ""} placeholder="Reason (optional)" style={{ width: 150, marginTop: 6 }} />
                        </>
                      )}
                    </td>
                    <td className="num strong">{inr(Number(r.net))}</td>
                    <td>
                      <span className={`badge ${paid ? "ok" : "warn"}`}>{paid ? "Paid" : "Draft"}</span>
                      {paid && <span className="cell-sub">{formatDate(r.paid_on)} · {modeLabel(r.payment_mode)}</span>}
                    </td>
                    <td>
                      <div className="row tight" style={{ justifyContent: "flex-end", alignItems: "center" }}>
                        {paid ? (
                          <form action={markPayslipUnpaid}>
                            <input type="hidden" name="id" value={r.id} />
                            <button className="btn ghost small">Mark unpaid</button>
                          </form>
                        ) : (
                          <>
                            <form id={fid} action={savePayslip}>
                              <input type="hidden" name="id" value={r.id} />
                            </form>
                            <select form={fid} name="payment_mode" defaultValue="cash" aria-label="Payment mode" style={{ width: 130 }}>
                              {PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                            <button form={fid} className="btn ghost small">Save</button>
                            <button form={fid} formAction={markPayslipPaid} className="btn small">Mark paid</button>
                          </>
                        )}
                        <Link className="btn ghost small" href={`/payroll/slip/${r.id}`}>Slip</Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && !error && (
          <div className="empty">
            <strong>No payslips for {monthLabel(month)}</strong>
            Set each person&apos;s monthly salary on the Staff page, mark their attendance, then use Generate payslips.
          </div>
        )}
      </div>
    </>
  );
}
