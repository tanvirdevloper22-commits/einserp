import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/dates";
import { SOURCE_LABEL, STATUSES, STATUS_BADGE, STATUS_LABEL, followUpState, type Enquiry } from "@/lib/enquiries";
import { normalizePhone, smsLink, whatsappLink } from "@/lib/reminders";
import PageHeader from "@/components/PageHeader";
import ConfirmButton from "@/components/ConfirmButton";
import { addNote, deleteEnquiry, updateEnquiry } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Enquiry" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EnquiryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ added?: string; saved?: string; error?: string }> }) {
  await requireRole(["admin"]);
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const [{ data }, { data: notes }, { data: school }] = await Promise.all([
    supabase.from("enquiries").select("*").eq("id", id).maybeSingle(),
    supabase.from("enquiry_notes").select("id, body, created_by_name, created_at").eq("enquiry_id", id).order("created_at", { ascending: false }),
    supabase.from("school_settings").select("school_name").eq("id", 1).maybeSingle(),
  ]);
  if (!data) notFound();
  const e = data as Enquiry;
  const today = todayISO();
  const fu = followUpState(e.follow_up_date, e.status, today);
  const phone = normalizePhone(e.phone);
  const hello = `Dear ${e.guardian_name || "Parent"}, thank you for your interest in admission for ${e.child_name}${e.class_applied ? ` (${e.class_applied})` : ""} at ${school?.school_name || "our school"}. Please let us know a convenient time to visit the school.`;
  const canAdmit = e.status !== "admitted";

  return (
    <>
      <PageHeader title={e.child_name} description={`${e.class_applied ? `${e.class_applied} · ` : ""}${SOURCE_LABEL[e.source] ?? e.source} · ${formatDate(e.created_at)}`}>
        <Link className="btn ghost" href="/enquiries">Back to enquiries</Link>
        {canAdmit && <Link className="btn" href={`/students/new?enquiry=${e.id}`}>Admit this student</Link>}
        {e.student_id && <Link className="btn ghost" href={`/students/${e.student_id}/edit`}>Open student</Link>}
      </PageHeader>

      {sp.added && <div className="notice ok">Enquiry saved.</div>}
      {sp.saved && <div className="notice ok">Changes saved.</div>}
      {sp.error && <div className="error">{sp.error}</div>}

      <div className="grid two">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Contact</h2>
          <dl className="kv">
            <div><dt>Parent or guardian</dt><dd>{e.guardian_name || "-"}</dd></div>
            <div><dt>Phone</dt><dd>{e.phone}</dd></div>
            <div><dt>Email</dt><dd>{e.email || "-"}</dd></div>
            <div><dt>Recorded by</dt><dd>{e.created_by_name || "-"}</dd></div>
          </dl>
          {phone ? (
            <div className="row tight" style={{ marginTop: 12 }}>
              <a className="btn small" href={whatsappLink(phone, hello)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
              <a className="btn ghost small" href={smsLink(phone, hello)}>SMS</a>
              <a className="btn ghost small" href={`tel:+${phone}`}>Call</a>
            </div>
          ) : (
            <p className="cell-sub" style={{ marginTop: 12 }}>This phone number could not be read, so the message buttons are off.</p>
          )}
        </div>

        <form action={updateEnquiry} className="card">
          <input type="hidden" name="id" value={e.id} />
          <h2 style={{ marginTop: 0 }}>Status</h2>
          <div className="form-grid one">
            <div>
              <label htmlFor="status">Where is this enquiry?</label>
              <select id="status" name="status" defaultValue={e.status}>{STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
            </div>
            <div>
              <label htmlFor="follow_up_date">Follow up on</label>
              <input id="follow_up_date" name="follow_up_date" type="date" defaultValue={e.follow_up_date ?? ""} />
              {fu === "overdue" && <span className="badge bad" style={{ marginTop: 6 }}>Overdue</span>}
              {fu === "today" && <span className="badge warn" style={{ marginTop: 6 }}>Due today</span>}
            </div>
          </div>
          <div className="form-actions row tight">
            <button className="btn">Save</button>
            <span className={`badge ${STATUS_BADGE[e.status]}`}>{STATUS_LABEL[e.status]}</span>
          </div>
        </form>
      </div>

      <form action={addNote} className="card" style={{ marginTop: 24 }}>
        <input type="hidden" name="id" value={e.id} />
        <h2 style={{ marginTop: 0 }}>History</h2>
        <label htmlFor="body">Add a note</label>
        <textarea id="body" name="body" rows={2} maxLength={500} placeholder="e.g. Called, parent will visit on Saturday" required />
        <div className="form-actions"><button className="btn ghost">Add note</button></div>
        <ul className="timeline">
          {(notes ?? []).map((n) => (
            <li key={n.id}>
              <div>{n.body}</div>
              <span className="cell-sub">{n.created_by_name ?? "-"} · {formatDate(n.created_at)} {new Date(n.created_at as string).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}</span>
            </li>
          ))}
        </ul>
        {!(notes ?? []).length && <p className="cell-sub">No notes yet.</p>}
      </form>

      <form action={deleteEnquiry} style={{ marginTop: 24 }}>
        <input type="hidden" name="id" value={e.id} />
        <ConfirmButton className="btn danger small" message="Delete this enquiry and its history? This cannot be undone.">Delete enquiry</ConfirmButton>
      </form>
    </>
  );
}
