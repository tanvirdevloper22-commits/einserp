import { createClient } from "@/lib/supabase/server";

export type Defaulter = {
  studentId: string;
  admissionNo: string;
  name: string;
  className: string;
  guardian: string;
  phone: string;
  feesCount: number;
  totalDue: number;
  overdue: number;
  oldestDue: string | null;
};

/** Unpaid fees grouped by student. When classId is given, only students of that class. */
export async function getDefaulters(classId?: string): Promise<Defaulter[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  let sq = supabase
    .from("students")
    .select("id, admission_no, full_name, guardian_name, guardian_phone, classes(name, section)");
  if (classId) sq = sq.eq("class_id", classId);

  const [{ data: students }, { data: balances }] = await Promise.all([
    sq,
    supabase.from("fee_balances").select("student_id, due, due_date").gt("due", 0),
  ]);

  const byStudent = new Map<string, { count: number; total: number; overdue: number; oldest: string | null }>();
  for (const b of balances ?? []) {
    const cur = byStudent.get(b.student_id) ?? { count: 0, total: 0, overdue: 0, oldest: null };
    cur.count += 1;
    cur.total += Number(b.due);
    if (b.due_date && b.due_date < today) {
      cur.overdue += Number(b.due);
      if (!cur.oldest || b.due_date < cur.oldest) cur.oldest = b.due_date;
    }
    byStudent.set(b.student_id, cur);
  }

  const rows: Defaulter[] = [];
  for (const s of students ?? []) {
    const d = byStudent.get(s.id);
    if (!d) continue;
    const cls = Array.isArray(s.classes) ? s.classes[0] : s.classes;
    rows.push({
      studentId: s.id,
      admissionNo: s.admission_no,
      name: s.full_name,
      className: cls ? `${cls.name} - ${cls.section}` : "-",
      guardian: s.guardian_name ?? "",
      phone: s.guardian_phone ?? "",
      feesCount: d.count,
      totalDue: d.total,
      overdue: d.overdue,
      oldestDue: d.oldest,
    });
  }
  return rows.sort((a, b) => b.totalDue - a.totalDue);
}
