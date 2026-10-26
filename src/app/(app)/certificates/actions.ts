"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { getSettings } from "@/lib/settings";
import { CERT_TYPES, CONDUCT_OPTIONS } from "@/lib/certificates";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

function explain(message: string): string {
  return /relation .*certificates.* does not exist|schema cache/i.test(message)
    ? "The certificates table is missing. Run supabase/015_certificates.sql in the Supabase SQL Editor first."
    : message;
}

/** Issues a certificate: copies the student's details into a new numbered record, then opens it for printing. */
export async function issueCertificate(formData: FormData) {
  const me = await requireRole(["admin"]);
  const studentId = String(formData.get("student_id") ?? "");
  const type = String(formData.get("cert_type") ?? "");
  const back = (error: string): never =>
    redirect(`/certificates/new?student=${UUID.test(studentId) ? studentId : ""}&type=${type}&error=${encodeURIComponent(error)}`);

  if (!UUID.test(studentId)) return redirect("/certificates/new");
  if (!CERT_TYPES.some((t) => t.value === type)) return back("Choose the type of certificate.");

  const t = (key: string, max = 300) => String(formData.get(key) ?? "").trim().slice(0, max);
  const issuedOn = t("issued_on") || todayISO();
  const leavingDate = t("leaving_date");
  const reason = t("reason");
  const conduct = t("conduct");
  const purpose = t("purpose");
  const remarks = t("remarks", 500);
  const markLeft = formData.get("mark_left") === "on";
  const override = formData.get("override_dues") === "on";

  if (!DATE.test(issuedOn) || issuedOn > todayISO()) return back("The issue date cannot be in the future.");
  if (leavingDate && !DATE.test(leavingDate)) return back("The date of leaving does not look right.");
  if (conduct && !CONDUCT_OPTIONS.includes(conduct)) return back("Choose the conduct from the list.");
  if (type === "transfer") {
    if (!leavingDate) return back("Enter the date of leaving.");
    if (!reason) return back("Enter the reason for leaving.");
    if (!conduct) return back("Choose the student's conduct.");
  }
  if (type === "character" && !conduct) return back("Choose the student's conduct.");

  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("id, admission_no, full_name, dob, gender, father_name, mother_name, guardian_name, admission_date, status, classes(name, section)")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return back("That student could not be found.");

  // A TC is normally withheld until fees are cleared; the admin can still issue it by confirming.
  let duesCleared: boolean | null = null;
  if (type === "transfer") {
    const { data: balances } = await supabase.from("fee_balances").select("due").eq("student_id", studentId).gt("due", 0);
    const due = (balances ?? []).reduce((s, b) => s + Number(b.due), 0);
    duesCleared = due <= 0;
    if (!duesCleared && !override) {
      return back(`This student still has ${inr(due)} of unpaid fees. Collect it, or tick "Issue anyway" to override.`);
    }
  }

  const cls = one(student.classes);
  const settings = await getSettings();
  const base = {
    cert_type: type,
    student_id: student.id,
    issued_on: issuedOn,
    student_name: student.full_name,
    admission_no: student.admission_no,
    father_name: student.father_name || null,
    mother_name: student.mother_name || null,
    guardian_name: student.guardian_name || null,
    dob: student.dob || null,
    gender: student.gender || null,
    class_name: cls ? `${cls.name} - ${cls.section}` : null,
    admission_date: student.admission_date || null,
    session_label: settings.session_label || null,
    leaving_date: leavingDate || null,
    reason: reason || null,
    conduct: conduct || null,
    purpose: purpose || null,
    remarks: remarks || null,
    dues_cleared: duesCleared,
    issued_by: me.id,
    issued_by_name: me.fullName || me.email,
  };

  // Next running number for this type. If two people issue at the same moment the unique key rejects one, and we try again.
  let id: string | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < 4 && !id; attempt++) {
    const { data: last } = await supabase
      .from("certificates")
      .select("cert_no")
      .eq("cert_type", type)
      .order("cert_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data, error } = await supabase
      .from("certificates")
      .insert({ ...base, cert_no: (last?.cert_no ?? 0) + 1 })
      .select("id")
      .single();
    if (data) id = data.id as string;
    else lastError = error?.message ?? "";
  }
  if (!id) return back(explain(lastError) || "The certificate could not be saved. Please try again.");

  if (type === "transfer" && markLeft && student.status !== "left") {
    await supabase.from("students").update({ status: "left" }).eq("id", studentId);
    revalidatePath("/students");
  }

  revalidatePath("/certificates");
  redirect(`/certificates/${id}?issued=1`);
}

export async function deleteCertificate(formData: FormData) {
  await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  await supabase.from("certificates").delete().eq("id", id);
  revalidatePath("/certificates");
}
