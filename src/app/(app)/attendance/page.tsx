import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function saveAttendance(formData: FormData) {
  "use server";
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
  { value: "present", label: "P", cls: "p" },
  { value: "absent", label: "A", cls: "a" },
  { value: "late", label: "L", cls: "l" },
  { value: "leave", label: "Leave", cls: "v" },
];

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; date?: string }>;
}) {
  const sp = await searchParams;
  const date = sp.date ?? new Date().toISOString().slice(0, 10);
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

  return (
    <>
      <h1>Attendance</h1>
      <p className="sub">Class aur date chunein, phir har student ki attendance mark karein</p>

      <form method="get" className="row card" style={{ marginBottom: 18 }}>
        <div className="grow">
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
      </form>

      <form action={saveAttendance} className="card">
        <input type="hidden" name="date" value={date} />
        <table>
          <thead><tr><th>Adm. no.</th><th>Name</th><th>Status</th></tr></thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>{s.admission_no}</td>
                <td>{s.full_name}</td>
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
        {!students.length && <div className="empty">Is class mein koi active student nahi hai.</div>}
        {students.length > 0 && (
          <div style={{ marginTop: 14 }}><button className="btn">Save attendance</button></div>
        )}
      </form>
    </>
  );
}
