export const TEMPLATE_MAX = 600;

export const DEFAULT_TEMPLATE =
  "Dear {guardian}, {student} ({class}) was absent from {school} today ({date}). If there is a reason, please let the school know. Thank you.";

export const PLACEHOLDERS = ["{student}", "{guardian}", "{class}", "{date}", "{school}"] as const;

export type AbsenceVars = { student: string; guardian: string; className: string; date: string; school: string };

/** Fills the template for one student. An empty template falls back to the default text; a missing guardian becomes "Parent". */
export function renderAbsence(template: string | null | undefined, v: AbsenceVars): string {
  const text = template?.trim() ? template : DEFAULT_TEMPLATE;
  const map: Record<string, string> = {
    student: v.student,
    guardian: v.guardian || "Parent",
    class: v.className,
    date: v.date,
    school: v.school,
  };
  return text.replace(/\{(student|guardian|class|date|school)\}/g, (_, k: string) => map[k]);
}
