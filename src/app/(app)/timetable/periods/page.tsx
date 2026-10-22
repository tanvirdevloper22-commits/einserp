import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Period timings" };

const fail = (m: string): never => redirect(`/timetable/periods?error=${encodeURIComponent(m)}`);
const hhmm = (v: string | null | undefined) => (v ?? "").slice(0, 5);

async function savePeriods(formData: FormData) {
  "use server";
  await requireRole(["admin"]);
  const supabase = await createClient();

  const rows: { period_no: number; start_time: string; end_time: string; is_break: boolean; label: string | null }[] = [];
  const removed: number[] = [];
  for (let n = 1; n <= 12; n++) {
    const start = String(formData.get(`start_${n}`) ?? "");
    const end = String(formData.get(`end_${n}`) ?? "");
    if (formData.get(`remove_${n}`)) { removed.push(n); continue; }
    if (!start && !end) continue;
    if (!start || !end) fail(`Period ${n} needs both a start and an end time.`);
    if (end <= start) fail(`Period ${n} must end after it starts.`);
    rows.push({
      period_no: n, start_time: start, end_time: end,
      is_break: Boolean(formData.get(`break_${n}`)),
      label: String(formData.get(`label_${n}`) ?? "").trim() || null,
    });
  }
  const sorted = [...rows].sort((a, b) => a.period_no - b.period_no);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start_time < sorted[i - 1].end_time) fail(`Period ${sorted[i].period_no} starts before period ${sorted[i - 1].period_no} ends.`);
  }

  if (rows.length) {
    const { error } = await supabase.from("timetable_periods").upsert(rows, { onConflict: "period_no" });
    if (error) fail(`The timings could not be saved: ${error.message}`);
  }
  if (removed.length) {
    const { error } = await supabase.from("timetable_periods").delete().in("period_no", removed);
    if (error) fail(`A period could not be removed: ${error.message}`);
  }
  revalidatePath("/timetable");
  redirect("/timetable/periods?saved=1");
}

export default async function PeriodsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: periods, error } = await supabase.from("timetable_periods").select("*").order("period_no");
  const byNo = new Map((periods ?? []).map((p) => [p.period_no as number, p]));
  const nextFree = Array.from({ length: 12 }, (_, i) => i + 1).find((n) => !byNo.has(n));
  const shown = [...(periods ?? []).map((p) => p.period_no as number), ...(nextFree ? [nextFree] : [])];

  return (
    <>
      <PageHeader title="Period timings" description="The school day, period by period. Mark a row as a break for lunch or recess.">
        <Link className="btn ghost" href="/timetable">Back to timetable</Link>
      </PageHeader>

      {error && <div className="error">The timetable tables are missing. Run supabase/007_timetable.sql in the Supabase SQL Editor first.</div>}
      {sp.error && <div className="error">{sp.error}</div>}
      {sp.saved && <div className="notice ok">Period timings saved.</div>}

      <form action={savePeriods} className="card flush">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Period</th><th>Starts</th><th>Ends</th><th>Name (optional)</th><th>Break</th><th>Remove</th></tr></thead>
            <tbody>
              {shown.map((n) => {
                const p = byNo.get(n);
                return (
                  <tr key={n}>
                    <td className="strong">{p ? `Period ${n}` : `Add period ${n}`}</td>
                    <td><input type="time" name={`start_${n}`} defaultValue={hhmm(p?.start_time)} /></td>
                    <td><input type="time" name={`end_${n}`} defaultValue={hhmm(p?.end_time)} /></td>
                    <td><input name={`label_${n}`} defaultValue={p?.label ?? ""} placeholder={p?.is_break ? "Break" : ""} /></td>
                    <td><input type="checkbox" name={`break_${n}`} defaultChecked={p?.is_break ?? false} style={{ width: "auto" }} /></td>
                    <td>{p ? <input type="checkbox" name={`remove_${n}`} style={{ width: "auto" }} aria-label={`Remove period ${n}`} /> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: 16, borderTop: "1px solid var(--border)" }}>
          <button className="btn">Save timings</button>
          <span className="cell-sub" style={{ display: "inline", marginLeft: 12 }}>Removing a period also removes it from every class&apos;s timetable.</span>
        </div>
      </form>
    </>
  );
}
