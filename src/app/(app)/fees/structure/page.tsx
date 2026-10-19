import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const FEE_ROLES = ["admin", "accountant"] as const;
const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

async function addItem(formData: FormData) {
  "use server";
  await requireRole([...FEE_ROLES]);
  const supabase = await createClient();
  const { error } = await supabase.from("fee_structures").insert({
    class_id: String(formData.get("class_id")),
    title: String(formData.get("title")).trim(),
    amount: Number(formData.get("amount")),
  });
  if (error) redirect(`/fees/structure?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/fees/structure");
}

async function removeItem(formData: FormData) {
  "use server";
  await requireRole([...FEE_ROLES]);
  const supabase = await createClient();
  await supabase.from("fee_structures").delete().eq("id", String(formData.get("id")));
  revalidatePath("/fees/structure");
}

/** Class ke har fee item ko class ke sab active students par lagata hai; jo pehle se lagi hai use skip karta hai. */
async function generateFees(formData: FormData) {
  "use server";
  await requireRole([...FEE_ROLES]);
  const supabase = await createClient();
  const classId = String(formData.get("class_id"));
  const period = String(formData.get("period")).trim();
  const dueDate = String(formData.get("due_date") ?? "") || null;

  const [{ data: items }, { data: students }] = await Promise.all([
    supabase.from("fee_structures").select("title, amount").eq("class_id", classId),
    supabase.from("students").select("id").eq("class_id", classId).eq("status", "active"),
  ]);
  if (!items?.length) redirect("/fees/structure?error=" + encodeURIComponent("Is class ka koi fee item nahi hai."));
  if (!students?.length) redirect("/fees/structure?error=" + encodeURIComponent("Is class mein koi active student nahi hai."));

  const titles = items.map((i) => `${i.title} - ${period}`);
  const { data: existing } = await supabase
    .from("fees")
    .select("student_id, title")
    .in("student_id", students.map((s) => s.id))
    .in("title", titles);
  const have = new Set((existing ?? []).map((f) => `${f.student_id}|${f.title}`));

  const rows = students.flatMap((s) =>
    items
      .map((i) => ({ student_id: s.id, title: `${i.title} - ${period}`, amount: i.amount, due_date: dueDate }))
      .filter((r) => !have.has(`${r.student_id}|${r.title}`))
  );
  if (rows.length) {
    const { error } = await supabase.from("fees").insert(rows);
    if (error) redirect(`/fees/structure?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/fees");
  redirect(`/fees/structure?generated=${rows.length}&skipped=${students.length * items.length - rows.length}`);
}

export default async function FeeStructurePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; generated?: string; skipped?: string }>;
}) {
  await requireRole([...FEE_ROLES]);
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: classes }, { data: items }] = await Promise.all([
    supabase.from("classes").select("*").order("name"),
    supabase.from("fee_structures").select("id, title, amount, class_id").order("title"),
  ]);
  const classLabel = new Map((classes ?? []).map((c) => [c.id, `${c.name} - ${c.section}`]));
  const sorted = [...(items ?? [])].sort((a, b) =>
    (classLabel.get(a.class_id) ?? "").localeCompare(classLabel.get(b.class_id) ?? "")
  );

  const now = new Date();
  const defaultPeriod = now.toLocaleString("en-US", { month: "short", year: "numeric" });

  return (
    <>
      <div className="header-row">
        <div>
          <h1>Fee structure</h1>
          <p className="sub">Class-wise fee items set karein, phir ek click mein poori class par fee lagayein</p>
        </div>
        <Link className="btn ghost small" href="/fees">← Back to fees</Link>
      </div>

      {sp.error && <div className="error">{sp.error}</div>}
      {sp.generated && (
        <div className="card" style={{ marginBottom: 18, background: "var(--ok-soft)", color: "var(--ok)" }}>
          {sp.generated} fee entries lag gayi{Number(sp.skipped) > 0 ? `, ${sp.skipped} pehle se maujood thi isliye skip hui.` : "."}
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", marginBottom: 18 }}>
        <form action={addItem} className="card">
          <h2>Add fee item</h2>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
            <div>
              <label>Class</label>
              <select name="class_id" required defaultValue="">
                <option value="" disabled>Select</option>
                {classes?.map((c) => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
              </select>
            </div>
            <div><label>Title</label><input name="title" placeholder="Tuition" required /></div>
            <div><label>Amount (₹)</label><input name="amount" type="number" min="0" step="0.01" required /></div>
          </div>
          <div style={{ marginTop: 14 }}><button className="btn">Add item</button></div>
        </form>

        <form action={generateFees} className="card">
          <h2>Generate fees</h2>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
            <div>
              <label>Class</label>
              <select name="class_id" required defaultValue="">
                <option value="" disabled>Select</option>
                {classes?.map((c) => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
              </select>
            </div>
            <div><label>Period</label><input name="period" defaultValue={defaultPeriod} required /></div>
            <div><label>Due date</label><input name="due_date" type="date" /></div>
          </div>
          <p className="sub" style={{ margin: "12px 0 0", fontSize: 13 }}>
            Fee ka title &quot;Tuition - {defaultPeriod}&quot; jaisa banega. Dobara generate karne par duplicate nahi banenge.
          </p>
          <div style={{ marginTop: 14 }}><button className="btn">Generate</button></div>
        </form>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Class</th><th>Fee item</th><th className="num">Amount</th><th /></tr></thead>
          <tbody>
            {sorted.map((i) => (
              <tr key={i.id}>
                <td>{classLabel.get(i.class_id) ?? "-"}</td>
                <td>{i.title}</td>
                <td className="num">{inr(Number(i.amount))}</td>
                <td className="num">
                  <form action={removeItem}>
                    <input type="hidden" name="id" value={i.id} />
                    <button className="btn ghost small">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!sorted.length && <div className="empty">Abhi koi fee item nahi hai. Upar se add karein.</div>}
      </div>
    </>
  );
}
