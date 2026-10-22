export type TemplateOption = { id: string; name: string; description: string };

/** Page layouts shared by invoices and receipts, report cards, admission forms and timetables. */
export const DOC_TEMPLATES: TemplateOption[] = [
  { id: "classic", name: "Classic", description: "Logo and school name on the left, thin rule underneath." },
  { id: "centered", name: "Centered", description: "Letterhead style: logo and name centered with a double rule." },
  { id: "modern", name: "Modern", description: "Colored accent bar and headings on a clean white page." },
  { id: "bordered", name: "Bordered", description: "Formal page with a frame around the whole document." },
];

export const ID_TEMPLATES: TemplateOption[] = [
  { id: "classic", name: "Classic", description: "Centered photo, white header and a colored footer line." },
  { id: "stripe", name: "Accent stripe", description: "Thin colored stripe across the top, rounded photo." },
  { id: "round", name: "Round photo", description: "Circular photo with a colored ring." },
  { id: "left", name: "Left aligned", description: "Photo and name aligned to the left, compact details." },
];

export const ACCENT_PRESETS = [
  { hex: "#036cf9", name: "Blue" },
  { hex: "#0f766e", name: "Teal" },
  { hex: "#166534", name: "Green" },
  { hex: "#7c3aed", name: "Violet" },
  { hex: "#c2410c", name: "Orange" },
  { hex: "#b91c1c", name: "Red" },
  { hex: "#121f2f", name: "Navy" },
] as const;

export const DEFAULT_ACCENT = "#036cf9";

export type DocKind = "invoice" | "report" | "admission" | "timetable";

export const DOC_KINDS: { kind: DocKind; column: string; title: string; hint: string }[] = [
  { kind: "invoice", column: "invoice_template", title: "Invoices and receipts", hint: "Fee invoices and payment receipts." },
  { kind: "report", column: "report_template", title: "Report cards", hint: "Exam report cards." },
  { kind: "admission", column: "admission_template", title: "Admission form", hint: "The printable form with signatures." },
  { kind: "timetable", column: "timetable_template", title: "Timetable", hint: "Class and teacher timetables." },
];

export function pickTemplate(value: unknown, options: TemplateOption[]) {
  return options.some((o) => o.id === value) ? String(value) : options[0].id;
}

export function pickAccent(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : DEFAULT_ACCENT;
}

/** Inline style that hands the accent colour to a document and its CSS. */
export function accentStyle(accent: string) {
  return { "--doc-accent": accent } as React.CSSProperties;
}
