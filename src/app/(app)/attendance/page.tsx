import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import { todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Attendance" };

async function saveAttendance(formData: FormData) {
  "use server";
  await requireRole(["admin", "teacher"]);
  const supabase = await createClient();
  const date = String(formData.get("date"));
  const rows: { student_id: string; date: string; status: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("status_")) {
      rows.push({ student_id: key.slice(7), date, status: String(value) });
    }
  }
  if (rows.length) {
    await supabase.from("attendance").upsert(rows, { onConflict: "student_id,date" });
  }
  revalidatePath("/attendance");
}

const options = [
  { value: "present", label: "Present", cls: "p" },
  { value: "absent", label: "Absent", cls: "a" },
  { value: "late", label: "Late", cls: "l" },
  { value: "leave", label: "Leave", cls: "v" },
];

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; date?: string }>;
}) {
  await requireRole(["admin", "teacher"]);
  const sp = await searchParams;
  const date = sp.date ?? todayISO();
  const supabase = await createClient();

  const { data: classes } = await supabase.from("classes").select("*").order("name");
  const classId = sp.class ?? classes?.[0]?.id;

  let students: { id: string; admission_no: string; full_name: string }[] = [];
  const existing = new Map<string, string>();
  if (classId) {
    const { data } = await supabase
      .from("students")
      .select("id, admission_no, full_name")
      .eq("class_id", classId)
      .eq("status", "active")
      .order("full_name");
    students = data ?? [];
    if (students.length) {
      const { data: att } = await supabase
        .from("attendance")
        .select("student_id, status")
        .eq("date", date)
        .in("student_id", students.map((s) => s.id));
      att?.forEach((a) => existing.set(a.student_id, a.status));
    }
  }

  const marked = students.filter((s) => existing.has(s.id)).length;

  return (
    <>
      <PageHeader title="Attendance" description="Choose a class and date, then mark each student.">
        <Link className="btn ghost" href="/attendance/absent">Absent alerts</Link>
        <Link className="btn ghost" href="/attendance/stats">Today&apos;s numbers</Link>
        <Link className="btn" href="/attendance/scan">Scan QR codes</Link>
      </PageHeader>

      <form method="get" className="card toolbar">
        <div className="row">
          <div className="grow" style={{ maxWidth: 280 }}>
            <label htmlFor="class">Class</label>
            <select id="class" name="class" defaultValue={classId}>
              {classes?.map((c) => (
                <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="date">Date</label>
            <input id="date" name="date" type="date" defaultValue={date} />
          </div>
          <button className="btn ghost">Load</button>
        </div>
      </form>

      <form action={saveAttendance} className="card flush">
        <input type="hidden" name="date" value={date} />
        {students.length > 0 && (
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", color: "var(--muted)", fontSize: 13 }}>
            {students.length} students
            {marked > 0 ? `, attendance already saved for ${marked}` : ", attendance not saved yet for this date"}
          </div>
        )}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Admission no.</th><th>Student</th><th>Status</th></tr></thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.admission_no}</td>
                  <td className="strong">{s.full_name}</td>
                  <td>
                    <div className="seg">
                      {options.map((o) => (
                        <label key={o.value}>
                          <input
                            type="radio"
                            name={`status_${s.id}`}
                            value={o.value}
                            defaultChecked={(existing.get(s.id) ?? "present") === o.value}
                          />
                          <span className={o.cls}>{o.label}</span>
                        </label>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!students.length && (
          <div className="empty">
            <strong>No active students in this class</strong>
            Assign students to this class from the Students page.
          </div>
        )}
        {students.length > 0 && (
          <div style={{ padding: 16, borderTop: "1px solid var(--border)" }}>
            <button className="btn">Save attendance</button>
          </div>
        )}
      </form>
    </>
  );
}
