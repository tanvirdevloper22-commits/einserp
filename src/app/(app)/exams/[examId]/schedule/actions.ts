"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { INSTRUCTIONS_MAX } from "@/lib/admit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const MISSING = "The date sheet tables are missing. Run supabase/021_exam_schedule.sql in the Supabase SQL Editor first.";
const explain = (m: string) => (/exam_papers|instructions|schema cache|does not exist/i.test(m) ? MISSING : m);

function go(examId: string, qs: string): never {
  return redirect(`/exams/${examId}/schedule?${qs}`);
}

/** Adds one paper to the date sheet of every ticked class. A paper that already exists for a class is updated instead. */
export async function addPapers(formData: FormData) {
  await requireRole(["admin"]);
  const examId = String(formData.get("exam_id") ?? "");
  if (!UUID.test(examId)) return redirect("/exams");
  const fail = (m: string): never => go(examId, `error=${encodeURIComponent(m)}`);

  const classIds = [...new Set(formData.getAll("class_id").map(String))].filter((c) => UUID.test(c));
  const subjectId = String(formData.get("subject_id") ?? "");
  const date = String(formData.get("paper_date") ?? "");
  const start = String(formData.get("start_time") ?? "");
  const end = String(formData.get("end_time") ?? "");

  if (!classIds.length) fail("Tick at least one class.");
  if (!UUID.test(subjectId)) fail("Choose the subject.");
  if (!DATE.test(date)) fail("Choose the date of the paper.");
  if (start && !TIME.test(start)) fail("The start time is not valid.");
  if (end && !TIME.test(end)) fail("The end time is not valid.");
  if (start && end && end <= start) fail("The end time must be after the start time.");

  const supabase = await createClient();
  const { error } = await supabase.from("exam_papers").upsert(
    classIds.map((class_id) => ({ exam_id: examId, class_id, subject_id: subjectId, paper_date: date, start_time: start || null, end_time: end || null })),
    { onConflict: "exam_id,class_id,subject_id" },
  );
  if (error) fail(explain(error.message));
  revalidatePath(`/exams/${examId}/schedule`);
  return go(examId, `added=${classIds.length}`);
}

export async function deletePaper(formData: FormData) {
  await requireRole(["admin"]);
  const examId = String(formData.get("exam_id") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(examId) || !UUID.test(id)) return;
  const supabase = await createClient();
  await supabase.from("exam_papers").delete().eq("id", id).eq("exam_id", examId);
  revalidatePath(`/exams/${examId}/schedule`);
  const back = String(formData.get("back") ?? "");
  return go(examId, back);
}

export async function saveInstructions(formData: FormData) {
  await requireRole(["admin"]);
  const examId = String(formData.get("exam_id") ?? "");
  if (!UUID.test(examId)) return redirect("/exams");
  const text = String(formData.get("instructions") ?? "").trim();
  if (text.length > INSTRUCTIONS_MAX) return go(examId, `error=${encodeURIComponent(`The instructions can be at most ${INSTRUCTIONS_MAX} characters.`)}`);
  const supabase = await createClient();
  const { error } = await supabase.from("exams").update({ instructions: text || null }).eq("id", examId);
  if (error) return go(examId, `error=${encodeURIComponent(explain(error.message))}`);
  revalidatePath(`/exams/${examId}/schedule`);
  return go(examId, "saved=1");
}
