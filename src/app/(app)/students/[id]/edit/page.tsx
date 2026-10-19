import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function updateStudent(formData: FormData) {
  "use server";
  await requireRole(["admin"]);
  const supabase = await createClient();
  const text = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const id = String(formData.get("id"));

  const { error } = await supabase
    .from("students")
    .update({
      admission_no: String(formData.get("admission_no")).trim(),
      full_name: String(formData.get("full_name")).trim(),
      dob: text("dob"),
      gender: text("gender"),
      guardian_name: text("guardian_name"),
      guardian_phone: text("guardian_phone"),
      address: text("address"),
      class_id: text("class_id"),
      status: String(formData.get("status")) === "left" ? "left" : "active",
    })
    .eq("id", id);

  if (error) redirect(`/students/${id}/edit?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/students");
  redirect("/students");
}

export default async function EditStudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole(["admin"]);
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: student }, { data: classes }] = await Promise.all([
    supabase.from("students").select("*").eq("id", id).single(),
    supabase.from("classes").select("*").order("name"),
  ]);
  if (!student) notFound();

  return (
    <>
      <div className="header-row">
        <div>
          <h1>Edit student</h1>
          <p className="sub">{student.full_name} ({student.admission_no})</p>
        </div>
        <Link className="btn ghost small" href="/students">← Back to students</Link>
      </div>

      {error && <div className="error">{error}</div>}

      <form action={updateStudent} className="card">
        <input type="hidden" name="id" value={student.id} />
        <div className="form-grid">
          <div><label>Admission no.</label><input name="admission_no" defaultValue={student.admission_no} required /></div>
          <div><label>Full name</label><input name="full_name" defaultValue={student.full_name} required /></div>
          <div>
            <label>Class</label>
            <select name="class_id" defaultValue={student.class_id ?? ""}>
              <option value="">Select</option>
              {classes?.map((c) => (
                <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
              ))}
            </select>
          </div>
          <div><label>Date of birth</label><input name="dob" type="date" defaultValue={student.dob ?? ""} /></div>
          <div>
            <label>Gender</label>
            <select name="gender" defaultValue={student.gender ?? ""}>
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div><label>Guardian name</label><input name="guardian_name" defaultValue={student.guardian_name ?? ""} /></div>
          <div><label>Guardian phone</label><input name="guardian_phone" type="tel" defaultValue={student.guardian_phone ?? ""} /></div>
          <div><label>Address</label><input name="address" defaultValue={student.address ?? ""} /></div>
          <div>
            <label>Status</label>
            <select name="status" defaultValue={student.status}>
              <option value="active">Active</option>
              <option value="left">Left school</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 14 }}><button className="btn">Save changes</button></div>
      </form>
    </>
  );
}
