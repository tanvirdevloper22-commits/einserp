import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/dates";
import { gradeFor } from "@/lib/grades";
import PageHeader from "@/components/PageHeader";
import NoticeList from "@/components/NoticeList";
import { getNotices } from "@/lib/notices";
import { getCurrentHomework } from "@/lib/homework";
import HomeworkList from "@/components/HomeworkList";

export const dynamic = "force-dynamic";
export const metadata = { title: "My children" };

const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const STATUS_LABEL: Record<string, string> = { present: "Present", absent: "Absent", late: "Late", leave: "On leave" };
const STATUS_BADGE: Record<string, string> = { present: "ok", absent: "bad", late: "warn", leave: "neutral" };

export default async function PortalPage({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const me = await getProfile();
  if (me.role !== "parent") redirect("/");
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: links, error } = await supabase
    .from("parent_students")
    .select("students(id, full_name, admission_no, class_id, classes(name, section))");
  const children = (links ?? []).map((l) => one(l.students)).filter((s): s is NonNullable<typeof s> => Boolean(s));
  const child = children.find((c) => c.id === sp.child) ?? children[0];

  if (error || !child) {
    return (
      <>
        <PageHeader title={`Welcome${me.fullName ? `, ${me.fullName.split(" ")[0]}` : ""}`} description="Your child's attendance, fees and results." />
        <div className="card" style={{ maxWidth: 560 }}>
          <h2>{error ? "The parent portal is not set up yet" : "No child linked to your account yet"}</h2>
          <p className="sub" style={{ marginBottom: 0 }}>
            {error
              ? "Please ask the school to finish setting up the parent portal."
              : "Please ask the school office to link your child to this account. Once that is done, you will see attendance, fees and results here."}
          </p>
        </div>
      </>
    );
  }

  const cls = one(child.classes);
  const today = todayISO();
  const monthStart = today.slice(0, 8) + "01";

  const [{ data: monthRows }, { data: recent }, { data: fees }, { data: marks }, { notices: latestNotices }, { homework }] = await Promise.all([
    supabase.from("attendance").select("status").eq("student_id", child.id).gte("date", monthStart),
    supabase.from("attendance").select("date, status").eq("student_id", child.id).order("date", { ascending: false }).limit(10),
    supabase.from("fee_balances").select("*").eq("student_id", child.id).order("due_date", { ascending: false, nullsFirst: false }),
    supabase.from("marks").select("exam_id, marks_obtained, max_marks, exams(name, exam_date)").eq("student_id", child.id),
    getNotices({ limit: 3 }),
    child.class_id ? getCurrentHomework(child.class_id) : Promise.resolve({ homework: [], error: null }),
  ]);

  const count = (st: string) => (monthRows ?? []).filter((r) => r.status === st).length;
  const marked = monthRows?.length ?? 0;
  const attended = count("present") + count("late");
  const attendancePct = marked ? Math.round((attended / marked) * 100) : null;

  const totalDue = (fees ?? []).reduce((s, f) => s + Number(f.due), 0);

  const byExam = new Map<string, { name: string; date: string | null; got: number; max: number }>();
  for (const m of marks ?? []) {
    const e = one(m.exams);
    const cur = byExam.get(m.exam_id) ?? { name: e?.name ?? "Exam", date: e?.exam_date ?? null, got: 0, max: 0 };
    cur.got += Number(m.marks_obtained);
    cur.max += Number(m.max_marks);
    byExam.set(m.exam_id, cur);
  }
  const exams = [...byExam.entries()].sort((a, b) => (b[1].date ?? "").localeCompare(a[1].date ?? ""));

  return (
    <>
      <PageHeader title={child.full_name} description={`${cls ? `${cls.name} - ${cls.section}` : "Class not assigned"} | Admission no. ${child.admission_no}`}>
        {child.class_id && <Link className="btn ghost" href={`/timetable?class=${child.class_id}`}>Timetable</Link>}
      </PageHeader>

      {children.length > 1 && (
        <div className="row tight" style={{ marginBottom: 16 }}>
          {children.map((c) => (
            <Link key={c.id} className={c.id === child.id ? "btn" : "btn ghost"} href={`/portal?child=${c.id}`}>{c.full_name}</Link>
          ))}
        </div>
      )}

      {latestNotices.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>Notices</h2>
            <Link className="btn ghost small" href="/notices">View all</Link>
          </div>
          <NoticeList notices={latestNotices} />
        </div>
      )}

      {homework.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 8px" }}>Homework</h2>
          <HomeworkList items={homework} />
        </div>
      )}

      <div className="grid stats">
        <div className="card stat">
          <span className="label">Attendance this month</span>
          <span className="value">{attendancePct === null ? "-" : `${attendancePct}%`}</span>
        </div>
        <div className="card stat">
          <span className="label">Days absent this month</span>
          <span className="value">{count("absent")}</span>
        </div>
        <div className="card stat">
          <span className="label">Fees due</span>
          <span className="value">{inr(totalDue)}</span>
        </div>
      </div>

      <div className="card flush" style={{ marginBottom: 16 }}>
        <div style={{ padding: "16px 16px 0" }}><h2>Fees</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Fee</th><th>Due date</th><th className="num">Amount</th><th className="num">Paid</th><th className="num">Balance</th><th /></tr></thead>
            <tbody>
              {fees?.map((f) => {
                const due = Number(f.due);
                const overdue = due > 0 && f.due_date && f.due_date < today;
                return (
                  <tr key={f.fee_id}>
                    <td className="strong">{f.title}</td>
                    <td>{formatDate(f.due_date)} {overdue && <span className="badge bad" style={{ marginLeft: 6 }}>Overdue</span>}</td>
                    <td className="num">{inr(Number(f.amount))}</td>
                    <td className="num">{inr(Number(f.paid))}</td>
                    <td className="num strong">{due > 0 ? inr(due) : <span className="badge ok">Paid</span>}</td>
                    <td className="num"><Link className="btn ghost small" href={`/fees/invoice/${f.fee_id}`}>{due > 0 ? "Invoice and pay" : "Invoice"}</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!fees?.length && <div className="empty"><strong>No fees yet</strong>Fees the school assigns will appear here.</div>}
      </div>

      <div className="grid two">
        <div className="card flush">
          <div style={{ padding: "16px 16px 0" }}><h2>Results</h2></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Exam</th><th className="num">Marks</th><th>Grade</th><th /></tr></thead>
              <tbody>
                {exams.map(([id, e]) => {
                  const pct = e.max ? (e.got / e.max) * 100 : 0;
                  return (
                    <tr key={id}>
                      <td><span className="strong">{e.name}</span>{e.date && <span className="cell-sub">{formatDate(e.date)}</span>}</td>
                      <td className="num">{Math.round(e.got * 100) / 100} / {Math.round(e.max * 100) / 100} ({pct.toFixed(1)}%)</td>
                      <td>{gradeFor(pct)}</td>
                      <td className="num"><Link className="btn ghost small" href={`/exams/${id}/report/${child.id}`}>Report card</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!exams.length && <div className="empty"><strong>No results yet</strong>Marks appear here once the school enters them.</div>}
        </div>

        <div className="card flush">
          <div style={{ padding: "16px 16px 0" }}><h2>Recent attendance</h2></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Status</th></tr></thead>
              <tbody>
                {recent?.map((r) => (
                  <tr key={r.date}>
                    <td>{formatDate(r.date)}</td>
                    <td><span className={`badge ${STATUS_BADGE[r.status] ?? "neutral"}`}>{STATUS_LABEL[r.status] ?? r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!recent?.length && <div className="empty"><strong>No attendance recorded yet</strong></div>}
        </div>
      </div>
    </>
  );
}
