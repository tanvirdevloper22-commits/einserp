import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { loadClassResults } from "@/lib/results";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Class results" };

const num = (n: number) => String(Math.round(n * 100) / 100);

export default async function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ examId: string }>;
  searchParams: Promise<{ class?: string }>;
}) {
  await requireRole(["admin", "teacher"]);
  const { examId } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: exam }, { data: classes }] = await Promise.all([
    supabase.from("exams").select("name").eq("id", examId).maybeSingle(),
    supabase.from("classes").select("id, name, section").order("name"),
  ]);
  if (!exam) notFound();
  const classId = sp.class ?? classes?.[0]?.id;
  const cls = classes?.find((c) => c.id === classId);

  const data = classId ? await loadClassResults(supabase, examId, classId) : null;
  const sorted = data
    ? [...data.students].sort((a, b) => {
        const ra = data.results.get(a.id)!.rank ?? 9999;
        const rb = data.results.get(b.id)!.rank ?? 9999;
        return ra - rb || a.full_name.localeCompare(b.full_name);
      })
    : [];
  const passed = data ? [...data.results.values()].filter((r) => r.result === "Pass").length : 0;
  const failed = data ? [...data.results.values()].filter((r) => r.result === "Fail").length : 0;

  return (
    <>
      <PageHeader title={`${exam.name} results`} description="Class-wise results with position. Open a report card for any student.">
        <Link className="btn ghost" href={`/exams/${examId}${classId ? `?class=${classId}` : ""}`}>Enter marks</Link>
        {classId && data?.ranked ? <Link className="btn" href={`/exams/${examId}/report?class=${classId}`}>Print all report cards</Link> : null}
      </PageHeader>

      <form method="get" className="card toolbar">
        <div className="row">
          <div className="grow" style={{ maxWidth: 260 }}>
            <label htmlFor="class">Class</label>
            <select id="class" name="class" defaultValue={classId}>
              {classes?.map((c) => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
            </select>
          </div>
          <button className="btn ghost">Show</button>
        </div>
      </form>

      {data && data.ranked > 0 && (
        <div className="grid stats">
          <div className="card stat"><span className="label">Students with marks</span><span className="value">{data.ranked} / {data.students.length}</span></div>
          <div className="card stat"><span className="label">Passed</span><span className="value">{passed}</span></div>
          <div className="card stat"><span className="label">Failed</span><span className="value">{failed}</span></div>
        </div>
      )}

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="num">Pos.</th><th>Student</th>
                {data?.subjects.map((s) => <th key={s.id} className="num">{s.name}</th>)}
                <th className="num">Total</th><th className="num">%</th><th>Grade</th><th>Result</th><th />
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => {
                const r = data!.results.get(s.id)!;
                return (
                  <tr key={s.id}>
                    <td className="num">{r.rank ?? "-"}</td>
                    <td><span className="strong">{s.full_name}</span><span className="cell-sub">{s.admission_no}</span></td>
                    {data!.subjects.map((sub) => {
                      const sc = r.scores.get(sub.id);
                      return (
                        <td key={sub.id} className="num" style={sc && !sc.passed ? { color: "var(--bad)", fontWeight: 600 } : undefined}>
                          {sc ? num(sc.got) : "-"}
                        </td>
                      );
                    })}
                    <td className="num">{r.scores.size ? `${num(r.totalGot)} / ${num(r.totalMax)}` : "-"}</td>
                    <td className="num">{r.scores.size ? r.pct.toFixed(1) : "-"}</td>
                    <td>{r.scores.size ? r.grade : "-"}</td>
                    <td>{r.result ? <span className={`badge ${r.result === "Pass" ? "ok" : "bad"}`}>{r.result}</span> : "-"}</td>
                    <td className="num"><Link className="btn ghost small" href={`/exams/${examId}/report/${s.id}`}>Report card</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data && !data.students.length && (
          <div className="empty"><strong>No active students in {cls ? `${cls.name} - ${cls.section}` : "this class"}</strong></div>
        )}
        {data && data.students.length > 0 && data.ranked === 0 && (
          <div className="empty"><strong>No marks entered yet</strong>Enter marks subject by subject and the results will appear here.</div>
        )}
      </div>
    </>
  );
}
