import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getDefaulters } from "@/lib/defaulters";

export const dynamic = "force-dynamic";

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

export default async function DefaultersPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  await requireRole(["admin", "accountant"]);
  const { class: classId } = await searchParams;
  const supabase = await createClient();

  const [{ data: classes }, rows] = await Promise.all([
    supabase.from("classes").select("*").order("name"),
    getDefaulters(classId || undefined),
  ]);

  const grandTotal = rows.reduce((s, r) => s + r.totalDue, 0);
  const grandOverdue = rows.reduce((s, r) => s + r.overdue, 0);

  return (
    <>
      <div className="header-row">
        <div>
          <h1>Fee defaulters</h1>
          <p className="sub">Jinki fees baaki hai unki list</p>
        </div>
        <div className="row">
          <Link className="btn ghost small" href="/fees">← Back to fees</Link>
          <a className="btn small" href={`/fees/defaulters/export${classId ? `?class=${classId}` : ""}`}>Download CSV</a>
        </div>
      </div>

      <div className="grid stats">
        <div className="card stat"><div className="label">Defaulters</div><div className="value">{rows.length}</div></div>
        <div className="card stat"><div className="label">Total due</div><div className="value">{inr(grandTotal)}</div></div>
        <div className="card stat"><div className="label">Overdue (due date nikal gayi)</div><div className="value">{inr(grandOverdue)}</div></div>
      </div>

      <form method="get" className="row card no-print" style={{ marginBottom: 18 }}>
        <div className="grow">
          <label htmlFor="class">Class</label>
          <select id="class" name="class" defaultValue={classId ?? ""}>
            <option value="">All classes</option>
            {classes?.map((c) => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
          </select>
        </div>
        <button className="btn ghost">Filter</button>
      </form>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Adm. no.</th><th>Student</th><th>Class</th><th>Guardian</th>
              <th className="num">Pending fees</th><th className="num">Overdue</th><th className="num">Total due</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.studentId}>
                <td>{r.admissionNo}</td>
                <td>{r.name}</td>
                <td>{r.className}</td>
                <td>{r.guardian || "-"}{r.phone ? ` (${r.phone})` : ""}</td>
                <td className="num">{r.feesCount}</td>
                <td className="num">
                  {r.overdue > 0 ? <span className="badge bad">{inr(r.overdue)}</span> : "-"}
                </td>
                <td className="num"><strong>{inr(r.totalDue)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <div className="empty">Koi defaulter nahi hai. Sab fees jama hain.</div>}
      </div>
    </>
  );
}
