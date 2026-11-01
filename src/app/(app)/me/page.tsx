import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/dates";
import { inr } from "@/lib/format";
import { STAFF_STATUSES, monthBounds, monthLabel, parseMonth, workedDays } from "@/lib/staff-attendance";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "My work" };

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const shift = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

export default async function MyWorkPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const me = await requireRole(["teacher", "accountant"]);
  const sp = await searchParams;
  const supabase = await createClient();
  const today = todayISO();
  const current = today.slice(0, 7);
  const month = parseMonth(sp.month, current);
  const { start, end, days } = monthBounds(month);

  const { data: staff } = await supabase
    .from("staff")
    .select("id, employee_no, full_name, designation, subjects, joining_date, classes(name, section)")
    .eq("profile_id", me.id)
    .maybeSingle();

  if (!staff) {
    return (
      <>
        <PageHeader title="My work" description="Your attendance and salary slips." />
        <div className="card">
          <p className="sub" style={{ margin: 0 }}>
            Your login is not linked to a staff record yet, so there is nothing to show here. Please ask the school admin to open your record under Staff and choose your login account.
          </p>
        </div>
      </>
    );
  }

  const [{ data: att }, { data: slips }, { data: leaves }] = await Promise.all([
    supabase.from("staff_attendance").select("date, status, note").eq("staff_id", staff.id).gte("date", start).lte("date", end).order("date"),
    supabase.from("payslips").select("id, month, net, status, paid_on, payable_days, days_in_month").eq("staff_id", staff.id).eq("status", "paid").order("month", { ascending: false }).limit(24),
    me.role !== "teacher" ? Promise.resolve({ data: [] as { id: string; from_date: string; to_date: string; status: string }[] }) : supabase.from("leave_requests").select("id, from_date, to_date, status").eq("staff_id", staff.id).order("created_at", { ascending: false }).limit(5),
  ]);

  const counts: Record<string, number> = {};
  (att ?? []).forEach((a) => { counts[a.status as string] = (counts[a.status as string] ?? 0) + 1; });
  const label = (v: string) => STAFF_STATUSES.find((s) => s.value === v);
  const cls = one(staff.classes);

  return (
    <>
      <PageHeader title="My work" description={`${staff.full_name} · ${staff.employee_no}${staff.designation ? ` · ${staff.designation}` : ""}`}>
        {me.role === "teacher" && <Link className="btn ghost" href="/leave">Apply for leave</Link>}
      </PageHeader>

      <div className="card" style={{ marginBottom: 24 }}>
        <dl className="kv">
          <div><dt>Designation</dt><dd style={{ margin: 0 }}>{staff.designation ?? "-"}</dd></div>
          <div><dt>Subjects</dt><dd style={{ margin: 0 }}>{(staff.subjects as string | null) || "-"}</dd></div>
          <div><dt>Class teacher of</dt><dd style={{ margin: 0 }}>{cls ? `${cls.name} - ${cls.section}` : "-"}</dd></div>
          <div><dt>Joined</dt><dd style={{ margin: 0 }}>{staff.joining_date ? formatDate(staff.joining_date as string) : "-"}</dd></div>
        </dl>
      </div>

      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>My attendance · {monthLabel(month)}</h2>
        <div className="row tight">
          <Link className="btn ghost small" href={`/me?month=${shift(month, -1)}`}>Previous</Link>
          {month < current && <Link className="btn ghost small" href={`/me?month=${shift(month, 1)}`}>Next</Link>}
        </div>
      </div>
      <div className="grid stats">
        {STAFF_STATUSES.map((s) => (
          <div key={s.value} className="card stat"><span className="label">{s.label}</span><span className="value">{counts[s.value] ?? 0}</span></div>
        ))}
        <div className="card stat"><span className="label">Days worked</span><span className="value">{workedDays(counts)} <small style={{ fontSize: 14, color: "var(--muted)" }}>of {days}</small></span></div>
      </div>
      <div className="card flush" style={{ margin: "16px 0 24px" }}>
        {(att ?? []).length === 0 ? <p className="sub" style={{ padding: 16 }}>No attendance has been marked for this month yet.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Status</th><th>Note</th></tr></thead>
              <tbody>
                {(att ?? []).map((a) => (
                  <tr key={a.date as string}>
                    <td>{new Date(`${a.date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}</td>
                    <td><span className={`badge ${a.status === "present" ? "ok" : a.status === "absent" ? "bad" : "warn"}`}>{label(a.status as string)?.label ?? a.status}</span></td>
                    <td>{(a.note as string | null) ?? <span className="muted">-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <h2 style={{ margin: "0 0 8px" }}>My salary slips</h2>
      <div className="card flush" style={{ marginBottom: 24 }}>
        {(slips ?? []).length === 0 ? <p className="sub" style={{ padding: 16 }}>No paid salary slip yet. A slip appears here once the school marks your salary as paid.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Month</th><th>Paid on</th><th className="num">Net salary</th><th /></tr></thead>
              <tbody>
                {(slips ?? []).map((p) => (
                  <tr key={p.id as string}>
                    <td className="strong">{monthLabel(p.month as string)}</td>
                    <td>{p.paid_on ? formatDate(p.paid_on as string) : "-"}</td>
                    <td className="num">{inr(Number(p.net))}</td>
                    <td className="num"><Link className="btn ghost small" href={`/payroll/slip/${p.id}`}>View slip</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(leaves ?? []).length > 0 && (
        <>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>My recent leave</h2>
            <Link className="btn ghost small" href="/leave">All leave</Link>
          </div>
          <div className="card flush">
            <table>
              <tbody>
                {(leaves ?? []).map((l) => (
                  <tr key={l.id as string}>
                    <td>{l.from_date === l.to_date ? formatDate(l.from_date as string) : `${formatDate(l.from_date as string)} to ${formatDate(l.to_date as string)}`}</td>
                    <td className="num"><span className={`badge ${l.status === "approved" ? "ok" : l.status === "rejected" ? "bad" : "warn"}`}>{String(l.status).replace(/^./, (c) => c.toUpperCase())}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
