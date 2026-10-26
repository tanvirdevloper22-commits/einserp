import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/dates";
import { STAFF_STATUSES } from "@/lib/staff-attendance";
import PageHeader from "@/components/PageHeader";
import { saveStaffAttendance } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff attendance" };

export default async function StaffAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; saved?: string; error?: string }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const today = todayISO();
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today ? sp.date : today;
  const supabase = await createClient();

  const { data: staff, error: staffError } = await supabase
    .from("staff")
    .select("id, employee_no, full_name, designation")
    .eq("status", "active")
    .order("full_name");
  const { data: att, error: attError } = await supabase
    .from("staff_attendance")
    .select("staff_id, status, note")
    .eq("date", date);

  const existing = new Map((att ?? []).map((a) => [a.staff_id as string, a]));
  const people = staff ?? [];
  const marked = people.filter((s) => existing.has(s.id)).length;

  return (
    <>
      <PageHeader title="Staff attendance" description="Mark who is present, late, on leave or absent for a day.">
        <Link className="btn ghost" href="/staff/attendance/report">Monthly report</Link>
        <Link className="btn ghost" href="/staff">Back to staff</Link>
      </PageHeader>

      {sp.saved && <div className="notice ok">Attendance saved for {formatDate(date)}.</div>}
      {sp.error && <div className="error">{sp.error}</div>}
      {(staffError || attError) && (
        <div className="error">
          The staff attendance table is missing. Run supabase/012_staff.sql and then supabase/013_staff_attendance.sql in the Supabase SQL Editor.
        </div>
      )}

      <form method="get" className="card toolbar">
        <div className="row">
          <div>
            <label htmlFor="date">Date</label>
            <input id="date" name="date" type="date" max={today} defaultValue={date} />
          </div>
          <button className="btn ghost">Load</button>
        </div>
      </form>

      <form action={saveStaffAttendance} className="card flush">
        <input type="hidden" name="date" value={date} />
        {people.length > 0 && (
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", color: "var(--muted)", fontSize: 13 }}>
            {people.length} active staff
            {marked > 0 ? `, attendance already saved for ${marked}` : ", attendance not saved yet for this date"}
          </div>
        )}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Employee no.</th><th>Name</th><th>Status</th><th>Note</th></tr></thead>
            <tbody>
              {people.map((s) => {
                const row = existing.get(s.id);
                return (
                  <tr key={s.id}>
                    <td>{s.employee_no}</td>
                    <td>
                      <span className="strong">{s.full_name}</span>
                      {s.designation && <span className="cell-sub">{s.designation}</span>}
                    </td>
                    <td>
                      <div className="seg">
                        {STAFF_STATUSES.map((o) => (
                          <label key={o.value}>
                            <input type="radio" name={`status_${s.id}`} value={o.value} defaultChecked={(row?.status ?? "present") === o.value} />
                            <span className={o.cls}>{o.label}</span>
                          </label>
                        ))}
                      </div>
                    </td>
                    <td>
                      <input name={`note_${s.id}`} maxLength={200} defaultValue={row?.note ?? ""} placeholder="Optional" style={{ minWidth: 160 }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!people.length && !staffError && (
          <div className="empty">
            <strong>No active staff</strong>
            Add staff members on the Staff page first.
          </div>
        )}
        {people.length > 0 && (
          <div style={{ padding: 16, borderTop: "1px solid var(--border)" }}>
            <button className="btn">Save attendance</button>
          </div>
        )}
      </form>
    </>
  );
}
