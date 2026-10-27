import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { todayISO, formatDate } from "@/lib/dates";
import { cleanSearch, pageRange, parsePage } from "@/lib/pagination";
import { feeAmounts, groupByStudent, type Concession } from "@/lib/concessions";
import PageHeader from "@/components/PageHeader";
import Pagination from "@/components/Pagination";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fees" };

const MODES = ["cash", "upi", "bank", "cheque"];
const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function fail(message: string): never {
  return redirect(`/fees?error=${encodeURIComponent(message)}`);
}

async function addFee(formData: FormData) {
  "use server";
  await requireRole(["admin", "accountant"]);
  const supabase = await createClient();
  const classId = String(formData.get("class_id") ?? "");
  const studentId = String(formData.get("student_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const dueDate = String(formData.get("due_date") ?? "") || null;

  if (!title) fail("Enter a fee title.");
  if (!(amount > 0)) fail("Enter an amount greater than zero.");
  if (!studentId && !classId) fail("Select a student, or select a class to assign the fee to everyone in it.");

  // A chosen student gets the fee alone; otherwise every active student in the class does.
  let studentIds: string[] = [];
  if (studentId) {
    studentIds = [studentId];
  } else {
    const { data, error } = await supabase
      .from("students")
      .select("id")
      .eq("class_id", classId)
      .eq("status", "active");
    if (error) fail(`Could not load the class: ${error.message}`);
    studentIds = (data ?? []).map((s) => s.id);
    if (!studentIds.length) fail("That class has no active students.");
  }

  // Apply any concessions the students have (none if migration 016 has not been run).
  const { data: concRows } = await supabase
    .from("fee_concessions")
    .select("student_id, kind, mode, value, applies_to")
    .eq("active", true)
    .in("student_id", studentIds);
  const concessions = groupByStudent(concRows ?? []);

  const { error } = await supabase
    .from("fees")
    .insert(studentIds.map((id) => ({
      student_id: id,
      title,
      due_date: dueDate,
      ...feeAmounts(title, amount, (concessions.get(id) ?? []) as Concession[]),
    })));
  if (error) fail(`The fee could not be saved: ${error.message}`);

  revalidatePath("/fees");
  redirect(`/fees?assigned=${studentIds.length}`);
}

async function recordPayment(formData: FormData) {
  "use server";
  await requireRole(["admin", "accountant"]);
  const supabase = await createClient();
  const feeId = String(formData.get("fee_id") ?? "");
  const amount = Math.round(Number(formData.get("amount")) * 100) / 100;
  const mode = String(formData.get("mode") ?? "");

  if (!feeId) fail("Choose a fee.");
  if (!(amount > 0)) fail("Enter a payment amount greater than zero.");
  if (!MODES.includes(mode)) fail("Choose a payment mode.");

  const { data: balance } = await supabase.from("fee_balances").select("due").eq("fee_id", feeId).maybeSingle();
  if (!balance) fail("This fee could not be found.");
  const due = Number(balance!.due);
  if (amount > due + 0.005) fail(`The amount is more than the balance due (${inr(due)}).`);

  const { data: saved, error } = await supabase
    .from("payments")
    .insert({ fee_id: feeId, amount, mode, paid_on: todayISO() })
    .select("id")
    .single();
  if (error || !saved) fail(`The payment could not be saved: ${error?.message ?? "unknown error"}`);

  revalidatePath("/fees");
  revalidatePath("/fees/payments");
  redirect(`/fees?paid=${amount}&fee=${feeId}&receipt=${saved!.id}`);
}

export default async function FeesPage({
  searchParams,
}: {
  searchParams: Promise<{ pending?: string; error?: string; paid?: string; fee?: string; receipt?: string; assigned?: string; q?: string; page?: string }>;
}) {
  await requireRole(["admin", "accountant"]);
  const sp = await searchParams;
  const pending = sp.pending;
  const search = cleanSearch(sp.q);
  const page = parsePage(sp.page);
  const { from, to } = pageRange(page);
  const supabase = await createClient();

  // A search is turned into the matching students first, then only their fees are loaded.
  let matchIds: string[] | null = null;
  if (search) {
    const { data: found } = await supabase
      .from("students")
      .select("id")
      .or(`full_name.ilike.%${search}%,admission_no.ilike.%${search}%`)
      .limit(200);
    matchIds = (found ?? []).map((s) => s.id);
  }

  let ledger = supabase
    .from("fee_balances")
    .select("*", { count: "exact" })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("fee_id")
    .range(from, to);
  if (pending) ledger = ledger.gt("due", 0);
  if (matchIds) ledger = ledger.in("student_id", matchIds.length ? matchIds : ["00000000-0000-0000-0000-000000000000"]);

  const [{ data: classes }, { data: students }, { data: balances, count }] = await Promise.all([
    supabase.from("classes").select("*").order("name"),
    supabase.from("students").select("id, admission_no, full_name").eq("status", "active").order("full_name"),
    ledger,
  ]);

  // Names for this page of the ledger (including students who have since left).
  const pageStudentIds = [...new Set((balances ?? []).map((b) => b.student_id as string))];
  const { data: pageStudents } = pageStudentIds.length
    ? await supabase.from("students").select("id, admission_no, full_name").in("id", pageStudentIds)
    : { data: [] as { id: string; admission_no: string; full_name: string }[] };
  const nameOf = new Map((pageStudents ?? []).map((s) => [s.id, { name: s.full_name, no: s.admission_no }]));
  const rows = balances ?? [];
  const total = count ?? rows.length;

  return (
    <>
      <PageHeader title="Fees" description="Assign fees, collect payments and share invoices.">
        <Link className="btn ghost" href="/fees/payments">Payments</Link>
        <Link className="btn ghost" href="/fees/structure">Fee structure</Link>
        <Link className="btn ghost" href="/fees/concessions">Concessions</Link>
        <Link className="btn ghost" href="/fees/defaulters">Defaulters</Link>
      </PageHeader>

      {sp.error && <div className="error">{sp.error}</div>}
      {sp.paid && (
        <div className="notice ok">
          Payment of {inr(Number(sp.paid))} recorded.
          {sp.receipt && <> <Link href={`/fees/receipt/${sp.receipt}`} style={{ textDecoration: "underline", fontWeight: 600 }}>View receipt</Link></>}
          {sp.fee && <> <Link href={`/fees/invoice/${sp.fee}`} style={{ textDecoration: "underline", fontWeight: 600 }}>View invoice</Link></>}
        </div>
      )}
      {sp.assigned && (
        <div className="notice ok">Fee assigned to {sp.assigned} {Number(sp.assigned) === 1 ? "student" : "students"}.</div>
      )}

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
          <div><label htmlFor="amount">Amount (₹)</label><input id="amount" name="amount" type="number" min="1" step="0.01" required /></div>
          <div><label htmlFor="due_date">Due date</label><input id="due_date" name="due_date" type="date" /></div>
        </div>
        <div className="form-actions"><button className="btn">Assign fee</button></div>
      </form>

      <div className="page-head" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Fee ledger</h2>
        <div className="page-actions">
          <form method="get" className="row tight">
            {pending && <input type="hidden" name="pending" value="1" />}
            <input name="q" type="search" defaultValue={search} placeholder="Search student" aria-label="Search student" style={{ width: 200 }} />
            <button className="btn ghost small">Search</button>
          </form>
          <Link className={`btn small ${pending ? "ghost" : ""}`} href={search ? `/fees?q=${encodeURIComponent(search)}` : "/fees"}>All fees</Link>
          <Link className={`btn small ${pending ? "" : "ghost"}`} href={`/fees?pending=1${search ? `&q=${encodeURIComponent(search)}` : ""}`}>Pending only</Link>
        </div>
      </div>

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th><th>Fee</th><th>Due date</th>
                <th className="num">Amount</th><th className="num">Paid</th><th className="num">Balance</th>
                <th>Collect payment</th><th />
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
                    <td>{formatDate(b.due_date)}</td>
                    <td className="num">{inr(Number(b.amount))}</td>
                    <td className="num">{inr(Number(b.paid))}</td>
                    <td className="num">
                      <span className={`badge ${due > 0 ? "warn" : "ok"}`}>{due > 0 ? inr(due) : "Paid"}</span>
                    </td>
                    <td>
                      {due > 0 ? (
                        <form action={recordPayment} className="row tight">
                          <input type="hidden" name="fee_id" value={b.fee_id} />
                          <input name="amount" type="number" min="0.01" max={due} step="0.01" defaultValue={due} style={{ width: 100 }} aria-label="Payment amount" required />
                          <select name="mode" style={{ width: 90 }} defaultValue="cash" aria-label="Payment mode">
                            <option value="cash">Cash</option>
                            <option value="upi">UPI</option>
                            <option value="bank">Bank</option>
                            <option value="cheque">Cheque</option>
                          </select>
                          <button className="btn small">Record</button>
                        </form>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>Fully paid</span>
                      )}
                    </td>
                    <td className="num">
                      <Link className="btn ghost small" href={`/fees/invoice/${b.fee_id}`}>Invoice</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <div className="empty">
            <strong>{search ? "No fees match your search" : pending ? "No pending fees" : "No fees yet"}</strong>
            {search ? "Try a different name or admission number." : pending ? "Every assigned fee has been paid." : "Assign a fee above, or generate fees from the fee structure."}
          </div>
        )}
        <Pagination basePath="/fees" params={{ pending, q: search }} page={page} total={total} />
      </div>
    </>
  );
}
