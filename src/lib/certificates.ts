export type CertType = "transfer" | "bonafide" | "character";

export const CERT_TYPES: { value: CertType; label: string; title: string; prefix: string; hint: string }[] = [
  { value: "transfer", label: "Transfer Certificate (TC)", title: "Transfer Certificate", prefix: "TC", hint: "For a student leaving the school." },
  { value: "bonafide", label: "Bonafide Certificate", title: "Bonafide Certificate", prefix: "BON", hint: "Proof that the student studies here now." },
  { value: "character", label: "Character Certificate", title: "Character Certificate", prefix: "CHR", hint: "Conduct and period of study." },
];

export const CONDUCT_OPTIONS = ["Excellent", "Very good", "Good", "Satisfactory"];

export const LEAVING_REASONS = [
  "Parent's transfer",
  "Family relocation",
  "Change of school",
  "Completed studies at this school",
  "Change of board",
  "Personal reasons",
];

export const certType = (value: string) => CERT_TYPES.find((t) => t.value === value);

/** "TC-0007" from a type and its running number. */
export function certNumber(type: string, no: number): string {
  return `${certType(type)?.prefix ?? "CERT"}-${String(no).padStart(4, "0")}`;
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen",
  "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const ORDINAL: Record<number, string> = {
  1: "First", 2: "Second", 3: "Third", 4: "Fourth", 5: "Fifth", 6: "Sixth", 7: "Seventh", 8: "Eighth", 9: "Ninth",
  10: "Tenth", 11: "Eleventh", 12: "Twelfth", 13: "Thirteenth", 14: "Fourteenth", 15: "Fifteenth", 16: "Sixteenth",
  17: "Seventeenth", 18: "Eighteenth", 19: "Nineteenth", 20: "Twentieth", 21: "Twenty First", 22: "Twenty Second",
  23: "Twenty Third", 24: "Twenty Fourth", 25: "Twenty Fifth", 26: "Twenty Sixth", 27: "Twenty Seventh",
  28: "Twenty Eighth", 29: "Twenty Ninth", 30: "Thirtieth", 31: "Thirty First",
};
const MONTHS = [
  "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December",
];

function below100(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : "");
}

function yearInWords(y: number): string {
  if (y >= 2000 && y < 3000) return `Two Thousand${y % 1000 ? ` ${y % 1000 < 100 ? below100(y % 1000) : `${ONES[Math.floor((y % 1000) / 100)]} Hundred${y % 100 ? ` ${below100(y % 100)}` : ""}`}` : ""}`;
  if (y >= 1000 && y < 2000) return `${below100(Math.floor(y / 100))} ${y % 100 ? below100(y % 100) : "Hundred"}`;
  return String(y);
}

/** "2012-05-14" -> "Fourteenth May Two Thousand Twelve". Returns "" for anything that is not a valid date. */
export function dateInWords(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return "";
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return "";
  return `${ORDINAL[d]} ${MONTHS[mo - 1]} ${yearInWords(y)}`;
}

/** "son of", "daughter of" or "ward of" from the gender stored on the student. */
export function relationWord(gender: string | null | undefined): string {
  return gender === "male" ? "son of" : gender === "female" ? "daughter of" : "ward of";
}
