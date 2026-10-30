export const STUDENT_BUCKET = "student-files";

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export const ID_PROOF_TYPES = [
  "Aadhaar card",
  "Birth certificate",
  "Passport",
  "Parent or guardian ID card",
  "Other",
] as const;

/** Everything the admission form collects (all strings; empty string means "not given"). */
export type StudentInput = {
  admission_no: string;
  full_name: string;
  dob: string;
  gender: string;
  class_id: string;
  admission_date: string;
  blood_group: string;
  previous_school: string;
  father_name: string;
  mother_name: string;
  guardian_name: string;
  guardian_phone: string;
  alternate_phone: string;
  guardian_email: string;
  address: string;
  id_proof_type: string;
  id_proof_number: string;
  status: string;
  social_category: string;
  is_rte: string;
  is_bpl: string;
  is_cwsn: string;
  mother_tongue: string;
};

export const SOCIAL_CATEGORIES = ["General", "OBC", "SC", "ST", "EWS"] as const;

export const PHOTO_PATH = (id: string) => `photos/${id}.jpg`;
export const ID_PROOF_PATH = (id: string, ext: "jpg" | "pdf") => `id-proofs/${id}.${ext}`;

export function emptyStudent(): StudentInput {
  return {
    admission_no: "", full_name: "", dob: "", gender: "", class_id: "", admission_date: "",
    blood_group: "", previous_school: "", father_name: "", mother_name: "", guardian_name: "",
    guardian_phone: "", alternate_phone: "", guardian_email: "", address: "",
    id_proof_type: "", id_proof_number: "", status: "active",
    social_category: "", is_rte: "", is_bpl: "", is_cwsn: "", mother_tongue: "",
  };
}

/** Turns a database row into form values (null becomes an empty string). */
export function studentToInput(row: Record<string, unknown>): StudentInput {
  const base = emptyStudent();
  for (const key of Object.keys(base) as (keyof StudentInput)[]) {
    const v = row[key];
    base[key] = v === null || v === undefined ? "" : String(v);
  }
  // The yes/no fields are stored as true/false in the database and edited as "yes" or "".
  for (const k of ["is_rte", "is_bpl", "is_cwsn"] as const) base[k] = row[k] === true ? "yes" : "";
  if (!base.status) base.status = "active";
  return base;
}
