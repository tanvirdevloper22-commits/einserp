import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole, STAFF_ROLES } from "@/lib/auth";

export const dynamic = "force-dynamic";

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
      <div className="header-row">
        <div>
          <h1>Students</h1>
          <p className="sub">Admission aur student records</p>
        </div>
        <form className="row" method="get">
          <div>
            <label htmlFor="class">Class</label>
            <select id="class" name="class" defaultValue={classFilter ?? ""}>
              <option value="">All classes</option>
              {classes?.map((c) => (
                <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
              ))}
            </select>
          </div>
          <button className="btn ghost">Filter</button>
        </form>
      </div>

      {isAdmin && (
      <form action={addStudent} className="card" style={{ marginBottom: 18 }}>
        <h2>New admission</h2>
        <div className="form-grid">
          <div><label>Admission no.</label><input name="admission_no" required /></div>
          <div><label>Full name</label><input name="full_name" required /></div>
          <div>
            <label>Class</label>
            <select name="class_id" defaultValue="">
              <option value="">Select</option>
              {classes?.map((c) => (
                <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
              ))}
            </select>
          </div>
          <div><label>Date of birth</label><input name="dob" type="date" /></div>
          <div>
            <label>Gender</label>
            <select name="gender" defaultValue="">
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div><label>Guardian name</label><input name="guardian_name" /></div>
          <div><label>Guardian phone</label><input name="guardian_phone" type="tel" /></div>
          <div><label>Address</label><input name="address" /></div>
        </div>
        <div style={{ marginTop: 14 }}><button className="btn">Add student</button></div>
      </form>
      )}

      <div className="card">
        <table>
          <thead>
            <tr><th>Adm. no.</th><th>Name</th><th>Class</th><th>Guardian</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {students?.map((s) => {
              const cls = Array.isArray(s.classes) ? s.classes[0] : s.classes;
              return (
                <tr key={s.id}>
                  <td>{s.admission_no}</td>
                  <td>{s.full_name}</td>
                  <td>{cls ? `${cls.name} - ${cls.section}` : "-"}</td>
                  <td>{s.guardian_name ?? "-"}{s.guardian_phone ? ` (${s.guardian_phone})` : ""}</td>
                  <td><span className={`badge ${s.status === "active" ? "ok" : "neutral"}`}>{s.status}</span></td>
                  <td className="num">
                    {isAdmin && (
                      <form action={removeStudent}>
                        <input type="hidden" name="id" value={s.id} />
                        <button className="btn ghost small">Delete</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!students?.length && <div className="empty">Koi student nahi mila. Upar se admission add karein.</div>}
      </div>
    </>
  );
}
