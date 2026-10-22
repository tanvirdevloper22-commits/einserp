import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { buildUpiLink, upiQrDataUrl } from "@/lib/upi";
import { formatDate } from "@/lib/dates";
import { summarizePayment } from "@/lib/receipts";
import PrintButton from "@/components/PrintButton";
import { accentStyle } from "@/lib/templates";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment receipt" };

const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export default async function ReceiptPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const me = await requireRole(["admin", "accountant", "parent"]);
  const isParent = me.role === "parent";
  const { paymentId } = await params;
  const supabase = await createClient();

  const { data: payment } = await supabase.from("payments").select("fee_id").eq("id", paymentId).maybeSingle();
  if (!payment) notFound();

  const { data: fee } = await supabase
    .from("fees")
    .select("*, students(full_name, admission_no, guardian_name, guardian_phone, classes(name, section))")
    .eq("id", payment.fee_id)
    .maybeSingle();
  if (!fee) notFound();

  const [{ data: payments }, settings] = await Promise.all([
    supabase.from("payments").select("id, receipt_no, amount, paid_on, mode").eq("fee_id", fee.id),
    getSettings(),
  ]);

  const amount = Number(fee.amount);
  const sum = summarizePayment(amount, payments ?? [], paymentId);
  if (!sum) notFound();

  const student = one(fee.students);
  const cls = student ? one(student.classes) : null;
  const invoiceNo = fee.invoice_no ? `INV-${String(fee.invoice_no).padStart(4, "0")}` : `INV-${String(fee.id).slice(0, 8).toUpperCase()}`;
  const cleared = sum.balanceAfter <= 0;

  let qr: string | null = null;
  if (!cleared && sum.isLatest && settings.upi_id) {
    qr = await upiQrDataUrl(
      buildUpiLink({ vpa: settings.upi_id, name: settings.upi_name || settings.school_name, amount: sum.balanceAfter, note: invoiceNo })
    );
  }

  return (
    <>
      <PageHeader title="Payment receipt" description={`Receipt #${sum.current.receipt_no} for ${student?.full_name ?? "student"}`}>
        <Link className="btn ghost" href={isParent ? "/portal" : "/fees/payments"}>{isParent ? "Back" : "Back to payments"}</Link>
        <Link className="btn ghost" href={`/fees/invoice/${fee.id}`}>Full invoice</Link>
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
            <div className="inv-no">Receipt #{sum.current.receipt_no}</div>
            <div className="cell-sub">Paid on {formatDate(sum.current.paid_on)}</div>
            <div className="cell-sub">Against {invoiceNo}</div>
            <div style={{ marginTop: 8 }}>
              <span className={`badge ${cleared ? "ok" : "warn"}`}>{cleared ? "Paid in full" : "Partly paid"}</span>
            </div>
          </div>
        </div>

        <div className="invoice-cols">
          <div>
            <span className="cell-sub">Received from</span>
            <strong>{student?.full_name ?? "-"}</strong>
            <div className="cell-sub">Admission no. {student?.admission_no ?? "-"}</div>
            <div className="cell-sub">Class {cls ? `${cls.name} - ${cls.section}` : "not assigned"}</div>
          </div>
          <div>
            <span className="cell-sub">Guardian</span>
            <strong>{student?.guardian_name || "-"}</strong>
            {student?.guardian_phone && <div className="cell-sub">{student.guardian_phone}</div>}
          </div>
        </div>

        <div className="table-wrap" style={{ border: "1px solid var(--border)", borderRadius: 0 }}>
          <table>
            <thead><tr><th>Description</th><th className="num">Amount</th></tr></thead>
            <tbody>
              <tr><td className="strong">{fee.title}</td><td className="num">{inr(amount)}</td></tr>
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 20 }}>
          <h2>Payment history</h2>
          <div className="table-wrap" style={{ border: "1px solid var(--border)", borderRadius: 0 }}>
            <table>
              <thead><tr><th>Receipt no.</th><th>Date</th><th>Mode</th><th className="num">Amount</th></tr></thead>
              <tbody>
                {sum.previous.map((p) => (
                  <tr key={p.id}>
                    <td>#{p.receipt_no}</td>
                    <td>{formatDate(p.paid_on)}</td>
                    <td style={{ textTransform: "uppercase" }}>{p.mode}</td>
                    <td className="num">{inr(Number(p.amount))}</td>
                  </tr>
                ))}
                <tr>
                  <td className="strong">#{sum.current.receipt_no} (this receipt)</td>
                  <td className="strong">{formatDate(sum.current.paid_on)}</td>
                  <td className="strong" style={{ textTransform: "uppercase" }}>{sum.current.mode}</td>
                  <td className="num strong">{inr(Number(sum.current.amount))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="totals">
          <div><span>Invoice total</span><span>{inr(amount)}</span></div>
          {sum.previous.length > 0 && <div><span>Paid earlier</span><span>{inr(sum.previousTotal)}</span></div>}
          <div><span>Paid now</span><span>{inr(Number(sum.current.amount))}</span></div>
          <div className="due"><span>{cleared ? "Balance due" : "Balance due after this payment"}</span><span>{inr(sum.balanceAfter)}</span></div>
        </div>

        {qr && (
          <div className="pay-box">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={`UPI QR code to pay ${inr(sum.balanceAfter)}`} width={148} height={148} />
            <div>
              <strong style={{ fontSize: 15 }}>Scan to pay the remaining {inr(sum.balanceAfter)}</strong>
              <div className="cell-sub" style={{ marginTop: 8 }}>
                Paying to {settings.upi_name || settings.school_name}
                <br />UPI ID: {settings.upi_id}
              </div>
            </div>
          </div>
        )}

        {!sum.isLatest && (
          <p className="cell-sub" style={{ marginTop: 16, marginBottom: 0 }}>
            This receipt shows the position on the day of this payment. Later payments are listed on the full invoice.
          </p>
        )}
      </div>
    </>
  );
}
