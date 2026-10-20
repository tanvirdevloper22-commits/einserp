import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getDefaulters } from "@/lib/defaulters";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fee defaulters" };

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
      <PageHeader title="Fee defaulters" description="Students with unpaid fees, largest balance first.">
        <Link className="btn ghost" href="/fees">Back to fees</Link>
        <a className="btn" href={`/fees/defaulters/export${classId ? `?class=${classId}` : ""}`}>Download CSV</a>
      </PageHeader>

      <div className="grid stats">
        <div className="card stat"><span className="label">Students with dues</span><span className="value">{rows.length}</span></div>
        <div className="card stat"><span className="label">Total outstanding</span><span className="value">{inr(grandTotal)}</span></div>
        <div className="card stat"><span className="label">Past due date</span><span className="value">{inr(grandOverdue)}</span></div>
      </div>

      <form method="get" className="card toolbar no-print">
        <div className="row">
          <div className="grow" style={{ maxWidth: 280 }}>
            <label htmlFor="class">Filter by class</label>
            <select id="class" name="class" defaultValue={classId ?? ""}>
              <option value="">All classes</option>
              {classes?.map((c) => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
            </select>
          </div>
          <button className="btn ghost">Apply</button>
          {classId && <Link className="btn ghost" href="/fees/defaulters">Clear</Link>}
        </div>
      </form>

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th><th>Class</th><th>Guardian</th>
                <th className="num">Unpaid fees</th><th className="num">Past due date</th><th className="num">Total due</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.studentId}>
                  <td>
                    <span className="strong">{r.name}</span>
                    <span className="cell-sub">{r.admissionNo}</span>
                  </td>
                  <td>{r.className}</td>
                  <td>
                    {r.guardian || "-"}
                    {r.phone && <span className="cell-sub">{r.phone}</span>}
                  </td>
                  <td className="num">{r.feesCount}</td>
                  <td className="num">{r.overdue > 0 ? <span className="badge bad">{inr(r.overdue)}</span> : "-"}</td>
                  <td className="num strong">{inr(r.totalDue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <div className="empty">
            <strong>No defaulters</strong>
            All assigned fees have been paid.
          </div>
        )}
      </div>
    </>
  );
}
