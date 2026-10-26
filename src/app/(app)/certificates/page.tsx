import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { CERT_TYPES, certNumber, certType } from "@/lib/certificates";
import { PAGE_SIZE, cleanSearch, pageRange, parsePage } from "@/lib/pagination";
import PageHeader from "@/components/PageHeader";
import Pagination from "@/components/Pagination";
import ConfirmButton from "@/components/ConfirmButton";
import { deleteCertificate } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Certificates" };

export default async function CertificatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; page?: string }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const search = cleanSearch(sp.q);
  const type = CERT_TYPES.some((t) => t.value === sp.type) ? String(sp.type) : "";
  const page = parsePage(sp.page);
  const { from, to } = pageRange(page);
  const supabase = await createClient();

  let q = supabase
    .from("certificates")
    .select("id, cert_type, cert_no, student_name, admission_no, class_name, issued_on, issued_by_name", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, to);
  if (type) q = q.eq("cert_type", type);
  if (search) q = q.or(`student_name.ilike.%${search}%,admission_no.ilike.%${search}%`);
  const { data: rows, count, error } = await q;
  const total = count ?? rows?.length ?? 0;

  return (
    <>
      <PageHeader title="Certificates" description="Transfer, bonafide and character certificates issued by the school.">
        <Link className="btn" href="/certificates/new">Issue a certificate</Link>
      </PageHeader>

      {error && (
        <div className="error">
          The certificates table is missing. Run supabase/015_certificates.sql in the Supabase SQL Editor first.
        </div>
      )}

      <form className="card toolbar" method="get">
        <div className="row">
          <div className="grow" style={{ maxWidth: 320 }}>
            <label htmlFor="q">Search</label>
            <input id="q" name="q" type="search" defaultValue={search} placeholder="Student name or admission no." />
          </div>
          <div className="grow" style={{ maxWidth: 260 }}>
            <label htmlFor="type">Type</label>
            <select id="type" name="type" defaultValue={type}>
              <option value="">All types</option>
              {CERT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.title}</option>)}
            </select>
          </div>
          <button className="btn ghost">Apply</button>
          {(search || type) && <Link className="btn ghost" href="/certificates">Clear</Link>}
        </div>
      </form>

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Number</th><th>Type</th><th>Student</th><th>Class</th><th>Issued on</th><th>Issued by</th><th /></tr>
            </thead>
            <tbody>
              {rows?.map((r) => (
                <tr key={r.id}>
                  <td className="strong">{certNumber(r.cert_type, r.cert_no)}</td>
                  <td>{certType(r.cert_type)?.title ?? r.cert_type}</td>
                  <td>
                    <span className="strong">{r.student_name}</span>
                    <span className="cell-sub">{r.admission_no}</span>
                  </td>
                  <td>{r.class_name ?? "-"}</td>
                  <td>{formatDate(r.issued_on)}</td>
                  <td>{r.issued_by_name ?? "-"}</td>
                  <td>
                    <div className="row tight" style={{ justifyContent: "flex-end" }}>
                      <Link className="btn ghost small" href={`/certificates/${r.id}`}>View / print</Link>
                      <form action={deleteCertificate}>
                        <input type="hidden" name="id" value={r.id} />
                        <ConfirmButton
                          className="btn danger small"
                          message={`Delete ${certNumber(r.cert_type, r.cert_no)}? This cannot be undone.`}
                        >
                          Delete
                        </ConfirmButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows?.length && !error && (
          <div className="empty">
            <strong>No certificates yet</strong>
            {search || type ? "Try a different search or clear the filters." : "Use Issue a certificate to create the first one."}
          </div>
        )}
        <Pagination basePath="/certificates" params={{ q: search, type }} page={page} total={total} size={PAGE_SIZE} />
      </div>
    </>
  );
}
