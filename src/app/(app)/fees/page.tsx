import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

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

  // Student chuna ho to sirf us par, warna poori class par fee lagayein
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

  const nameOf = new Map((students ?? []).map((s) => [s.id, `${s.full_name} (${s.admission_no})`]));
  const rows = (balances ?? []).filter((b) => (pending ? Number(b.due) > 0 : true));

  return (
    <>
      <div className="header-row">
        <div>
          <h1>Fees</h1>
          <p className="sub" style={{ marginBottom: 0 }}>Fee lagayein, payment jama karein aur receipt nikaalein</p>
        </div>
        <div className="row">
          <Link className="btn ghost small" href="/fees/structure">Fee structure</Link>
          <Link className="btn ghost small" href="/fees/defaulters">Defaulters</Link>
        </div>
      </div>

      <form action={addFee} className="card" style={{ marginBottom: 18 }}>
        <h2>Add fee</h2>
        <div className="form-grid">
          <div>
            <label>Student (optional)</label>
            <select name="student_id" defaultValue="">
              <option value="">Poori class par lagayein</option>
              {students?.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name} ({s.admission_no})</option>
              ))}
            </select>
          </div>
          <div>
            <label>Class (agar student nahi chuna)</label>
            <select name="class_id" defaultValue="">
              <option value="">Select</option>
              {classes?.map((c) => (
                <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
              ))}
            </select>
          </div>
          <div><label>Title</label><input name="title" placeholder="Tuition Oct 2026" required /></div>
          <div><label>Amount (₹)</label><input name="amount" type="number" min="0" step="0.01" required /></div>
          <div><label>Due date</label><input name="due_date" type="date" /></div>
        </div>
        <div style={{ marginTop: 14 }}><button className="btn">Add fee</button></div>
      </form>

      <div className="header-row">
        <h2 style={{ margin: 0 }}>Fee ledger</h2>
        <div className="row">
          <Link className={`btn small ${pending ? "ghost" : ""}`} href="/fees">All</Link>
          <Link className={`btn small ${pending ? "" : "ghost"}`} href="/fees?pending=1">Pending only</Link>
        </div>
      </div>

      <div className="card">
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
              return (
                <tr key={b.fee_id}>
                  <td>{nameOf.get(b.student_id) ?? "-"}</td>
                  <td>{b.title}</td>
                  <td>{b.due_date ?? "-"}</td>
                  <td className="num">{inr(Number(b.amount))}</td>
                  <td className="num">{inr(Number(b.paid))}</td>
                  <td className="num">
                    <span className={`badge ${due > 0 ? "warn" : "ok"}`}>{due > 0 ? inr(due) : "Paid"}</span>
                  </td>
                  <td>
                    {due > 0 ? (
                      <form action={recordPayment} className="row" style={{ gap: 6 }}>
                        <input type="hidden" name="fee_id" value={b.fee_id} />
                        <input name="amount" type="number" min="1" max={due} step="0.01" defaultValue={due} style={{ width: 96 }} required />
                        <select name="mode" style={{ width: 84 }} defaultValue="cash">
                          <option value="cash">Cash</option>
                          <option value="upi">UPI</option>
                          <option value="bank">Bank</option>
                          <option value="cheque">Cheque</option>
                        </select>
                        <button className="btn small">Pay</button>
                      </form>
                    ) : (
                      <Link className="btn ghost small" href={`/fees/receipts/${b.fee_id}`}>Receipts</Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <div className="empty">Koi fee record nahi hai.</div>}
      </div>
    </>
  );
}
