import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Students" };

async function addStudent(formData: FormData) {
  "use server";
  await requireRole(["admin"]);
  const supabase = await createClient();
  const text = (k: string) => String(formData.get(k) ?? "").trim() || null;
  await supabase.from("students").insert({
    admission_no: String(formData.get("admission_no")).trim(),
    full_name: String(formData.get("full_name")).trim(),
    dob: text("dob"),
    gender: text("gender"),
    guardian_name: text("guardian_name"),
    guardian_phone: text("guardian_phone"),
    address: text("address"),
    class_id: text("class_id"),
  });
  revalidatePath("/students");
}

async function removeStudent(formData: FormData) {
  "use server";
  await requireRole(["admin"]);
  const supabase = await createClient();
  await supabase.from("students").delete().eq("id", String(formData.get("id")));
  revalidatePath("/students");
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const { role } = await requireRole(STAFF_ROLES);
  const isAdmin = role === "admin";
  const { class: classFilter } = await searchParams;
  const supabase = await createClient();

  const { data: classes } = await supabase.from("classes").select("*").order("name");
  let q = supabase
    .from("students")
    .select("id, admission_no, full_name, guardian_name, guardian_phone, status, classes(name, section)")
    .order("full_name");
  if (classFilter) q = q.eq("class_id", classFilter);
  const { data: students } = await q;

  return (
    <>
      <PageHeader
        title="Students"
        description={isAdmin ? "Admit new students and manage existing records." : "Student records by class."}
      />

      {isAdmin && (
        <form action={addStudent} className="card" style={{ marginBottom: 24 }}>
          <h2>New admission</h2>
          <div className="form-grid">
            <div><label htmlFor="admission_no">Admission number</label><input id="admission_no" name="admission_no" required /></div>
            <div><label htmlFor="full_name">Full name</label><input id="full_name" name="full_name" required /></div>
            <div>
              <label htmlFor="class_id">Class</label>
              <select id="class_id" name="class_id" defaultValue="">
                <option value="">Select a class</option>
                {classes?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
                ))}
              </select>
            </div>
            <div><label htmlFor="dob">Date of birth</label><input id="dob" name="dob" type="date" /></div>
            <div>
              <label htmlFor="gender">Gender</label>
              <select id="gender" name="gender" defaultValue="">
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div><label htmlFor="guardian_name">Guardian name</label><input id="guardian_name" name="guardian_name" /></div>
            <div><label htmlFor="guardian_phone">Guardian phone</label><input id="guardian_phone" name="guardian_phone" type="tel" /></div>
            <div><label htmlFor="address">Address</label><input id="address" name="address" /></div>
          </div>
          <div className="form-actions"><button className="btn">Add student</button></div>
        </form>
      )}

      <form className="card toolbar" method="get">
        <div className="row">
          <div className="grow" style={{ maxWidth: 280 }}>
            <label htmlFor="class">Filter by class</label>
            <select id="class" name="class" defaultValue={classFilter ?? ""}>
              <option value="">All classes</option>
              {classes?.map((c) => (
                <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
              ))}
            </select>
          </div>
          <button className="btn ghost">Apply</button>
          {classFilter && <Link className="btn ghost" href="/students">Clear</Link>}
        </div>
      </form>

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Admission no.</th><th>Student</th><th>Class</th><th>Guardian</th><th>Status</th>
                {isAdmin && <th />}
              </tr>
            </thead>
            <tbody>
              {students?.map((s) => {
                const cls = Array.isArray(s.classes) ? s.classes[0] : s.classes;
                return (
                  <tr key={s.id}>
                    <td>{s.admission_no}</td>
                    <td className="strong">{s.full_name}</td>
                    <td>{cls ? `${cls.name} - ${cls.section}` : "Not assigned"}</td>
                    <td>
                      {s.guardian_name ?? "-"}
                      {s.guardian_phone && <span className="cell-sub">{s.guardian_phone}</span>}
                    </td>
                    <td><span className={`badge ${s.status === "active" ? "ok" : "neutral"}`}>{s.status === "active" ? "Active" : "Left"}</span></td>
                    {isAdmin && (
                      <td>
                        <div className="row tight" style={{ justifyContent: "flex-end" }}>
                          <Link className="btn ghost small" href={`/students/${s.id}/edit`}>Edit</Link>
                          <form action={removeStudent}>
                            <input type="hidden" name="id" value={s.id} />
                            <button className="btn danger small">Delete</button>
                          </form>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!students?.length && (
          <div className="empty">
            <strong>No students found</strong>
            {isAdmin ? "Add the first admission using the form above." : "Students will appear here once they are admitted."}
          </div>
        )}
      </div>
    </>
  );
}
