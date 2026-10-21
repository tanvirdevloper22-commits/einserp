import type { SupabaseClient } from "@supabase/supabase-js";
import { computeResults } from "@/lib/grades";

export type ClassStudent = {
  id: string;
  admission_no: string;
  full_name: string;
  dob: string | null;
  guardian_name: string | null;
  photo_path: string | null;
};

/** Everything needed to show a class's results for one exam: students, the subjects that have marks, and computed results. */
export async function loadClassResults(supabase: SupabaseClient, examId: string, classId: string) {
  const { data: studentRows } = await supabase
    .from("students")
    .select("id, admission_no, full_name, dob, guardian_name, photo_path")
    .eq("class_id", classId)
    .eq("status", "active")
    .order("full_name");
  const students = (studentRows ?? []) as ClassStudent[];

  const { data: marks } = students.length
    ? await supabase
        .from("marks")
        .select("student_id, subject_id, marks_obtained, max_marks")
        .eq("exam_id", examId)
        .in("student_id", students.map((s) => s.id))
    : { data: [] };

  const { data: allSubjects } = await supabase.from("subjects").select("id, name").order("name");
  const used = new Set((marks ?? []).map((m) => m.subject_id as string));
  const subjects = (allSubjects ?? []).filter((s) => used.has(s.id));

  const results = computeResults(students.map((s) => s.id), marks ?? []);
  const ranked = [...results.values()].filter((r) => r.rank !== null).length;
  return { students, subjects, results, ranked };
}
