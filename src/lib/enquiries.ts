export type EnquiryStatus = "new" | "contacted" | "visit" | "applied" | "admitted" | "lost";
export type EnquirySource = "walk_in" | "phone" | "website" | "referral" | "social" | "advertisement" | "other";

export const STATUSES: { value: EnquiryStatus; label: string; badge: string }[] = [
  { value: "new", label: "New", badge: "accent" },
  { value: "contacted", label: "Contacted", badge: "neutral" },
  { value: "visit", label: "Visit planned", badge: "warn" },
  { value: "applied", label: "Applied", badge: "warn" },
  { value: "admitted", label: "Admitted", badge: "ok" },
  { value: "lost", label: "Not joining", badge: "bad" },
];
export const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.value, s.label])) as Record<EnquiryStatus, string>;
export const STATUS_BADGE = Object.fromEntries(STATUSES.map((s) => [s.value, s.badge])) as Record<EnquiryStatus, string>;
export const OPEN_STATUSES: EnquiryStatus[] = ["new", "contacted", "visit", "applied"];

export const SOURCES: { value: EnquirySource; label: string }[] = [
  { value: "walk_in", label: "Walk-in" },
  { value: "phone", label: "Phone call" },
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "social", label: "Social media" },
  { value: "advertisement", label: "Advertisement" },
  { value: "other", label: "Other" },
];
export const SOURCE_LABEL = Object.fromEntries(SOURCES.map((s) => [s.value, s.label])) as Record<EnquirySource, string>;

export const isStatus = (v: string): v is EnquiryStatus => STATUSES.some((s) => s.value === v);
export const isSource = (v: string): v is EnquirySource => SOURCES.some((s) => s.value === v);

export type Enquiry = {
  id: string;
  child_name: string;
  class_applied: string | null;
  guardian_name: string | null;
  phone: string;
  email: string | null;
  source: EnquirySource;
  status: EnquiryStatus;
  follow_up_date: string | null;
  student_id: string | null;
  created_by_name: string | null;
  created_at: string;
};

/** How a follow-up date stands today: overdue, due today, or later. Empty for closed enquiries or when no date is set. */
export function followUpState(date: string | null, status: EnquiryStatus, today: string): "overdue" | "today" | "later" | null {
  if (!date || !OPEN_STATUSES.includes(status)) return null;
  return date < today ? "overdue" : date === today ? "today" : "later";
}

/** Finds the class whose name matches what the parent asked for ("class 6", "Nursery"), to prefill the admission form. */
export function matchClass(applied: string | null, classes: { id: string; name: string }[]): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const a = norm(applied ?? "");
  if (!a) return "";
  return classes.find((c) => norm(c.name) === a)?.id ?? "";
}
