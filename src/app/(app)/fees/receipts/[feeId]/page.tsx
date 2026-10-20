import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "@/components/PrintButton";
import PageHeader from "@/components/PageHeader";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fee receipt" };

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

export default async function ReceiptsPage({ params }: { params: Promise<{ feeId: string }> }) {
  await requireRole(["admin", "accountant"]);
  const { feeId } = await params;
  const supabase = await createClient();

  const { data: fee } = await supabase
    .from("fees")
    .select("id, title, amount, students(full_name, admission_no, classes(name, section))")
    .eq("id", feeId)
    .single();
  if (!fee) notFound();

  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .eq("fee_id", feeId)
    .order("created_at");

  const student = Array.isArray(fee.students) ? fee.students[0] : fee.students;
  const cls = student ? (Array.isArray(student.classes) ? student.classes[0] : student.classes) : null;
  const paid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const balance = Number(fee.amount) - paid;

  return (
    <>
      <PageHeader title="Fee receipt" description={fee.title}>
        <Link className="btn ghost" href="/fees">Back to fees</Link>
        <PrintButton />
      </PageHeader>

      <div className="card" style={{ maxWidth: 760 }}>
        <div className="form-grid" style={{ marginBottom: 20 }}>
          <div>
            <span className="cell-sub">Student</span>
            <strong>{student?.full_name}</strong>
          </div>
          <div>
            <span className="cell-sub">Admission number</span>
            <strong>{student?.admission_no}</strong>
          </div>
          <div>
            <span className="cell-sub">Class</span>
            <strong>{cls ? `${cls.name} - ${cls.section}` : "Not assigned"}</strong>
          </div>
          <div>
            <span className="cell-sub">Fee amount</span>
            <strong>{inr(Number(fee.amount))}</strong>
          </div>
        </div>

        <div className="table-wrap" style={{ border: "1px solid var(--border)", borderRadius: 8 }}>
          <table>
            <thead>
              <tr><th>Receipt no.</th><th>Date</th><th>Mode</th><th className="num">Amount</th></tr>
            </thead>
            <tbody>
              {payments?.map((p) => (
                <tr key={p.id}>
                  <td>#{p.receipt_no}</td>
                  <td>{p.paid_on}</td>
                  <td style={{ textTransform: "capitalize" }}>{p.mode}</td>
                  <td className="num">{inr(Number(p.amount))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="strong">Total paid</td>
                <td className="num strong">{inr(paid)}</td>
              </tr>
              {balance > 0 && (
                <tr>
                  <td colSpan={3}>Balance due</td>
                  <td className="num">{inr(balance)}</td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}
