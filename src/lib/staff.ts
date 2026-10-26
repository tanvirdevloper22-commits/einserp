export type StaffInput = {
  employee_no: string;
  full_name: string;
  staff_type: string;
  designation: string;
  subjects: string;
  phone: string;
  email: string;
  gender: string;
  dob: string;
  joining_date: string;
  qualification: string;
  address: string;
  emergency_name: string;
  emergency_phone: string;
  profile_id: string;
  class_teacher_of: string;
  monthly_salary: string;
  status: string;
  notes: string;
};

export type StaffFormState = { error?: string; values?: StaffInput };

export const EMPTY_STAFF: StaffInput = {
  employee_no: "",
  full_name: "",
  staff_type: "teaching",
  designation: "",
  subjects: "",
  phone: "",
  email: "",
  gender: "",
  dob: "",
  joining_date: "",
  qualification: "",
  address: "",
  emergency_name: "",
  emergency_phone: "",
  profile_id: "",
  class_teacher_of: "",
  monthly_salary: "",
  status: "active",
  notes: "",
};

export const STAFF_TYPE_LABEL: Record<string, string> = {
  teaching: "Teaching",
  non_teaching: "Non-teaching",
};

export const DESIGNATIONS = [
  "Principal",
  "Vice Principal",
  "Coordinator",
  "Senior Teacher",
  "Teacher",
  "Accountant",
  "Office Clerk",
  "Librarian",
  "Lab Assistant",
  "Driver",
  "Peon",
  "Security Guard",
  "Cleaner",
];

export const GENDERS = ["Male", "Female", "Other"];

/** Reads every staff field from a submitted form as trimmed text. */
export function readStaffForm(formData: FormData): StaffInput {
  const out = { ...EMPTY_STAFF };
  for (const key of Object.keys(EMPTY_STAFF) as (keyof StaffInput)[]) {
    out[key] = String(formData.get(key) ?? "").trim();
  }
  return out;
}
