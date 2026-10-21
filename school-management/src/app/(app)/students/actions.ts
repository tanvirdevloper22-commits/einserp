"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { STUDENT_BUCKET, PHOTO_PATH, ID_PROOF_PATH, type StudentInput } from "@/lib/students";

type Result = { ok: true } | { error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE = /^[0-9+\-\s]{7,15}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Creates (mode "create") or updates (mode "update") a student. The id is generated in the browser so files can be named after it. */
export async function saveStudent(mode: "create" | "update", id: string, input: StudentInput): Promise<Result> {
  await requireRole(["admin"]);
  if (!UUID.test(id)) return { error: "Something went wrong with this form. Reload the page and try again." };

  const t = (v: string) => (v ?? "").trim();
  const row = {
    admission_no: t(input.admission_no),
    full_name: t(input.full_name),
    dob: t(input.dob) || null,
    gender: t(input.gender) || null,
    class_id: t(input.class_id) || null,
    admission_date: t(input.admission_date) || todayISO(),
    blood_group: t(input.blood_group) || null,
    previous_school: t(input.previous_school) || null,
    father_name: t(input.father_name) || null,
    mother_name: t(input.mother_name) || null,
    guardian_name: t(input.guardian_name) || null,
    guardian_phone: t(input.guardian_phone) || null,
    alternate_phone: t(input.alternate_phone) || null,
    guardian_email: t(input.guardian_email) || null,
    address: t(input.address) || null,
    id_proof_type: t(input.id_proof_type) || null,
    id_proof_number: t(input.id_proof_number) || null,
    status: input.status === "left" ? "left" : "active",
  };

  if (!row.admission_no) return { error: "Enter the admission number." };
  if (!row.full_name) return { error: "Enter the student's full name." };
  if (mode === "create") {
    if (!row.class_id) return { error: "Select the class the student is joining." };
    if (!row.dob) return { error: "Enter the date of birth." };
    if (!row.gender) return { error: "Select the gender." };
    if (!row.guardian_name) return { error: "Enter the parent or guardian's name." };
    if (!row.guardian_phone) return { error: "Enter the parent or guardian's phone number." };
    if (!row.id_proof_type) return { error: "Select which ID proof is being submitted." };
  }
  if (row.guardian_phone && !PHONE.test(row.guardian_phone)) return { error: "The guardian phone number does not look right." };
  if (row.alternate_phone && !PHONE.test(row.alternate_phone)) return { error: "The alternate phone number does not look right." };
  if (row.guardian_email && !EMAIL.test(row.guardian_email)) return { error: "The email address does not look right." };

  const supabase = await createClient();
  const { error } =
    mode === "create"
      ? await supabase.from("students").insert({ id, ...row })
      : await supabase.from("students").update(row).eq("id", id);

  if (error) {
    if (error.code === "23505") return { error: `Admission number ${row.admission_no} is already used by another student.` };
    if (/column .* does not exist|schema cache/i.test(error.message)) {
      return { error: "The database is missing the new admission fields. Run supabase/005_admission_files.sql in the Supabase SQL Editor first." };
    }
    return { error: error.message };
  }

  revalidatePath("/students");
  return { ok: true };
}

/** Records the storage paths of the uploaded photo and ID proof on the student. Paths must match this student's own files. */
export async function attachStudentFiles(
  id: string,
  files: { photo?: boolean; idProof?: "jpg" | "pdf" }
): Promise<Result> {
  await requireRole(["admin"]);
  if (!UUID.test(id)) return { error: "Invalid student." };

  const update: Record<string, string> = {};
  if (files.photo) update.photo_path = PHOTO_PATH(id);
  if (files.idProof === "jpg" || files.idProof === "pdf") update.id_proof_path = ID_PROOF_PATH(id, files.idProof);
  if (!Object.keys(update).length) return { ok: true };

  const supabase = await createClient();
  const { error } = await supabase.from("students").update(update).eq("id", id);
  if (error) return { error: error.message };

  // If the ID proof changed between image and PDF, remove the old copy so no stale file is left behind.
  if (files.idProof) {
    const other = ID_PROOF_PATH(id, files.idProof === "jpg" ? "pdf" : "jpg");
    await supabase.storage.from(STUDENT_BUCKET).remove([other]);
  }

  revalidatePath("/students");
  return { ok: true };
}

/** Deletes a student along with their stored photo and ID proof. */
export async function deleteStudent(formData: FormData): Promise<void> {
  await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;

  const supabase = await createClient();
  const { data: s } = await supabase.from("students").select("photo_path, id_proof_path").eq("id", id).maybeSingle();
  const paths = [s?.photo_path, s?.id_proof_path].filter((p): p is string => Boolean(p));
  if (paths.length) await supabase.storage.from(STUDENT_BUCKET).remove(paths);

  await supabase.from("students").delete().eq("id", id);
  revalidatePath("/students");
}
