import { formatDate } from "@/lib/dates";
import { accentStyle } from "@/lib/templates";
import { instructionLines, paperSubject, timeRange, weekday, type Paper } from "@/lib/admit";
import type { SchoolSettings } from "@/lib/settings";

export type AdmitStudent = {
  id: string;
  full_name: string;
  admission_no: string;
  dob: string | null;
  guardian_name: string | null;
  className: string;
  photoUrl: string | null;
};

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

export default function AdmitCard({
  school,
  exam,
  student,
  papers,
}: {
  school: SchoolSettings;
  exam: { name: string; instructions: string | null };
  student: AdmitStudent;
  papers: Paper[];
}) {
  return (
    <section className="admit" data-doc={school.report_template} style={accentStyle(school.accent_color)}>
      <header className="admit-head">
        {school.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="admit-logo" src={school.logoUrl} alt="" />
        )}
        <div className="admit-school">
          <h2>{school.school_name}</h2>
          {school.address && <div>{school.address}</div>}
          {(school.phone || school.email) && <div>{[school.phone, school.email].filter(Boolean).join("  |  ")}</div>}
        </div>
      </header>

      <div className="admit-title">
        <span>Admit card</span>
        <span>{exam.name}{school.session_label ? ` · ${school.session_label}` : ""}</span>
      </div>

      <div className="admit-who">
        <dl>
          <div><dt>Student</dt><dd className="admit-name">{student.full_name}</dd></div>
          <div><dt>Class</dt><dd>{student.className}</dd></div>
          <div><dt>Adm. no.</dt><dd>{student.admission_no}</dd></div>
          <div><dt>Date of birth</dt><dd>{student.dob ? formatDate(student.dob) : "-"}</dd></div>
          <div><dt>Guardian</dt><dd>{student.guardian_name || "-"}</dd></div>
        </dl>
        <div className="admit-photo">
          {student.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={student.photoUrl} alt="" />
          ) : (
            <span>{initials(student.full_name)}</span>
          )}
        </div>
      </div>

      {papers.length ? (
        <table className="admit-table">
          <thead><tr><th>Date</th><th>Day</th><th>Subject</th><th>Time</th></tr></thead>
          <tbody>
            {papers.map((p) => (
              <tr key={p.id}>
                <td>{formatDate(p.paper_date)}</td>
                <td>{weekday(p.paper_date)}</td>
                <td>{paperSubject(p)}</td>
                <td>{timeRange(p.start_time, p.end_time)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="admit-empty">The date sheet for this class has not been published yet.</div>
      )}

      <ol className="admit-rules">
        {instructionLines(exam.instructions).map((l, i) => <li key={i}>{l}</li>)}
      </ol>

      <div className="admit-sign">
        <div><span />Class teacher</div>
        <div><span />Principal</div>
      </div>
    </section>
  );
}
