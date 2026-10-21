import { formatDate } from "@/lib/dates";

export type IdCardStudent = {
  id: string;
  full_name: string;
  admission_no: string;
  dob: string | null;
  blood_group: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  address: string | null;
  className: string;
  photoUrl: string | null;
};

export type IdCardSchool = {
  name: string;
  address: string;
  phone: string;
  email: string;
  session: string;
  logoUrl: string | null;
};

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

function Line({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="idc-line">
      <dt>{label}</dt>
      <dd>{value || "-"}</dd>
    </div>
  );
}

export function IdCardFront({ student, school }: { student: IdCardStudent; school: IdCardSchool }) {
  return (
    <div className="idc idc-front">
      <div className="idc-head">
        {school.logoUrl && (
          <span className="idc-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={school.logoUrl} alt="" />
          </span>
        )}
        <span className="idc-school">{school.name}</span>
      </div>

      <div className="idc-photo">
        {student.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={student.photoUrl} alt="" />
        ) : (
          <span>{initials(student.full_name)}</span>
        )}
      </div>

      <div className="idc-name">{student.full_name}</div>
      <div className="idc-class">{student.className}</div>

      <dl className="idc-details">
        <Line label="Adm. no." value={student.admission_no} />
        <Line label="DOB" value={student.dob ? formatDate(student.dob) : null} />
        <Line label="Blood group" value={student.blood_group} />
        <Line label="Phone" value={student.guardian_phone} />
      </dl>

      <div className="idc-foot">{school.session ? `Session ${school.session}` : "Student ID card"}</div>
    </div>
  );
}

export function IdCardBack({ student, school }: { student: IdCardStudent; school: IdCardSchool }) {
  return (
    <div className="idc idc-back">
      <div className="idc-back-title">If found, please return to</div>
      <div className="idc-back-school">{school.name}</div>
      {school.address && <div className="idc-back-text">{school.address}</div>}
      {school.phone && <div className="idc-back-text">Phone: {school.phone}</div>}
      {school.email && <div className="idc-back-text">{school.email}</div>}

      <dl className="idc-details idc-back-details">
        <Line label="Guardian" value={student.guardian_name} />
        <Line label="Phone" value={student.guardian_phone} />
        <div className="idc-line idc-line-wrap">
          <dt>Address</dt>
          <dd className="idc-clamp">{student.address || "-"}</dd>
        </div>
      </dl>

      <div className="idc-sign">
        <div className="idc-sign-line" />
        Principal
      </div>

      <div className="idc-foot">{school.session ? `Valid for session ${school.session}` : "Property of the school"}</div>
    </div>
  );
}
