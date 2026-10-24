import { formatDate } from "@/lib/dates";
import { accentStyle } from "@/lib/templates";
import type { SchoolSettings } from "@/lib/settings";

type Student = Record<string, string | null | undefined>;

const GENDER: Record<string, string> = { male: "Male", female: "Female", other: "Other" };

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="af-row">
      <span className="af-label">{label}</span>
      <span className="af-value">{value || ""}</span>
    </div>
  );
}


export default function AdmissionSheet({
  settings, s, cls, photoUrl, idProofHref,
}: { settings: SchoolSettings; s: Student; cls: { name: string; section: string } | null; photoUrl: string | null; idProofHref?: string }) {
  return (
      <div className="card admission" data-doc={settings.admission_template} style={accentStyle(settings.accent_color)}>
        <header className="af-head">
          <div>
            <div className="school-id">
              {settings.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="school-logo" src={settings.logoUrl} alt="" />
              )}
              <div>
                <h2>{settings.school_name}</h2>
                {settings.address && <div className="cell-sub">{settings.address}</div>}
                {(settings.phone || settings.email) && (
                  <div className="cell-sub">{[settings.phone, settings.email].filter(Boolean).join("  |  ")}</div>
                )}
              </div>
            </div>
            <div className="af-title">Admission form</div>
          </div>
          <div className="af-photo">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="Student photo" />
            ) : (
              <span>Affix photo here</span>
            )}
          </div>
        </header>

        <div className="af-grid three">
          <Row label="Admission no." value={s.admission_no} />
          <Row label="Admission date" value={formatDate(s.admission_date ?? s.created_at)} />
          <Row label="Class" value={cls ? `${cls.name} - ${cls.section}` : ""} />
        </div>

        <h3 className="af-section">Student details</h3>
        <div className="af-grid">
          <Row label="Full name" value={s.full_name} />
          <Row label="Date of birth" value={s.dob ? formatDate(s.dob) : ""} />
          <Row label="Gender" value={s.gender ? GENDER[s.gender] ?? s.gender : ""} />
          <Row label="Blood group" value={s.blood_group} />
          <Row label="Previous school" value={s.previous_school} />
        </div>

        <h3 className="af-section">Parents and guardian</h3>
        <div className="af-grid">
          <Row label="Father's name" value={s.father_name} />
          <Row label="Mother's name" value={s.mother_name} />
          <Row label="Guardian (main contact)" value={s.guardian_name} />
          <Row label="Phone" value={s.guardian_phone} />
          <Row label="Alternate phone" value={s.alternate_phone} />
          <Row label="Email" value={s.guardian_email} />
        </div>
        <div className="af-grid one">
          <Row label="Address" value={s.address} />
        </div>

        <h3 className="af-section">ID proof submitted</h3>
        <div className="af-grid">
          <Row label="Document" value={s.id_proof_type} />
          <Row label="Document number" value={s.id_proof_number} />
          <Row label="Copy attached" value={s.id_proof_path ? "Yes" : "No"} />
          {idProofHref && s.id_proof_path && (
            <div className="af-row no-print">
              <span className="af-label">Uploaded copy</span>
              <a className="af-value" href={idProofHref} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>View ID proof</a>
            </div>
          )}
        </div>

        <p className="af-declaration">
          I declare that the information given above is true and complete. I agree to follow the rules and
          regulations of the school and to pay the fees on time.
        </p>

        <div className="af-sign">
          <div><div className="af-line" />Student&apos;s signature</div>
          <div><div className="af-line" />Parent or guardian&apos;s signature</div>
          <div><div className="af-line" />Date</div>
        </div>

        <div className="af-office">
          <span>For office use</span>
          <div className="af-sign" style={{ marginTop: 36 }}>
            <div><div className="af-line" />Checked by</div>
            <div><div className="af-line" />Principal or admin&apos;s signature and stamp</div>
          </div>
        </div>
      </div>
  );
}
