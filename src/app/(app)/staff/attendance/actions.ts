"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { VALID_STATUSES } from "@/lib/staff-attendance";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Saves one day's attendance for every staff member shown on the page (fields are status_<id> and note_<id>). */
export async function saveStaffAttendance(formData: FormData) {
  const me = await requireRole(["admin"]);
  const date = String(formData.get("date") ?? "");
  const back = (msg: string): never => redirect(`/staff/attendance?date=${date}&error=${encodeURIComponent(msg)}`);

  if (!DATE.test(date)) return back("Choose a valid date.");
  if (date > todayISO()) return back("You cannot mark attendance for a future date.");

  const rows: { staff_id: string; date: string; status: string; note: string | null; marked_by: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("status_")) continue;
    const staffId = key.slice(7);
    const status = String(value);
    if (!UUID.test(staffId) || !VALID_STATUSES.includes(status)) continue;
    const note = String(formData.get(`note_${staffId}`) ?? "").trim().slice(0, 200);
    rows.push({ staff_id: staffId, date, status, note: note || null, marked_by: me.id });
  }
  if (!rows.length) return back("There is no staff to save attendance for.");

  const supabase = await createClient();
  const { error } = await supabase.from("staff_attendance").upsert(rows, { onConflict: "staff_id,date" });
  if (error) {
    return back(
      /relation .*staff_attendance.* does not exist|schema cache/i.test(error.message)
        ? "The staff attendance table is missing. Run supabase/013_staff_attendance.sql in the Supabase SQL Editor first."
        : error.message,
    );
  }

  revalidatePath("/staff/attendance", "layout");
  redirect(`/staff/attendance?date=${date}&saved=1`);
}
