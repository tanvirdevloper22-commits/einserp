import { formatDate } from "@/lib/dates";
import { GRADE_BANDS, PASS_PCT, ordinal, type StudentResult } from "@/lib/grades";
import type { ClassStudent } from "@/lib/results";
import type { SchoolSettings } from "@/lib/settings";

type Props = {
  school: SchoolSettings;
  exam: { name: string; exam_date: string | null };
  className: string;
  student: ClassStudent;
  subjects: { id: string; name: string }[];
  result: StudentResult;
  classSize: number;
};

const num = (n: number) => String(Math.round(n * 100) / 100);

export default function ReportCard({ school, exam, className, student, subjects, result, classSize }: Props) {
  const hasMarks = result.scores.size > 0;
  return (
    <div className="card report">
      <header className="rc-head">
        <div className="school-id">
          {school.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="school-logo" src={school.logoUrl} alt="" />
          )}
          <div>
            <h2>{school.school_name}</h2>
            {school.address && <div className="cell-sub">{school.address}</div>}
            {(school.phone || school.email) && (
              <div className="cell-sub">{[school.phone, school.email].filter(Boolean).join("  |  ")}</div>
            )}
          </div>
        </div>
        <div className="invoice-meta">
          <div className="inv-no">Report card</div>
          <div className="cell-sub">{exam.name}</div>
          {exam.exam_date && <div className="cell-sub">{formatDate(exam.exam_date)}</div>}
          {school.session_label && <div className="cell-sub">Session {school.session_label}</div>}
        </div>
      </header>

      <div className="rc-info">
        <div><span className="cell-sub">Student</span><strong>{student.full_name}</strong></div>
        <div><span className="cell-sub">Admission no.</span><strong>{student.admission_no}</strong></div>
        <div><span className="cell-sub">Class</span><strong>{className}</strong></div>
        <div><span className="cell-sub">Date of birth</span><strong>{student.dob ? formatDate(student.dob) : "-"}</strong></div>
        <div><span className="cell-sub">Guardian</span><strong>{student.guardian_name || "-"}</strong></div>
      </div>

      {hasMarks ? (
        <>
          <div className="table-wrap" style={{ border: "1px solid var(--border)", borderRadius: 8 }}>
            <table>
              <thead>
                <tr><th>Subject</th><th className="num">Marks</th><th className="num">Out of</th><th className="num">Percentage</th><th>Grade</th></tr>
              </thead>
              <tbody>
                {subjects.map((s) => {
                  const sc = result.scores.get(s.id);
                  return (
                    <tr key={s.id}>
                      <td className="strong">{s.name}</td>
                      <td className="num">{sc ? num(sc.got) : "-"}</td>
                      <td className="num">{sc ? num(sc.max) : "-"}</td>
                      <td className="num">{sc ? `${sc.pct.toFixed(1)}%` : "-"}</td>
                      <td>{sc ? <span className={`badge ${sc.passed ? "ok" : "bad"}`}>{sc.grade}</span> : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="strong">Total</td>
                  <td className="num strong">{num(result.totalGot)}</td>
                  <td className="num strong">{num(result.totalMax)}</td>
                  <td className="num strong">{result.pct.toFixed(1)}%</td>
                  <td><span className={`badge ${result.result === "Pass" ? "ok" : "bad"}`}>{result.grade}</span></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="rc-summary">
            <div><span className="cell-sub">Result</span><strong>{result.result}</strong></div>
            <div><span className="cell-sub">Percentage</span><strong>{result.pct.toFixed(1)}%</strong></div>
            <div><span className="cell-sub">Position in class</span><strong>{result.rank ? `${ordinal(result.rank)} of ${classSize}` : "-"}</strong></div>
          </div>
          {result.result === "Fail" && (
            <p className="cell-sub" style={{ marginTop: 10 }}>
              Below the pass mark of {PASS_PCT}% in {result.failedCount} {result.failedCount === 1 ? "subject" : "subjects"}.
            </p>
          )}
        </>
      ) : (
        <div className="empty">
          <strong>No marks entered</strong>
          Marks for this student have not been entered for this exam yet.
        </div>
      )}

      <p className="rc-key">
        Grades: {GRADE_BANDS.map((b, i) => `${b.grade} ${i === 0 ? `${b.min}+` : `${b.min}-${GRADE_BANDS[i - 1].min - 1}`}`).join("  |  ")}. Pass mark {PASS_PCT}% in every subject.
      </p>

      <div className="af-sign">
        <div><div className="af-line" />Class teacher</div>
        <div><div className="af-line" />Parent or guardian</div>
        <div><div className="af-line" />Principal</div>
      </div>
    </div>
  );
}
