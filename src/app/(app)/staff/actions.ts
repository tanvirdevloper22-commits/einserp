"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { readStaffForm, type StaffFormState } from "@/lib/staff";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE = /^[0-9+\-\s]{7,15}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function explain(message: string): string {
  if (/staff_employee_no_key/i.test(message)) return "Another staff member already has this employee number.";
  if (/staff_profile_id_key/i.test(message)) return "That login account is already linked to another staff member.";
  if (/staff_class_teacher_of_key/i.test(message)) return "That class already has a class teacher. Remove them from it first.";
  if (/relation .*staff.* does not exist|schema cache/i.test(message)) {
    return "The staff table is missing. Run supabase/012_staff.sql in the Supabase SQL Editor first.";
  }
  return message;
}

/**
 * Creates (id null) or updates a staff record. It is bound to the record id in the page and used with useActionState,
 * so on a validation error it returns the typed values and the form keeps what the admin entered.
 */
export async function saveStaff(id: string | null, _prev: StaffFormState, formData: FormData): Promise<StaffFormState> {
  await requireRole(["admin"]);
  const v = readStaffForm(formData);
  const bad = (error: string): StaffFormState => ({ error, values: v });

  if (id !== null && !UUID.test(id)) return bad("Something went wrong with this form. Reload the page and try again.");
  if (!v.employee_no) return bad("Enter the employee number.");
  if (!v.full_name) return bad("Enter the full name.");
  if (!["teaching", "non_teaching"].includes(v.staff_type)) return bad("Choose whether this person is teaching or non-teaching staff.");
  if (!["active", "left"].includes(v.status)) return bad("Choose a valid status.");
  if (v.phone && !PHONE.test(v.phone)) return bad("The phone number does not look right.");
  if (v.emergency_phone && !PHONE.test(v.emergency_phone)) return bad("The emergency phone number does not look right.");
  if (v.email && !EMAIL.test(v.email)) return bad("The email address does not look right.");
  if (v.dob && (!DATE.test(v.dob) || v.dob >= todayISO())) return bad("The date of birth must be a past date.");
  if (v.joining_date && !DATE.test(v.joining_date)) return bad("The joining date does not look right.");
  if (v.profile_id && !UUID.test(v.profile_id)) return bad("Choose a login account from the list.");
  if (v.class_teacher_of && !UUID.test(v.class_teacher_of)) return bad("Choose a class from the list.");
  if (v.class_teacher_of && v.staff_type !== "teaching") return bad("Only teaching staff can be a class teacher.");

  const row = {
    employee_no: v.employee_no,
    full_name: v.full_name,
    staff_type: v.staff_type,
    designation: v.designation || null,
    subjects: v.subjects || null,
    phone: v.phone || null,
    email: v.email || null,
    gender: v.gender || null,
    dob: v.dob || null,
    joining_date: v.joining_date || null,
    qualification: v.qualification || null,
    address: v.address || null,
    emergency_name: v.emergency_name || null,
    emergency_phone: v.emergency_phone || null,
    profile_id: v.profile_id || null,
    class_teacher_of: v.class_teacher_of || null,
    status: v.status,
    left_on: v.status === "left" ? todayISO() : null,
    notes: v.notes || null,
  };

  const supabase = await createClient();
  const { error } = id === null
    ? await supabase.from("staff").insert(row)
    : await supabase.from("staff").update(row).eq("id", id);
  if (error) return bad(explain(error.message));

  revalidatePath("/staff");
  redirect(`/staff?saved=${id === null ? "created" : "updated"}`);
}

export async function setStaffStatus(formData: FormData) {
  await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!UUID.test(id) || !["active", "left"].includes(status)) return;
  const supabase = await createClient();
  // A person who has left no longer holds a class.
  await supabase
    .from("staff")
    .update({
      status,
      left_on: status === "left" ? todayISO() : null,
      ...(status === "left" ? { class_teacher_of: null } : {}),
    })
    .eq("id", id);
  revalidatePath("/staff");
}

export async function deleteStaff(formData: FormData) {
  await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  await supabase.from("staff").delete().eq("id", id);
  revalidatePath("/staff");
}
