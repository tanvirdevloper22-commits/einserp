import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { todayISO, formatDate } from "@/lib/dates";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payments" };

const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export default async function PaymentsPage() {
  await requireRole(["admin", "accountant"]);
  const supabase = await createClient();
  const today = todayISO();
  const monthStart = today.slice(0, 8) + "01";

  const [{ data: payments, error }, { data: monthRows }] = await Promise.all([
    supabase
      .from("payments")
      .select("id, receipt_no, amount, paid_on, mode, fee_id, fees(title, students(full_name, admission_no))")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("payments").select("amount, paid_on").gte("paid_on", monthStart),
  ]);

  const sum = (rows: { amount: number | string }[]) => rows.reduce((s, r) => s + Number(r.amount), 0);
  const month = monthRows ?? [];
  const collectedToday = sum(month.filter((r) => r.paid_on === today));
  const collectedMonth = sum(month);

  return (
    <>
      <PageHeader title="Payments" description="Every payment recorded, newest first.">
        <Link className="btn ghost" href="/fees">Back to fees</Link>
      </PageHeader>

      {error && <div className="error">Payments could not be loaded: {error.message}</div>}

      <div className="grid stats">
        <div className="card stat"><span className="label">Collected today</span><span className="value">{inr(collectedToday)}</span></div>
        <div className="card stat"><span className="label">Collected this month</span><span className="value">{inr(collectedMonth)}</span></div>
      </div>

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Receipt no.</th><th>Date</th><th>Student</th><th>Fee</th><th>Mode</th><th className="num">Amount</th><th /></tr>
            </thead>
            <tbody>
              {payments?.map((p) => {
                const fee = one(p.fees);
                const stu = fee ? one(fee.students) : null;
                return (
                  <tr key={p.id}>
                    <td>#{p.receipt_no}</td>
                    <td>{formatDate(p.paid_on)}</td>
                    <td>
                      <span className="strong">{stu?.full_name ?? "-"}</span>
                      {stu && <span className="cell-sub">{stu.admission_no}</span>}
                    </td>
                    <td>{fee?.title ?? "-"}</td>
                    <td style={{ textTransform: "uppercase" }}>{p.mode}</td>
                    <td className="num strong">{inr(Number(p.amount))}</td>
                    <td className="num">
                      <Link className="btn ghost small" href={`/fees/receipt/${p.id}`}>Receipt</Link>{" "}
                      <Link className="btn ghost small" href={`/fees/invoice/${p.fee_id}`}>Invoice</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!payments?.length && (
          <div className="empty">
            <strong>No payments yet</strong>
            Payments you record on the Fees page will be listed here.
          </div>
        )}
      </div>
    </>
  );
}
