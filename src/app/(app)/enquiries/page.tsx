import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/dates";
import { cleanSearch, pageRange, parsePage } from "@/lib/pagination";
import { OPEN_STATUSES, SOURCES, SOURCE_LABEL, STATUSES, STATUS_BADGE, STATUS_LABEL, followUpState, isStatus, type Enquiry } from "@/lib/enquiries";
import PageHeader from "@/components/PageHeader";
import Pagination from "@/components/Pagination";
import { addEnquiry } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admission enquiries" };

type SP = { status?: string; q?: string; due?: string; page?: string; error?: string; deleted?: string };

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const today = todayISO();
  const status = sp.status && isStatus(sp.status) ? sp.status : "";
  const dueOnly = sp.due === "1";
  const search = cleanSearch(sp.q);
  const page = parsePage(sp.page);
  const { from, to } = pageRange(page);
  const supabase = await createClient();

  let q = supabase
    .from("enquiries")
    .select("id, child_name, class_applied, guardian_name, phone, email, source, status, follow_up_date, student_id, created_by_name, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, to);
  if (status) q = q.eq("status", status);
  if (dueOnly) q = q.in("status", OPEN_STATUSES).lte("follow_up_date", today);
  if (search) q = q.or(`child_name.ilike.%${search}%,guardian_name.ilike.%${search}%,phone.ilike.%${search}%`);

  const counts = await Promise.all(
    STATUSES.map((s) => supabase.from("enquiries").select("id", { count: "exact", head: true }).eq("status", s.value).then((r) => r.count ?? 0)),
  );
  const dueCount = await supabase
    .from("enquiries")
    .select("id", { count: "exact", head: true })
    .in("status", OPEN_STATUSES)
    .lte("follow_up_date", today)
    .then((r) => r.count ?? 0);
  const { data, count, error } = await q;
  const rows = (data ?? []) as Enquiry[];
  const total = count ?? rows.length;
  const { data: classes } = await supabase.from("classes").select("name").order("name");
  const classNames = [...new Set((classes ?? []).map((c) => c.name as string))];

  const link = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string> = { status, q: search, due: dueOnly ? "1" : "", ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/enquiries?${s}` : "/enquiries";
  };
  const open = counts.slice(0, 4).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader title="Admission enquiries" description="Keep track of parents who ask about admission, and follow each one until they join." />

      {sp.deleted && <div className="notice ok">Enquiry deleted.</div>}
      {sp.error && <div className="error">{sp.error}</div>}
      {error && <div className="error">The enquiry tables are missing. Run supabase/023_enquiries_and_categories.sql in the Supabase SQL Editor first.</div>}

      <div className="grid stats">
        <div className="card stat"><span className="label">Open enquiries</span><span className="value">{open}</span><span className="hint">still to be decided</span></div>
        <Link className="card stat" href={link({ due: "1", status: "", page: "" })}><span className="label">Follow-up due</span><span className="value">{dueCount}</span><span className="hint">today or overdue</span></Link>
        <div className="card stat"><span className="label">Admitted</span><span className="value">{counts[4]}</span><span className="hint">joined the school</span></div>
        <div className="card stat"><span className="label">Not joining</span><span className="value">{counts[5]}</span><span className="hint">decided against</span></div>
      </div>

      <form action={addEnquiry} className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>New enquiry</h2>
        <div className="form-grid">
          <div><label htmlFor="child_name">Child&apos;s name</label><input id="child_name" name="child_name" required maxLength={100} /></div>
          <div>
            <label htmlFor="class_applied">Class applied for</label>
            <input id="class_applied" name="class_applied" list="class-names" maxLength={40} placeholder="e.g. Class 6" />
            <datalist id="class-names">{classNames.map((n) => <option key={n} value={n} />)}</datalist>
          </div>
          <div><label htmlFor="guardian_name">Parent or guardian</label><input id="guardian_name" name="guardian_name" maxLength={100} /></div>
          <div><label htmlFor="phone">Phone</label><input id="phone" name="phone" type="tel" required maxLength={20} /></div>
          <div><label htmlFor="email">Email (optional)</label><input id="email" name="email" type="email" /></div>
          <div>
            <label htmlFor="source">How did they reach us?</label>
            <select id="source" name="source" defaultValue="walk_in">{SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
          </div>
          <div><label htmlFor="follow_up_date">Follow up on (optional)</label><input id="follow_up_date" name="follow_up_date" type="date" min={today} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label htmlFor="note">Note (optional)</label><textarea id="note" name="note" rows={2} maxLength={500} placeholder="What the parent asked, what was promised" /></div>
        </div>
        <div className="form-actions"><button className="btn">Save enquiry</button></div>
      </form>

      <form method="get" className="card toolbar">
        <div className="row">
          <div className="grow" style={{ maxWidth: 300 }}>
            <label htmlFor="q">Search</label>
            <input id="q" name="q" type="search" defaultValue={search} placeholder="Child, parent or phone" />
          </div>
          <div>
            <label htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={status}>
              <option value="">All</option>
              {STATUSES.map((s, i) => <option key={s.value} value={s.value}>{s.label} ({counts[i]})</option>)}
            </select>
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "0 0 8px" }}>
            <input type="checkbox" name="due" value="1" defaultChecked={dueOnly} style={{ width: "auto", minHeight: 0 }} /> Follow-up due only
          </label>
          <button className="btn ghost">Filter</button>
        </div>
      </form>

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Child</th><th>Class</th><th>Contact</th><th>Source</th><th>Status</th><th>Follow-up</th><th /></tr></thead>
            <tbody>
              {rows.map((e) => {
                const fu = followUpState(e.follow_up_date, e.status, today);
                return (
                  <tr key={e.id}>
                    <td><span className="strong">{e.child_name}</span><span className="cell-sub">Enquired {formatDate(e.created_at)}</span></td>
                    <td>{e.class_applied || "-"}</td>
                    <td>{e.guardian_name || "-"}<span className="cell-sub">{e.phone}</span></td>
                    <td>{SOURCE_LABEL[e.source] ?? e.source}</td>
                    <td><span className={`badge ${STATUS_BADGE[e.status]}`}>{STATUS_LABEL[e.status]}</span></td>
                    <td>
                      {e.follow_up_date ? (
                        <>
                          {formatDate(e.follow_up_date)}
                          {fu === "overdue" && <span className="badge bad" style={{ marginLeft: 6 }}>Overdue</span>}
                          {fu === "today" && <span className="badge warn" style={{ marginLeft: 6 }}>Today</span>}
                        </>
                      ) : "-"}
                    </td>
                    <td className="num"><Link className="btn ghost small" href={`/enquiries/${e.id}`}>Open</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && !error && (
          <div className="empty"><strong>No enquiries found</strong>{status || search || dueOnly ? "Try clearing the filters." : "Add the first enquiry using the form above."}</div>
        )}
      </div>
      <Pagination basePath="/enquiries" params={{ status, q: search, due: dueOnly ? "1" : "" }} page={page} total={total} />
    </>
  );
}
