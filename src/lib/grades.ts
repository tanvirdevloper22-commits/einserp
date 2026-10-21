export const PASS_PCT = 40;

export const GRADE_BANDS = [
  { min: 90, grade: "A+" },
  { min: 80, grade: "A" },
  { min: 70, grade: "B+" },
  { min: 60, grade: "B" },
  { min: 50, grade: "C" },
  { min: 40, grade: "D" },
  { min: 0, grade: "F" },
] as const;

export function gradeFor(pct: number) {
  return GRADE_BANDS.find((b) => pct >= b.min)?.grade ?? "F";
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export type MarkInput = { student_id: string; subject_id: string; marks_obtained: number | string; max_marks: number | string };

export type SubjectScore = { subjectId: string; got: number; max: number; pct: number; grade: string; passed: boolean };

export type StudentResult = {
  studentId: string;
  scores: Map<string, SubjectScore>;
  totalGot: number;
  totalMax: number;
  pct: number;
  grade: string;
  /** null while no marks are entered. A student fails when any subject is below the pass mark. */
  result: "Pass" | "Fail" | null;
  failedCount: number;
  /** Position in the class by overall percentage; equal percentages share a position. null without marks. */
  rank: number | null;
};

export function computeResults(studentIds: string[], marks: MarkInput[]): Map<string, StudentResult> {
  const out = new Map<string, StudentResult>();
  for (const id of studentIds) {
    out.set(id, { studentId: id, scores: new Map(), totalGot: 0, totalMax: 0, pct: 0, grade: "-", result: null, failedCount: 0, rank: null });
  }
  for (const m of marks) {
    const r = out.get(m.student_id);
    if (!r) continue;
    const got = Number(m.marks_obtained);
    const max = Number(m.max_marks);
    if (!(max > 0)) continue;
    const pct = round2((got / max) * 100);
    r.scores.set(m.subject_id, { subjectId: m.subject_id, got, max, pct, grade: gradeFor(pct), passed: pct >= PASS_PCT });
  }
  for (const r of out.values()) {
    if (!r.scores.size) continue;
    const list = [...r.scores.values()];
    r.totalGot = round2(list.reduce((s, x) => s + x.got, 0));
    r.totalMax = round2(list.reduce((s, x) => s + x.max, 0));
    r.pct = round2((r.totalGot / r.totalMax) * 100);
    r.grade = gradeFor(r.pct);
    r.failedCount = list.filter((x) => !x.passed).length;
    r.result = r.failedCount === 0 ? "Pass" : "Fail";
  }
  const ranked = [...out.values()].filter((r) => r.scores.size).sort((a, b) => b.pct - a.pct);
  ranked.forEach((r, i) => {
    r.rank = i > 0 && ranked[i - 1].pct === r.pct ? ranked[i - 1].rank : i + 1;
  });
  return out;
}

export function ordinal(n: number) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10 > 3 ? 0 : n % 10] ?? "th"}`;
}
