import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  // Dashboard par requireRole nahi lagate: wrong-role redirect yahin aata hai, loop ban jayega.
  const { role, fullName } = await getProfile();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

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

  return (
    <>
      <h1>Dashboard</h1>
      <p className="sub">{fullName ? `Namaste, ${fullName}. ` : ""}Aaj ka overview</p>
      <div className="grid stats">
        <div className="card stat">
          <div className="label">Active students</div>
          <div className="value">{students.count ?? 0}</div>
        </div>
        {showAttendance && (
          <>
            <div className="card stat">
              <div className="label">Present today</div>
              <div className="value">{present.count ?? 0}</div>
            </div>
            <div className="card stat">
              <div className="label">Absent today</div>
              <div className="value">{absent.count ?? 0}</div>
            </div>
          </>
        )}
        {showFees && (
          <div className="card stat">
            <div className="label">Total fees due</div>
            <div className="value">₹{totalDue.toLocaleString("en-IN")}</div>
          </div>
        )}
      </div>
    </>
  );
}
