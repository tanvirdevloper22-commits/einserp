import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/dates";
import { getSettings } from "@/lib/settings";
import { normalizePhone, smsLink, whatsappLink } from "@/lib/reminders";
import { DEFAULT_TEMPLATE, PLACEHOLDERS, TEMPLATE_MAX, renderAbsence } from "@/lib/absence";
import PageHeader from "@/components/PageHeader";
import AlertButtons from "./AlertButtons";
import { saveTemplate } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Absent alerts" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

type Row = {
  student_id: string;
  students:
    | { id: string; full_name: string; admission_no: string; guardian_name: string | null; guardian_phone: string | null; status: string; classes: { name: string; section: string } | { name: string; section: string }[] | null }
    | null;
};

export default async function AbsentPage({ searchParams }: { searchParams: Promise<{ date?: string; class?: string; saved?: string; error?: string }> }) {
  const me = await requireRole(["admin", "teacher"]);
  const sp = await searchParams;
  const today = todayISO();
  const date = sp.date && DATE.test(sp.date) && sp.date <= today ? sp.date : today;
  const classId = sp.class && UUID.test(sp.class) ? sp.class : "";
  const supabase = await createClient();
  const settings = await getSettings();
  const { data: tpl } = await supabase.from("school_settings").select("absent_message").eq("id", 1).maybeSingle();
  const template = (tpl?.absent_message as string | null) ?? "";

  let query = supabase
    .from("attendance")
    .select("student_id, students!inner(id, full_name, admission_no, guardian_name, guardian_phone, status, class_id, classes(name, section))")
    .eq("date", date)
    .eq("status", "absent")
    .eq("students.status", "active")
    .limit(500);
  if (classId) query = query.eq("students.class_id", classId);

  const [{ data, error }, { data: classes }] = await Promise.all([
    query,
    supabase.from("classes").select("id, name, section").order("name").order("section"),
  ]);
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.students).sort((a, b) => a.students!.full_name.localeCompare(b.students!.full_name));

  const ids = rows.map((r) => r.student_id);
  const alerts = new Map<string, { channel: string; by: string | null; at: string }[]>();
  let alertsMissing = false;
  if (ids.length) {
    const { data: a, error: aErr } = await supabase
      .from("absence_alerts")
      .select("student_id, channel, sent_by_name, created_at")
      .eq("alert_date", date)
      .in("student_id", ids)
      .order("created_at", { ascending: false });
    if (aErr) alertsMissing = true;
    for (const x of a ?? []) {
      const list = alerts.get(x.student_id as string) ?? [];
      list.push({ channel: x.channel as string, by: x.sent_by_name as string | null, at: x.created_at as string });
      alerts.set(x.student_id as string, list);
    }
  }

  const back = new URLSearchParams({ date, ...(classId ? { class: classId } : {}) }).toString();
  const dateLabel = formatDate(date);
  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
  const alertedCount = rows.filter((r) => alerts.has(r.student_id)).length;

  return (
    <>
      <PageHeader title="Absent alerts" description="Send a WhatsApp message or SMS to the parents of students who were absent.">
        <Link className="btn ghost" href="/attendance">Back to attendance</Link>
      </PageHeader>

      {sp.saved && <div className="notice ok">Message saved.</div>}
      {sp.error && <div className="error">{sp.error}</div>}
      {error && <div className="error">The absent list could not be loaded: {error.message}</div>}
      {alertsMissing && (
        <div className="notice info">
          To remember who has already been alerted, run supabase/020_absence_alerts.sql in the Supabase SQL Editor. The buttons still work until then.
        </div>
      )}

      <form method="get" className="card toolbar">
        <div className="row">
          <div>
            <label htmlFor="date">Date</label>
            <input id="date" name="date" type="date" max={today} defaultValue={date} />
          </div>
          <div className="grow" style={{ maxWidth: 260 }}>
            <label htmlFor="class">Class</label>
            <select id="class" name="class" defaultValue={classId}>
              <option value="">All classes</option>
              {(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
            </select>
          </div>
          <button className="btn ghost">Show</button>
        </div>
      </form>

      <div className="notice info">
        Pressing <strong>WhatsApp</strong> or <strong>SMS</strong> opens the app with the message ready; you still press send there. Students with no attendance record are not listed.
        After scanning, use <Link href="/attendance/stats" style={{ textDecoration: "underline" }}>Mark rest absent</Link> first so they appear here.
      </div>

      <div className="card flush" style={{ marginBottom: 24 }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", color: "var(--muted)", fontSize: 13 }}>
          {rows.length} absent on {dateLabel}
          {rows.length > 0 && alertsMissing === false ? `, ${alertedCount} already alerted` : ""}
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Class</th><th>Guardian</th><th>Alert</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => {
                const s = r.students!;
                const cls = one(s.classes);
                const className = cls ? `${cls.name} - ${cls.section}` : "-";
                const phone = normalizePhone(s.guardian_phone);
                const message = renderAbsence(template, {
                  student: s.full_name,
                  guardian: s.guardian_name ?? "",
                  className,
                  date: dateLabel,
                  school: settings.school_name,
                });
                const sent = alerts.get(r.student_id) ?? [];
                const latest = sent[0];
                return (
                  <tr key={r.student_id}>
                    <td><span className="strong">{s.full_name}</span><span className="cell-sub">Adm. no. {s.admission_no}</span></td>
                    <td>{className}</td>
                    <td>{s.guardian_name || "-"}<span className="cell-sub">{s.guardian_phone || "No phone number"}</span></td>
                    <td>
                      {latest ? (
                        <span className="badge ok" title={sent.map((x) => `${x.channel === "whatsapp" ? "WhatsApp" : "SMS"} ${time(x.at)}${x.by ? ` by ${x.by}` : ""}`).join("\n")}>
                          {latest.channel === "whatsapp" ? "WhatsApp" : "SMS"} {time(latest.at)}{sent.length > 1 ? ` +${sent.length - 1}` : ""}
                        </span>
                      ) : (
                        <span className="badge neutral">Not alerted</span>
                      )}
                    </td>
                    <td>
                      {phone ? (
                        <AlertButtons studentId={r.student_id} date={date} whatsapp={whatsappLink(phone, message)} sms={smsLink(phone, message)} />
                      ) : (
                        <span className="badge warn" style={{ float: "right" }}>Add a phone number</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && !error && (
          <div className="empty"><strong>Nobody is marked absent on {dateLabel}</strong>Students marked absent will be listed here.</div>
        )}
      </div>

      {me.role === "admin" && (
        <form action={saveTemplate} className="card">
          <input type="hidden" name="back" value={back} />
          <h2 style={{ marginTop: 0 }}>Message text</h2>
          <p className="sub" style={{ marginTop: -6 }}>
            Parts in curly brackets are filled in for each student: {PLACEHOLDERS.join(" ")}. Leave it empty to use the default text.
          </p>
          <textarea name="absent_message" rows={4} maxLength={TEMPLATE_MAX} defaultValue={template} placeholder={DEFAULT_TEMPLATE} />
          <div className="form-actions"><button className="btn">Save message</button></div>
        </form>
      )}
    </>
  );
}
