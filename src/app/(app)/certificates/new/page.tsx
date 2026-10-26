import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/dates";
import { CERT_TYPES, CONDUCT_OPTIONS, LEAVING_REASONS } from "@/lib/certificates";
import { cleanSearch } from "@/lib/pagination";
import PageHeader from "@/components/PageHeader";
import { issueCertificate } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Issue certificate" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default async function NewCertificatePage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; q?: string; type?: string; error?: string }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const supabase = await createClient();
  const today = todayISO();

  // Step 1: no student chosen yet, so search for one.
  if (!sp.student || !UUID.test(sp.student)) {
    const search = cleanSearch(sp.q);
    let matches: { id: string; admission_no: string; full_name: string; status: string; classes: { name: string; section: string } | { name: string; section: string }[] | null }[] = [];
    if (search) {
      const { data } = await supabase
        .from("students")
        .select("id, admission_no, full_name, status, classes(name, section)")
        .or(`full_name.ilike.%${search}%,admission_no.ilike.%${search}%`)
        .order("full_name")
        .limit(20);
      matches = data ?? [];
    }
    return (
      <>
        <PageHeader title="Issue a certificate" description="First find the student.">
          <Link className="btn ghost" href="/certificates">Back to certificates</Link>
        </PageHeader>
        <form method="get" className="card toolbar">
          <div className="row">
            <div className="grow" style={{ maxWidth: 360 }}>
              <label htmlFor="q">Student name or admission number</label>
              <input id="q" name="q" type="search" defaultValue={search} autoFocus placeholder="Type at least 2 letters" />
            </div>
            <button className="btn">Search</button>
          </div>
        </form>
        {search && (
          <div className="card flush">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Student</th><th>Admission no.</th><th>Class</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {matches.map((s) => {
                    const c = one(s.classes);
                    return (
                      <tr key={s.id}>
                        <td className="strong">{s.full_name}</td>
                        <td>{s.admission_no}</td>
                        <td>{c ? `${c.name} - ${c.section}` : "-"}</td>
                        <td><span className={`badge ${s.status === "active" ? "ok" : "neutral"}`}>{s.status === "active" ? "Active" : "Left"}</span></td>
                        <td style={{ textAlign: "right" }}>
                          <Link className="btn small" href={`/certificates/new?student=${s.id}`}>Select</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!matches.length && <div className="empty"><strong>No student found</strong>Check the spelling or try the admission number.</div>}
          </div>
        )}
      </>
    );
  }

  // Step 2: the student is chosen, so show the certificate form.
  const { data: student } = await supabase
    .from("students")
    .select("id, admission_no, full_name, dob, father_name, mother_name, admission_date, status, classes(name, section)")
    .eq("id", sp.student)
    .maybeSingle();
  if (!student) {
    return (
      <>
        <PageHeader title="Issue a certificate" />
        <div className="error">That student could not be found.</div>
        <Link className="btn ghost" href="/certificates/new">Search again</Link>
      </>
    );
  }
  const { data: balances } = await supabase.from("fee_balances").select("due").eq("student_id", student.id).gt("due", 0);
  const due = (balances ?? []).reduce((s, b) => s + Number(b.due), 0);
  const cls = one(student.classes);
  const type = CERT_TYPES.some((t) => t.value === sp.type) ? String(sp.type) : "bonafide";

  return (
    <>
      <PageHeader title="Issue a certificate" description={`${student.full_name} · ${student.admission_no}${cls ? ` · Class ${cls.name} - ${cls.section}` : ""}`}>
        <Link className="btn ghost" href="/certificates/new">Choose another student</Link>
      </PageHeader>

      {sp.error && <div className="error" role="alert">{sp.error}</div>}
      {student.status === "left" && <div className="notice info">This student is already marked as having left the school.</div>}
      {due > 0 && (
        <div className="notice info">
          This student has {inr(due)} of unpaid fees. A Transfer Certificate will ask you to confirm before it is issued.
        </div>
      )}

      <form action={issueCertificate} className="card">
        <input type="hidden" name="student_id" value={student.id} />
        <div className="form-grid">
          <div>
            <label htmlFor="cert_type">Certificate</label>
            <select id="cert_type" name="cert_type" defaultValue={type}>
              {CERT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="issued_on">Date of issue</label>
            <input id="issued_on" name="issued_on" type="date" max={today} defaultValue={today} />
          </div>
          <div>
            <label htmlFor="conduct">Conduct (TC and Character)</label>
            <select id="conduct" name="conduct" defaultValue="Good">
              <option value="">Not applicable</option>
              {CONDUCT_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="leaving_date">Date of leaving (TC; optional for Character)</label>
            <input id="leaving_date" name="leaving_date" type="date" defaultValue={sp.type === "transfer" ? today : ""} />
          </div>
          <div>
            <label htmlFor="reason">Reason for leaving (TC)</label>
            <input id="reason" name="reason" list="reasons" maxLength={300} placeholder="e.g. Parent's transfer" />
            <datalist id="reasons">{LEAVING_REASONS.map((r) => <option key={r} value={r} />)}</datalist>
          </div>
          <div>
            <label htmlFor="purpose">Purpose (Bonafide and Character, optional)</label>
            <input id="purpose" name="purpose" maxLength={300} placeholder="e.g. Passport application" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="remarks">Remarks (optional)</label>
            <textarea id="remarks" name="remarks" rows={2} maxLength={500} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <input type="checkbox" name="mark_left" style={{ width: "auto", minHeight: 0 }} defaultChecked={sp.type === "transfer"} />
              For a TC: also mark the student as having left the school
            </label>
            {due > 0 && (
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" name="override_dues" style={{ width: "auto", minHeight: 0 }} />
                Issue a TC anyway, even though {inr(due)} is unpaid
              </label>
            )}
          </div>
        </div>
        <p className="sub" style={{ marginTop: 12, marginBottom: 0 }}>
          The student&apos;s name, parents, date of birth (admission date {formatDate(student.admission_date)}) and class are copied onto the certificate
          when it is issued, so editing the student later never changes it.
        </p>
        <div className="form-actions">
          <button className="btn">Issue certificate</button>
          <Link className="btn ghost" href="/certificates">Cancel</Link>
        </div>
      </form>
    </>
  );
}
