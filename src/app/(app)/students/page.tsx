import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { STUDENT_BUCKET } from "@/lib/students";
import { PAGE_SIZE, cleanSearch, pageRange, parsePage } from "@/lib/pagination";
import PageHeader from "@/components/PageHeader";
import Pagination from "@/components/Pagination";
import { deleteStudent } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Students" };

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; q?: string; page?: string; error?: string }>;
}) {
  const { role } = await requireRole(STAFF_ROLES);
  const isAdmin = role === "admin";
  const { class: classFilter, q: rawQuery, page: rawPage, error: notice } = await searchParams;
  const search = cleanSearch(rawQuery);
  const page = parsePage(rawPage);
  const { from, to } = pageRange(page);
  const supabase = await createClient();

  const { data: classes } = await supabase.from("classes").select("*").order("name");
  let q = supabase
    .from("students")
    .select("id, admission_no, full_name, guardian_name, guardian_phone, status, photo_path, id_proof_path, classes(name, section)", { count: "exact" })
    .order("full_name")
    .order("id")
    .range(from, to);
  if (classFilter) q = q.eq("class_id", classFilter);
  if (search) q = q.or(`full_name.ilike.%${search}%,admission_no.ilike.%${search}%,guardian_phone.ilike.%${search}%,guardian_name.ilike.%${search}%`);
  const { data: students, count } = await q;
  const total = count ?? students?.length ?? 0;

  // Signed links for the small photos. If the storage migration has not been run yet this simply yields no photos.
  const photoUrl = new Map<string, string>();
  const paths = (students ?? []).map((s) => s.photo_path).filter((p): p is string => Boolean(p));
  if (paths.length) {
    const { data: signed } = await supabase.storage.from(STUDENT_BUCKET).createSignedUrls(paths, 3600);
    signed?.forEach((s) => {
      if (s.path && s.signedUrl) photoUrl.set(s.path, s.signedUrl);
    });
  }

  return (
    <>
      <PageHeader
        title="Students"
        description={isAdmin ? "Admit new students and manage existing records." : "Student records by class."}
      >
        {isAdmin && <Link className="btn ghost" href="/promotion">Promote class</Link>}
        {isAdmin && <Link className="btn ghost" href="/students/id-cards">ID cards</Link>}
        {isAdmin && <Link className="btn" href="/students/new">New admission</Link>}
      </PageHeader>

      {notice && <div className="error">{notice}</div>}

      <form className="card toolbar" method="get">
        <div className="row">
          <div className="grow" style={{ maxWidth: 320 }}>
            <label htmlFor="q">Search</label>
            <input id="q" name="q" type="search" defaultValue={search} placeholder="Name, admission no. or phone" />
          </div>
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
          {(classFilter || search) && <Link className="btn ghost" href="/students">Clear</Link>}
        </div>
      </form>

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th><th>Admission no.</th><th>Class</th><th>Guardian</th><th>Status</th>
                {isAdmin && <th />}
              </tr>
            </thead>
            <tbody>
              {students?.map((s) => {
                const cls = one(s.classes);
                const src = s.photo_path ? photoUrl.get(s.photo_path) : undefined;
                return (
                  <tr key={s.id}>
                    <td>
                      <div className="person">
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="avatar" src={src} alt="" width={36} height={36} />
                        ) : (
                          <span className="avatar" aria-hidden="true">{initials(s.full_name)}</span>
                        )}
                        <span className="strong">{s.full_name}</span>
                      </div>
                    </td>
                    <td>{s.admission_no}</td>
                    <td>{cls ? `${cls.name} - ${cls.section}` : "Not assigned"}</td>
                    <td>
                      {s.guardian_name ?? "-"}
                      {s.guardian_phone && <span className="cell-sub">{s.guardian_phone}</span>}
                    </td>
                    <td><span className={`badge ${s.status === "active" ? "ok" : "neutral"}`}>{s.status === "active" ? "Active" : "Left"}</span></td>
                    {isAdmin && (
                      <td>
                        <div className="row tight" style={{ justifyContent: "flex-end" }}>
                          <Link className="btn ghost small" href={`/students/${s.id}/admission-form`}>Admission form</Link>
                          {s.id_proof_path && (
                            <a className="btn ghost small" href={`/students/${s.id}/id-proof`} target="_blank" rel="noopener noreferrer">ID proof</a>
                          )}
                          <Link className="btn ghost small" href={`/students/id-cards?student=${s.id}`}>ID card</Link>
                          <Link className="btn ghost small" href={`/certificates/new?student=${s.id}`}>Certificate</Link>
                          <Link className="btn ghost small" href={`/students/${s.id}/edit`}>Edit</Link>
                          <form action={deleteStudent}>
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
            {search || classFilter ? "Try a different search or clear the filters." : isAdmin ? "Use New admission to add the first student." : "Students will appear here once they are admitted."}
          </div>
        )}
        <Pagination basePath="/students" params={{ class: classFilter, q: search }} page={page} total={total} size={PAGE_SIZE} />
      </div>
    </>
  );
}
