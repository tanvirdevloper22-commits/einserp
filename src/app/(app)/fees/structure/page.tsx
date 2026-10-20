import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fee structure" };

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

/** Applies every fee item of a class to all active students in it, skipping fees that already exist. */
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
  if (!items?.length) redirect("/fees/structure?error=" + encodeURIComponent("This class has no fee items yet. Add one first."));
  if (!students?.length) redirect("/fees/structure?error=" + encodeURIComponent("This class has no active students."));

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

  const defaultPeriod = new Date().toLocaleString("en-US", { month: "short", year: "numeric" });

  return (
    <>
      <PageHeader
        title="Fee structure"
        description="Define the fee items for each class, then generate them for every student in one step."
      >
        <Link className="btn ghost" href="/fees">Back to fees</Link>
      </PageHeader>

      {sp.error && <div className="error">{sp.error}</div>}
      {sp.generated && (
        <div className="notice ok">
          {sp.generated} fee {Number(sp.generated) === 1 ? "entry was" : "entries were"} created
          {Number(sp.skipped) > 0 ? `. ${sp.skipped} already existed and were skipped.` : "."}
        </div>
      )}

      <div className="grid two">
        <form action={addItem} className="card">
          <h2>Add a fee item</h2>
          <div className="form-grid one">
            <div>
              <label htmlFor="item_class">Class</label>
              <select id="item_class" name="class_id" required defaultValue="">
                <option value="" disabled>Select a class</option>
                {classes?.map((c) => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
              </select>
            </div>
            <div><label htmlFor="item_title">Title</label><input id="item_title" name="title" placeholder="Tuition" required /></div>
            <div><label htmlFor="item_amount">Amount (₹)</label><input id="item_amount" name="amount" type="number" min="0" step="0.01" required /></div>
          </div>
          <div className="form-actions"><button className="btn">Add item</button></div>
        </form>

        <form action={generateFees} className="card">
          <h2>Generate fees for a class</h2>
          <div className="form-grid one">
            <div>
              <label htmlFor="gen_class">Class</label>
              <select id="gen_class" name="class_id" required defaultValue="">
                <option value="" disabled>Select a class</option>
                {classes?.map((c) => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
              </select>
            </div>
            <div><label htmlFor="gen_period">Period</label><input id="gen_period" name="period" defaultValue={defaultPeriod} required /></div>
            <div><label htmlFor="gen_due">Due date</label><input id="gen_due" name="due_date" type="date" /></div>
          </div>
          <p style={{ margin: "14px 0 0", fontSize: 13, color: "var(--muted)" }}>
            Fees are titled like &quot;Tuition - {defaultPeriod}&quot;. Running this again will not create duplicates.
          </p>
          <div className="form-actions"><button className="btn">Generate fees</button></div>
        </form>
      </div>

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Class</th><th>Fee item</th><th className="num">Amount</th><th /></tr></thead>
            <tbody>
              {sorted.map((i) => (
                <tr key={i.id}>
                  <td>{classLabel.get(i.class_id) ?? "-"}</td>
                  <td className="strong">{i.title}</td>
                  <td className="num">{inr(Number(i.amount))}</td>
                  <td className="num">
                    <form action={removeItem}>
                      <input type="hidden" name="id" value={i.id} />
                      <button className="btn danger small">Delete</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!sorted.length && (
          <div className="empty">
            <strong>No fee items yet</strong>
            Add the first fee item for a class using the form above.
          </div>
        )}
      </div>
    </>
  );
}
