import QRCode from "qrcode";

export const QR_PREFIX = "EINS:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The text stored in a student's ID card QR code. */
export const studentQrPayload = (studentId: string) => `${QR_PREFIX}${studentId}`;

/** The student id inside scanned text, or null when the text is not one of our QR codes. Accepts a bare id too (typed by hand). */
export function parseStudentQr(text: string): string | null {
  const t = text.trim();
  const id = t.toUpperCase().startsWith(QR_PREFIX) ? t.slice(QR_PREFIX.length).trim() : t;
  return UUID.test(id) ? id.toLowerCase() : null;
}

/** PNG data URL of the student's QR code, for printing on the ID card. */
export function studentQrDataUrl(studentId: string): Promise<string> {
  return QRCode.toDataURL(studentQrPayload(studentId), { errorCorrectionLevel: "M", margin: 0, width: 240 });
}

export type ScanResult = {
  ok: boolean;
  /** present: newly marked; already: was already present/late; leave: on leave, left unchanged */
  kind?: "marked" | "already" | "leave" | "error";
  message: string;
  name?: string;
  className?: string;
  admissionNo?: string;
  status?: string;
};

/** One class's numbers for today, from the attendance_today() database function. */
export type ClassStat = {
  classId: string | null;
  label: string;
  total: number;
  present: number;
  late: number;
  onLeave: number;
  absentMarked: number;
};

export type DayTotals = {
  total: number;
  /** present + late */
  here: number;
  late: number;
  onLeave: number;
  /** Everyone who is not here and not on leave: marked absent or not scanned yet. */
  absent: number;
  /** Share of all active students who are here, 0 to 100 with one decimal. */
  percent: number;
};

export function totalsOf(rows: Pick<ClassStat, "total" | "present" | "late" | "onLeave">[]): DayTotals {
  let total = 0, present = 0, late = 0, onLeave = 0;
  for (const r of rows) { total += r.total; present += r.present; late += r.late; onLeave += r.onLeave; }
  const here = present + late;
  return { total, here, late, onLeave, absent: Math.max(0, total - here - onLeave), percent: total ? Math.round((here / total) * 1000) / 10 : 0 };
}
