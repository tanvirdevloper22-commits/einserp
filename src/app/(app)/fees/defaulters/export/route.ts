import { requireRole } from "@/lib/auth";
import { getDefaulters } from "@/lib/defaulters";

export const dynamic = "force-dynamic";

// Excel mein khulne wali CSV; formula-injection se bachne ke liye = + - @ se shuru hone wale text ke aage ' lagate hain.
function cell(value: string | number) {
  let s = String(value);
  if (/^[=+\-@]/.test(s) && typeof value === "string") s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  await requireRole(["admin", "accountant"]);
  const classId = new URL(request.url).searchParams.get("class") || undefined;
  const rows = await getDefaulters(classId);

  const header = ["Admission no", "Student", "Class", "Guardian", "Phone", "Pending fees", "Overdue", "Total due"];
  const lines = [
    header.map(cell).join(","),
    ...rows.map((r) =>
      [r.admissionNo, r.name, r.className, r.guardian, r.phone, r.feesCount, r.overdue, r.totalDue].map(cell).join(",")
    ),
  ];

  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fee-defaulters-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
