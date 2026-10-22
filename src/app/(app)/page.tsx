import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import { todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

export default async function Dashboard() {
  // No requireRole here: a wrong-role redirect lands on this page, so guarding it would loop.
  const { role, fullName } = await getProfile();
  if (role === "parent") redirect("/portal");
  const supabase = await createClient();
  const today = todayISO();

  const showAttendance = role === "admin" || role === "teacher";
  const showFees = role === "admin" || role === "accountant";

  const [students, present, absent, balances] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
    showAttendance
      ? supabase.from("attendance").select("id", { count: "exact", head: true }).eq("date", today).eq("status", "present")
      : Promise.resolve({ count: 0 }),
    showAttendance
      ? supabase.from("attendance").select("id", { count: "exact", head: true }).eq("date", today).eq("status", "absent")
      : Promise.resolve({ count: 0 }),
    showFees ? supabase.from("fee_balances").select("due") : Promise.resolve({ data: [] as { due: number }[] }),
  ]);

  const totalDue = (balances.data ?? []).reduce((s, r) => s + Number(r.due), 0);
  const firstName = fullName.split(" ")[0];
  const dateLabel = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const actions: { href: string; label: string; show: boolean }[] = [
    { href: "/students", label: "Add a student", show: role === "admin" },
    { href: "/attendance", label: "Mark attendance", show: showAttendance },
    { href: "/fees", label: "Collect a payment", show: showFees },
    { href: "/fees/defaulters", label: "View fee defaulters", show: showFees },
    { href: "/exams", label: "Enter exam marks", show: showAttendance },
  ];

  return (
    <>
      <PageHeader title={firstName ? `Welcome back, ${firstName}` : "Dashboard"} description={dateLabel} />

      <div className="grid stats">
        <div className="card stat">
          <span className="label">Active students</span>
          <span className="value">{students.count ?? 0}</span>
        </div>
        {showAttendance && (
          <>
            <div className="card stat">
              <span className="label">Present today</span>
              <span className="value">{present.count ?? 0}</span>
            </div>
            <div className="card stat">
              <span className="label">Absent today</span>
              <span className="value">{absent.count ?? 0}</span>
            </div>
          </>
        )}
        {showFees && (
          <div className="card stat">
            <span className="label">Fees outstanding</span>
            <span className="value">{inr(totalDue)}</span>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Quick actions</h2>
        <div className="row tight">
          {actions.filter((a) => a.show).map((a) => (
            <Link key={a.href} className="btn ghost" href={a.href}>{a.label}</Link>
          ))}
        </div>
      </div>
    </>
  );
}
