import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

export default async function ReceiptsPage({ params }: { params: Promise<{ feeId: string }> }) {
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

  return (
    <>
      <div className="header-row no-print">
        <Link className="btn ghost small" href="/fees">← Back to fees</Link>
        <PrintButton />
      </div>
      <div className="card">
        <h1>Fee receipt</h1>
        <p className="sub">
          {student?.full_name} ({student?.admission_no}){cls ? ` · ${cls.name} - ${cls.section}` : ""}
        </p>
        <h2>{fee.title}: {inr(Number(fee.amount))}</h2>
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
              <td colSpan={3}><strong>Total paid</strong></td>
              <td className="num"><strong>{inr(paid)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
