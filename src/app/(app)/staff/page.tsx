import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { STAFF_TYPE_LABEL } from "@/lib/staff";
import { PAGE_SIZE, cleanSearch, pageRange, parsePage } from "@/lib/pagination";
import PageHeader from "@/components/PageHeader";
import Pagination from "@/components/Pagination";
import ConfirmButton from "@/components/ConfirmButton";
import { deleteStaff, setStaffStatus } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff" };

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; status?: string; page?: string; saved?: string }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const search = cleanSearch(sp.q);
  const type = sp.type === "teaching" || sp.type === "non_teaching" ? sp.type : "";
  const status = sp.status === "left" ? "left" : sp.status === "all" ? "all" : "active";
  const page = parsePage(sp.page);
  const { from, to } = pageRange(page);
  const supabase = await createClient();

  let q = supabase
    .from("staff")
    .select("id, employee_no, full_name, staff_type, designation, subjects, phone, joining_date, status, profile_id, classes(name, section)", { count: "exact" })
    .order("full_name")
    .order("id")
    .range(from, to);
  if (type) q = q.eq("staff_type", type);
  if (status !== "all") q = q.eq("status", status);
  if (search) q = q.or(`full_name.ilike.%${search}%,employee_no.ilike.%${search}%,phone.ilike.%${search}%,designation.ilike.%${search}%,subjects.ilike.%${search}%`);
  const { data: staff, count, error } = await q;
  const total = count ?? staff?.length ?? 0;
  const filtered = Boolean(search || type || status !== "active");

  return (
    <>
      <PageHeader title="Staff" description="Teachers and other school employees.">
        <Link className="btn" href="/staff/new">Add staff member</Link>
      </PageHeader>

      {sp.saved && <div className="notice ok">Staff member {sp.saved === "created" ? "added" : "updated"}.</div>}
      {error && (
        <div className="error">
          The staff table is missing. Run supabase/012_staff.sql in the Supabase SQL Editor first.
        </div>
      )}

      <form className="card toolbar" method="get">
        <div className="row">
          <div className="grow" style={{ maxWidth: 320 }}>
            <label htmlFor="q">Search</label>
            <input id="q" name="q" type="search" defaultValue={search} placeholder="Name, employee no., phone or subject" />
          </div>
          <div className="grow" style={{ maxWidth: 200 }}>
            <label htmlFor="type">Type</label>
            <select id="type" name="type" defaultValue={type}>
              <option value="">All staff</option>
              <option value="teaching">Teaching</option>
              <option value="non_teaching">Non-teaching</option>
            </select>
          </div>
          <div className="grow" style={{ maxWidth: 200 }}>
            <label htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={status}>
              <option value="active">Active</option>
              <option value="left">Left</option>
              <option value="all">All</option>
            </select>
          </div>
          <button className="btn ghost">Apply</button>
          {filtered && <Link className="btn ghost" href="/staff">Clear</Link>}
        </div>
      </form>

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Employee no.</th><th>Type</th><th>Class teacher of</th><th>Phone</th><th>Joined</th><th>Login</th><th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {staff?.map((s) => {
                const cls = one(s.classes);
                const active = s.status === "active";
                return (
                  <tr key={s.id}>
                    <td>
                      <div className="person">
                        <span className="avatar" aria-hidden="true">{initials(s.full_name)}</span>
                        <span>
                          <span className="strong">{s.full_name}</span>
                          {(s.designation || s.subjects) && (
                            <span className="cell-sub">{[s.designation, s.subjects].filter(Boolean).join(" · ")}</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td>{s.employee_no}</td>
                    <td>{STAFF_TYPE_LABEL[s.staff_type] ?? s.staff_type}</td>
                    <td>{cls ? `${cls.name} - ${cls.section}` : "-"}</td>
                    <td>{s.phone ?? "-"}</td>
                    <td>{formatDate(s.joining_date)}</td>
                    <td><span className={`badge ${s.profile_id ? "ok" : "neutral"}`}>{s.profile_id ? "Linked" : "None"}</span></td>
                    <td><span className={`badge ${active ? "ok" : "neutral"}`}>{active ? "Active" : "Left"}</span></td>
                    <td>
                      <div className="row tight" style={{ justifyContent: "flex-end" }}>
                        <Link className="btn ghost small" href={`/staff/${s.id}/edit`}>Edit</Link>
                        <form action={setStaffStatus}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="status" value={active ? "left" : "active"} />
                          <ConfirmButton
                            className="btn ghost small"
                            message={active ? `Mark ${s.full_name} as having left the school?` : `Mark ${s.full_name} as active again?`}
                          >
                            {active ? "Mark left" : "Reactivate"}
                          </ConfirmButton>
                        </form>
                        <form action={deleteStaff}>
                          <input type="hidden" name="id" value={s.id} />
                          <ConfirmButton className="btn danger small" message={`Delete ${s.full_name}? This removes their record permanently.`}>
                            Delete
                          </ConfirmButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!staff?.length && !error && (
          <div className="empty">
            <strong>No staff found</strong>
            {filtered ? "Try a different search or clear the filters." : "Use Add staff member to create the first record."}
          </div>
        )}
        <Pagination basePath="/staff" params={{ q: search, type, status: status === "active" ? "" : status }} page={page} total={total} size={PAGE_SIZE} />
      </div>
    </>
  );
}
