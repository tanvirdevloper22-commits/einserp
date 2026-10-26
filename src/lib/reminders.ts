const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

/**
 * Turns a phone number typed by the school into digits with the country code, ready for a WhatsApp or SMS link.
 * Indian numbers are the default: 10 digits, or 10 digits with a leading 0 or 91 or +91. Anything else with 8 to 15
 * digits is assumed to already include its country code. Returns null when the number cannot be used.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length >= 8 && digits.length <= 15) return digits;
  return null;
}

export type ReminderInput = {
  schoolName: string;
  guardian: string;
  studentName: string;
  className: string;
  totalDue: number;
  overdue: number;
  upiId?: string;
};

/** The plain-text reminder sent to a guardian. */
export function buildReminderMessage(i: ReminderInput): string {
  const greeting = i.guardian ? `Dear ${i.guardian},` : "Dear Parent,";
  const lines = [
    greeting,
    "",
    `This is a friendly reminder from ${i.schoolName}. The school fee balance for ${i.studentName}${i.className && i.className !== "-" ? ` (Class ${i.className})` : ""} is ${inr(i.totalDue)}${
      i.overdue > 0 ? `, of which ${inr(i.overdue)} is past the due date` : ""
    }.`,
  ];
  if (i.upiId) lines.push("", `You can pay by UPI to ${i.upiId}.`);
  lines.push("", "If you have already paid, please ignore this message. Thank you.");
  return lines.join("\n");
}

export function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function smsLink(phone: string, message: string): string {
  return `sms:+${phone}?body=${encodeURIComponent(message)}`;
}
