import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { buildUpiLink, upiQrDataUrl } from "@/lib/upi";
import { formatDate, todayISO } from "@/lib/dates";
import PrintButton from "@/components/PrintButton";
import { withRunningBalance } from "@/lib/receipts";
import { accentStyle } from "@/lib/templates";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fee invoice" };

const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export default async function InvoicePage({ params }: { params: Promise<{ feeId: string }> }) {
  const me = await requireRole(["admin", "accountant", "parent"]);
  const isParent = me.role === "parent";
  const { feeId } = await params;
  const supabase = await createClient();

  const { data: fee } = await supabase
    .from("fees")
    .select("*, students(full_name, admission_no, guardian_name, guardian_phone, address, classes(name, section))")
    .eq("id", feeId)
    .maybeSingle();
  if (!fee) notFound();

  const [{ data: payments }, settings] = await Promise.all([
    supabase.from("payments").select("*").eq("fee_id", feeId),
    getSettings(),
  ]);

  const history = withRunningBalance(Number(fee.amount), payments ?? []);
  const student = one(fee.students);
  const cls = student ? one(student.classes) : null;

  const amount = Number(fee.amount);
  const paid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const balance = Math.max(amount - paid, 0);
  const invoiceNo = fee.invoice_no ? `INV-${String(fee.invoice_no).padStart(4, "0")}` : `INV-${String(fee.id).slice(0, 8).toUpperCase()}`;

  const isPaid = balance <= 0;
  const isOverdue = !isPaid && fee.due_date && fee.due_date < todayISO();
  const status = isPaid ? { label: "Paid", cls: "ok" } : isOverdue ? { label: "Overdue", cls: "bad" } : paid > 0 ? { label: "Partly paid", cls: "warn" } : { label: "Unpaid", cls: "warn" };

  let qr: string | null = null;
  if (!isPaid && settings.upi_id) {
    qr = await upiQrDataUrl(
      buildUpiLink({ vpa: settings.upi_id, name: settings.upi_name || settings.school_name, amount: balance, note: invoiceNo })
    );
  }

  return (
    <>
      <PageHeader title="Fee invoice" description={`${invoiceNo} for ${student?.full_name ?? "student"}`}>
        <Link className="btn ghost" href={isParent ? "/portal" : "/fees"}>{isParent ? "Back" : "Back to fees"}</Link>
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
            <div className="inv-no">{invoiceNo}</div>
            <div className="cell-sub">Issued {formatDate(fee.created_at)}</div>
            <div className="cell-sub">Due {formatDate(fee.due_date)}</div>
            <div style={{ marginTop: 8 }}><span className={`badge ${status.cls}`}>{status.label}</span></div>
          </div>
        </div>

        <div className="invoice-cols">
          <div>
            <span className="cell-sub">Billed to</span>
            <strong>{student?.full_name ?? "-"}</strong>
            <div className="cell-sub">Admission no. {student?.admission_no ?? "-"}</div>
            <div className="cell-sub">Class {cls ? `${cls.name} - ${cls.section}` : "not assigned"}</div>
          </div>
          <div>
            <span className="cell-sub">Guardian</span>
            <strong>{student?.guardian_name || "-"}</strong>
            {student?.guardian_phone && <div className="cell-sub">{student.guardian_phone}</div>}
            {student?.address && <div className="cell-sub">{student.address}</div>}
          </div>
        </div>

        <div className="table-wrap" style={{ border: "1px solid var(--border)", borderRadius: 8 }}>
          <table>
            <thead><tr><th>Description</th><th className="num">Amount</th></tr></thead>
            <tbody>
              <tr><td className="strong">{fee.title}</td><td className="num">{inr(amount)}</td></tr>
            </tbody>
          </table>
        </div>

        {(payments?.length ?? 0) > 0 && (
          <div style={{ marginTop: 20 }}>
            <h2>Payments received</h2>
            <div className="table-wrap" style={{ border: "1px solid var(--border)", borderRadius: 8 }}>
              <table>
                <thead><tr><th>Receipt no.</th><th>Date</th><th>Mode</th><th className="num">Amount</th><th className="num">Balance after</th></tr></thead>
                <tbody>
                  {history.map((p) => (
                    <tr key={p.id}>
                      <td><Link href={`/fees/receipt/${p.id}`} style={{ textDecoration: "underline" }}>#{p.receipt_no}</Link></td>
                      <td>{formatDate(p.paid_on)}</td>
                      <td style={{ textTransform: "uppercase" }}>{p.mode}</td>
                      <td className="num">{inr(Number(p.amount))}</td>
                      <td className="num">{inr(p.balanceAfter)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="totals">
          <div><span>Invoice total</span><span>{inr(amount)}</span></div>
          <div><span>Paid</span><span>{inr(paid)}</span></div>
          <div className="due"><span>Balance due</span><span>{inr(balance)}</span></div>
        </div>

        {qr && (
          <div className="pay-box">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={`UPI QR code to pay ${inr(balance)}`} width={148} height={148} />
            <div>
              <strong style={{ fontSize: 15 }}>Scan to pay {inr(balance)}</strong>
              <div className="cell-sub" style={{ marginTop: 4 }}>
                Open any UPI app (Google Pay, PhonePe, Paytm, BHIM), scan this code and confirm. The amount is filled in.
              </div>
              <div className="cell-sub" style={{ marginTop: 8 }}>
                Paying to {settings.upi_name || settings.school_name}
                <br />UPI ID: {settings.upi_id}
              </div>
            </div>
          </div>
        )}

        {!isPaid && !settings.upi_id && !isParent && (
          <div className="notice info no-print" style={{ marginTop: 20, marginBottom: 0 }}>
            No payment QR code yet. An admin can add the school&apos;s UPI ID under Settings.
          </div>
        )}

        {settings.invoice_note && (
          <p style={{ marginTop: 20, marginBottom: 0, color: "var(--muted)", fontSize: 13 }}>{settings.invoice_note}</p>
        )}
      </div>
    </>
  );
}
