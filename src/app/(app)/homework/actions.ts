"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { TITLE_MAX, DETAILS_MAX } from "@/lib/homework";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const fail = (message: string): never => redirect(`/homework?error=${encodeURIComponent(message)}`);

function refresh() {
  revalidatePath("/homework");
  revalidatePath("/portal");
}

export async function createHomework(formData: FormData) {
  const me = await requireRole(["admin", "teacher"]);
  const classId = String(formData.get("class_id") ?? "");
  const subjectId = String(formData.get("subject_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "");

  if (!UUID.test(classId)) fail("Choose the class this homework is for.");
  if (subjectId && !UUID.test(subjectId)) fail("Choose a valid subject.");
  if (!title) fail("Enter a title for the homework.");
  if (title.length > TITLE_MAX) fail(`The title can be at most ${TITLE_MAX} characters.`);
  if (details.length > DETAILS_MAX) fail(`The details can be at most ${DETAILS_MAX} characters.`);
  if (dueDate && (!DATE.test(dueDate) || dueDate < todayISO())) fail("The due date must be today or later.");

  const supabase = await createClient();
  const { error } = await supabase.from("homework").insert({
    class_id: classId,
    subject_id: subjectId || null,
    title,
    details: details || null,
    assigned_on: todayISO(),
    due_date: dueDate || null,
    created_by: me.id,
    created_by_name: me.fullName || me.email,
  });
  if (error) {
    fail(
      /relation .*homework.* does not exist|schema cache/i.test(error.message)
        ? "The homework table is missing. Run supabase/018_homework.sql in the Supabase SQL Editor first."
        : error.message,
    );
  }
  refresh();
  redirect("/homework?posted=1");
}

/** Admins can delete any homework; teachers only their own (the database enforces this too). */
export async function deleteHomework(formData: FormData) {
  await requireRole(["admin", "teacher"]);
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  await supabase.from("homework").delete().eq("id", id);
  refresh();
}
