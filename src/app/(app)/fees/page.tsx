import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fees" };

async function addFee(formData: FormData) {
  "use server";
  await requireRole(["admin", "accountant"]);
  const supabase = await createClient();
  const classId = String(formData.get("class_id") ?? "");
  const studentId = String(formData.get("student_id") ?? "");
  const base = {
    title: String(formData.get("title")).trim(),
    amount: Number(formData.get("amount")),
    due_date: String(formData.get("due_date") ?? "") || null,
  };

  // If a student is chosen the fee goes to that student only, otherwise to the whole class.
  let studentIds: string[] = [];
  if (studentId) {
    studentIds = [studentId];
  } else if (classId) {
    const { data } = await supabase
      .from("students")
      .select("id")
      .eq("class_id", classId)
      .eq("status", "active");
    studentIds = (data ?? []).map((s) => s.id);
  }
  if (studentIds.length) {
    await supabase.from("fees").insert(studentIds.map((id) => ({ ...base, student_id: id })));
  }
  revalidatePath("/fees");
}

async function recordPayment(formData: FormData) {
  "use server";
  await requireRole(["admin", "accountant"]);
  const supabase = await createClient();
  await supabase.from("payments").insert({
    fee_id: String(formData.get("fee_id")),
    amount: Number(formData.get("amount")),
    mode: String(formData.get("mode")),
  });
  revalidatePath("/fees");
}

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

export default async function FeesPage({
  searchParams,
}: {
  searchParams: Promise<{ pending?: string }>;
}) {
  await requireRole(["admin", "accountant"]);
  const { pending } = await searchParams;
  const supabase = await createClient();

  const [{ data: classes }, { data: students }, { data: balances }] = await Promise.all([
    supabase.from("classes").select("*").order("name"),
    supabase.from("students").select("id, admission_no, full_name").eq("status", "active").order("full_name"),
    supabase.from("fee_balances").select("*").order("due_date", { ascending: true, nullsFirst: false }),
  ]);

  const nameOf = new Map((students ?? []).map((s) => [s.id, { name: s.full_name, no: s.admission_no }]));
  const rows = (balances ?? []).filter((b) => (pending ? Number(b.due) > 0 : true));

  return (
    <>
      <PageHeader title="Fees" description="Assign fees, collect payments and print receipts.">
        <Link className="btn ghost" href="/fees/structure">Fee structure</Link>
        <Link className="btn ghost" href="/fees/defaulters">Defaulters</Link>
      </PageHeader>

      <form action={addFee} className="card" style={{ marginBottom: 24 }}>
        <h2>Assign a fee</h2>
        <div className="form-grid">
          <div>
            <label htmlFor="student_id">Student</label>
            <select id="student_id" name="student_id" defaultValue="">
              <option value="">Whole class (choose a class)</option>
              {students?.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name} ({s.admission_no})</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="class_id">Class (when no student is selected)</label>
            <select id="class_id" name="class_id" defaultValue="">
              <option value="">Select a class</option>
              {classes?.map((c) => (
                <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
              ))}
            </select>
          </div>
          <div><label htmlFor="title">Fee title</label><input id="title" name="title" placeholder="Tuition - Oct 2026" required /></div>
          <div><label htmlFor="amount">Amount (₹)</label><input id="amount" name="amount" type="number" min="0" step="0.01" required /></div>
          <div><label htmlFor="due_date">Due date</label><input id="due_date" name="due_date" type="date" /></div>
        </div>
        <div className="form-actions"><button className="btn">Assign fee</button></div>
      </form>

      <div className="page-head" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Fee ledger</h2>
        <div className="page-actions">
          <Link className={`btn small ${pending ? "ghost" : ""}`} href="/fees">All fees</Link>
          <Link className={`btn small ${pending ? "" : "ghost"}`} href="/fees?pending=1">Pending only</Link>
        </div>
      </div>

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th><th>Fee</th><th>Due date</th>
                <th className="num">Amount</th><th className="num">Paid</th><th className="num">Balance</th>
                <th>Collect payment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const due = Number(b.due);
                const stu = nameOf.get(b.student_id);
                return (
                  <tr key={b.fee_id}>
                    <td>
                      <span className="strong">{stu?.name ?? "-"}</span>
                      {stu && <span className="cell-sub">{stu.no}</span>}
                    </td>
                    <td>{b.title}</td>
                    <td>{b.due_date ?? "-"}</td>
                    <td className="num">{inr(Number(b.amount))}</td>
                    <td className="num">{inr(Number(b.paid))}</td>
                    <td className="num">
                      <span className={`badge ${due > 0 ? "warn" : "ok"}`}>{due > 0 ? inr(due) : "Paid"}</span>
                    </td>
                    <td>
                      {due > 0 ? (
                        <form action={recordPayment} className="row tight">
                          <input type="hidden" name="fee_id" value={b.fee_id} />
                          <input name="amount" type="number" min="1" max={due} step="0.01" defaultValue={due} style={{ width: 100 }} aria-label="Payment amount" required />
                          <select name="mode" style={{ width: 90 }} defaultValue="cash" aria-label="Payment mode">
                            <option value="cash">Cash</option>
                            <option value="upi">UPI</option>
                            <option value="bank">Bank</option>
                            <option value="cheque">Cheque</option>
                          </select>
                          <button className="btn small">Record</button>
                        </form>
                      ) : (
                        <Link className="btn ghost small" href={`/fees/receipts/${b.fee_id}`}>View receipt</Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <div className="empty">
            <strong>{pending ? "No pending fees" : "No fees yet"}</strong>
            {pending ? "Every assigned fee has been paid." : "Assign a fee above, or generate fees from the fee structure."}
          </div>
        )}
      </div>
    </>
  );
}
