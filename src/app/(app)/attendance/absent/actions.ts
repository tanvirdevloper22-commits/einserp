"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { TEMPLATE_MAX } from "@/lib/absence";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Remembers that a parent was alerted, called when the WhatsApp or SMS button is pressed. */
export async function recordAlert(studentId: string, date: string, channel: "whatsapp" | "sms"): Promise<{ ok: boolean }> {
  const me = await requireRole(["admin", "teacher"]);
  if (!UUID.test(studentId) || !DATE.test(date) || date > todayISO() || (channel !== "whatsapp" && channel !== "sms")) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("absence_alerts").insert({
    student_id: studentId,
    alert_date: date,
    channel,
    sent_by: me.id,
    sent_by_name: me.fullName || me.email,
  });
  revalidatePath("/attendance/absent");
  return { ok: !error };
}

/** Saves the message text (admins only). Empty goes back to the default text. */
export async function saveTemplate(formData: FormData) {
  await requireRole(["admin"]);
  const back = String(formData.get("back") ?? "");
  const to = (qs: string): never => redirect(`/attendance/absent?${back ? `${back}&` : ""}${qs}`);
  const message = String(formData.get("absent_message") ?? "").trim();
  if (message.length > TEMPLATE_MAX) return to(`error=${encodeURIComponent(`The message can be at most ${TEMPLATE_MAX} characters.`)}`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("school_settings")
    .upsert({ id: 1, absent_message: message || null, updated_at: new Date().toISOString() });
  if (error) {
    return to(
      `error=${encodeURIComponent(
        /absent_message|schema cache|column/i.test(error.message)
          ? "The database is missing the alert message field. Run supabase/020_absence_alerts.sql in the Supabase SQL Editor first."
          : error.message,
      )}`,
    );
  }
  revalidatePath("/attendance/absent");
  return to("saved=1");
}
