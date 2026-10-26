import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { monthBounds, monthLabel, parseMonth, workedDays } from "@/lib/staff-attendance";
import PageHeader from "@/components/PageHeader";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff attendance report" };

const PAGE = 1000; // Supabase returns at most this many rows per request, so a month for many staff is read in pages.

export default async function StaffAttendanceReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const month = parseMonth(sp.month, todayISO().slice(0, 7));
  const { start, end, days } = monthBounds(month);
  const supabase = await createClient();

  const { data: staff, error } = await supabase
    .from("staff")
    .select("id, employee_no, full_name, designation, status")
    .order("full_name");

  const counts = new Map<string, Record<string, number>>();
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .from("staff_attendance")
      .select("staff_id, status")
      .gte("date", start)
      .lte("date", end)
      .order("id")
      .range(from, from + PAGE - 1);
    for (const r of data ?? []) {
      const c = counts.get(r.staff_id as string) ?? {};
      c[r.status as string] = (c[r.status as string] ?? 0) + 1;
      counts.set(r.staff_id as string, c);
    }
    if (!data || data.length < PAGE) break;
  }

  // Show active staff, plus anyone who has left but still has attendance in this month.
  const rows = (staff ?? []).filter((s) => s.status === "active" || counts.has(s.id));

  return (
    <>
      <PageHeader title="Staff attendance report" description={`${monthLabel(month)} (${days} days)`}>
        <Link className="btn ghost" href="/staff/attendance">Mark attendance</Link>
        <PrintButton />
      </PageHeader>

      {error && (
        <div className="error">
          The staff attendance table is missing. Run supabase/013_staff_attendance.sql in the Supabase SQL Editor first.
        </div>
      )}

      <form method="get" className="card toolbar no-print">
        <div className="row">
          <div>
            <label htmlFor="month">Month</label>
            <input id="month" name="month" type="month" max={todayISO().slice(0, 7)} defaultValue={month} />
          </div>
          <button className="btn ghost">Load</button>
        </div>
      </form>

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee no.</th><th>Name</th><th>Present</th><th>Late</th><th>Half day</th><th>Absent</th><th>Leave</th><th>Not marked</th><th>Days worked</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const c = counts.get(s.id) ?? {};
                const marked = Object.values(c).reduce((a, b) => a + b, 0);
                return (
                  <tr key={s.id}>
                    <td>{s.employee_no}</td>
                    <td>
                      <span className="strong">{s.full_name}</span>
                      {s.designation && <span className="cell-sub">{s.designation}</span>}
                    </td>
                    <td>{c.present ?? 0}</td>
                    <td>{c.late ?? 0}</td>
                    <td>{c.half_day ?? 0}</td>
                    <td>{c.absent ?? 0}</td>
                    <td>{c.leave ?? 0}</td>
                    <td>{Math.max(0, days - marked)}</td>
                    <td className="strong">{workedDays(c)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && !error && (
          <div className="empty">
            <strong>No staff to report</strong>
            Add staff members and mark their attendance first.
          </div>
        )}
        <p className="cell-sub pager-note">Days worked counts present and late as a full day and a half day as 0.5. Leave and absent are not counted.</p>
      </div>
    </>
  );
}
