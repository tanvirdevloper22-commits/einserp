import Link from "next/link";
import { requireRole } from "@/lib/auth";
import Scanner from "./Scanner";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scan attendance" };

export default async function ScanPage() {
  const me = await requireRole(["admin", "teacher", "attender"]);
  return (
    <>
      <div className="kiosk-links no-print">
        <Link className="btn ghost small" href="/attendance/stats">Today&apos;s numbers</Link>
        {me.role !== "attender" && <Link className="btn ghost small" href="/attendance">Back to attendance</Link>}
      </div>
      <Scanner />
    </>
  );
}
