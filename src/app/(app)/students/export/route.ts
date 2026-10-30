import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { fetchAll } from "@/lib/late-fines";
import { cleanSearch } from "@/lib/pagination";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const yes = (v: unknown) => (v === true ? "Yes" : "No");
const cap = (s: unknown) => (typeof s === "string" && s ? s[0].toUpperCase() + s.slice(1) : "");

const HEADERS = [
  "Admission no.", "Student name", "Class", "Section", "Gender", "Date of birth", "Father's name", "Mother's name",
  "Guardian name", "Guardian phone", "Alternate phone", "Email", "Address", "Blood group", "Mother tongue",
  "Social category", "RTE quota", "BPL", "CWSN", "Admission date", "Previous school", "Status",
];

/** Every student (or one class, or a search) as a CSV file that opens in Excel. Admins only. The ID proof number is left out on purpose. */
export async function GET(request: Request) {
  await requireRole(["admin"]);
  const url = new URL(request.url);
  const classId = url.searchParams.get("class") ?? "";
  const search = cleanSearch(url.searchParams.get("q") ?? "");
  const status = url.searchParams.get("status") ?? "";
  const supabase = await createClient();

  const { rows, error } = await fetchAll<Record<string, unknown>>((from, to) => {
    let q = supabase.from("students").select("*, classes(name, section)").order("full_name").order("id").range(from, to);
    if (UUID.test(classId)) q = q.eq("class_id", classId);
    if (status === "active" || status === "left") q = q.eq("status", status);
    if (search) q = q.or(`full_name.ilike.%${search}%,admission_no.ilike.%${search}%,guardian_phone.ilike.%${search}%,guardian_name.ilike.%${search}%`);
    return q;
  });
  if (error) return new Response(`The export failed: ${error}`, { status: 500 });

  const classOf = (r: Record<string, unknown>) => one(r.classes as { name: string; section: string } | { name: string; section: string }[] | null);
  rows.sort(
    (a, b) =>
      (classOf(a)?.name ?? "~").localeCompare(classOf(b)?.name ?? "~", undefined, { numeric: true }) ||
      (classOf(a)?.section ?? "").localeCompare(classOf(b)?.section ?? "") ||
      String(a.full_name).localeCompare(String(b.full_name)),
  );

  const body = toCsv(
    HEADERS,
    rows.map((r) => {
      const c = classOf(r);
      return [
        r.admission_no, r.full_name, c?.name ?? "", c?.section ?? "", cap(r.gender), r.dob, r.father_name, r.mother_name,
        r.guardian_name, r.guardian_phone, r.alternate_phone, r.guardian_email, r.address, r.blood_group, r.mother_tongue,
        r.social_category, yes(r.is_rte), yes(r.is_bpl), yes(r.is_cwsn), r.admission_date, r.previous_school, cap(r.status),
      ];
    }),
  );
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="students-${todayISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
