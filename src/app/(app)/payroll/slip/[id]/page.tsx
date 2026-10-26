import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatDate } from "@/lib/dates";
import { PAYMENT_MODES } from "@/lib/payroll";
import { monthLabel } from "@/lib/staff-attendance";
import { accentStyle } from "@/lib/templates";
import PageHeader from "@/components/PageHeader";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Salary slip" };

const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export default async function SalarySlipPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["admin"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: slip } = await supabase
    .from("payslips")
    .select("*, staff(full_name, employee_no, designation, joining_date, phone)")
    .eq("id", id)
    .maybeSingle();
  if (!slip) notFound();
  const settings = await getSettings();

  const st = one(slip.staff);
  const paid = slip.status === "paid";
  const slipNo = `PAY-${String(slip.month).replace("-", "")}-${st?.employee_no ?? String(slip.id).slice(0, 6).toUpperCase()}`;
  const mode = PAYMENT_MODES.find((m) => m.value === slip.payment_mode)?.label ?? slip.payment_mode;

  return (
    <>
      <PageHeader title="Salary slip" description={`${st?.full_name ?? "Staff member"} · ${monthLabel(slip.month)}`}>
        <Link className="btn ghost" href={`/payroll?month=${slip.month}`}>Back to payroll</Link>
        <PrintButton />
      </PageHeader>

      <div className="card invoice" data-doc={settings.invoice_template} style={accentStyle(settings.accent_color)}>
        <div className="invoice-top">
          <div className="school-id">
            {settings.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="school-logo" src={settings.logoUrl} alt="" />
            )}
            <div>
              <h2>{settings.school_name}</h2>
              {settings.address && <div className="cell-sub">{settings.address}</div>}
              {(settings.phone || settings.email) && (
                <div className="cell-sub">{[settings.phone, settings.email].filter(Boolean).join("  |  ")}</div>
              )}
            </div>
          </div>
          <div className="invoice-meta">
            <div className="inv-no">Salary slip</div>
            <div className="cell-sub">{monthLabel(slip.month)}</div>
            <div className="cell-sub">{slipNo}</div>
            <div style={{ marginTop: 8 }}>
              <span className={`badge ${paid ? "ok" : "warn"}`}>{paid ? "Paid" : "Not paid yet"}</span>
            </div>
          </div>
        </div>

        <div className="invoice-cols">
          <div>
            <span className="cell-sub">Employee</span>
            <strong>{st?.full_name ?? "-"}</strong>
            <div className="cell-sub">Employee no. {st?.employee_no ?? "-"}</div>
            {st?.designation && <div className="cell-sub">{st.designation}</div>}
          </div>
          <div>
            <span className="cell-sub">Details</span>
            <div className="cell-sub">Joined {formatDate(st?.joining_date)}</div>
            <div className="cell-sub">Payable days {Number(slip.payable_days)} of {slip.days_in_month}</div>
            {Number(slip.unpaid_days) > 0 && <div className="cell-sub">Unpaid days {Number(slip.unpaid_days)}</div>}
          </div>
        </div>

        <div className="table-wrap" style={{ border: "1px solid var(--border)", borderRadius: 0 }}>
          <table>
            <thead><tr><th>Description</th><th className="num">Amount</th></tr></thead>
            <tbody>
              <tr><td className="strong">Monthly salary</td><td className="num">{inr(Number(slip.basic))}</td></tr>
              <tr>
                <td>Salary for {Number(slip.payable_days)} payable days</td>
                <td className="num">{inr(Number(slip.earned))}</td>
              </tr>
              {Number(slip.allowances) > 0 && <tr><td>Allowances</td><td className="num">{inr(Number(slip.allowances))}</td></tr>}
              {Number(slip.deductions) > 0 && (
                <tr>
                  <td>Deductions{slip.deduction_note ? ` (${slip.deduction_note})` : ""}</td>
                  <td className="num">- {inr(Number(slip.deductions))}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="totals">
          <div className="due"><span>Net pay</span><span>{inr(Number(slip.net))}</span></div>
        </div>

        {paid && (
          <p className="cell-sub" style={{ marginTop: 16, marginBottom: 0 }}>
            Paid on {formatDate(slip.paid_on)}{mode ? ` by ${mode}` : ""}.
          </p>
        )}

        <div className="invoice-cols" style={{ marginTop: 48 }}>
          <div className="cell-sub" style={{ borderTop: "1px solid var(--border-strong)", paddingTop: 6 }}>Employee signature</div>
          <div className="cell-sub" style={{ borderTop: "1px solid var(--border-strong)", paddingTop: 6 }}>Authorised signatory</div>
        </div>
      </div>
    </>
  );
}
