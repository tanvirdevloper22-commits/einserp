"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { PASS_OUT, classLabel } from "@/lib/promotion";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHUNK = 100; // students per database request, to keep the request address short

const go = (qs: string): never => redirect(`/promotion?${qs}`);

function explain(message: string): string {
  return /promotion_|schema cache|does not exist/i.test(message)
    ? "The promotion tables are missing. Run supabase/017_promotions.sql in the Supabase SQL Editor first."
    : message;
}

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
}

/**
 * Moves the chosen students of a class to another class, or marks them as passed out (left the school).
 * A student is only moved if they are still active in the class they were listed under, so a student who was
 * changed in the meantime is never touched. The run is saved in the history so it can be undone.
 */
export async function promoteClass(formData: FormData) {
  const me = await requireRole(["admin"]);
  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "");
  const newSession = String(formData.get("new_session") ?? "").trim().slice(0, 30);
  const ids = [...new Set(formData.getAll("student").map(String))].filter((id) => UUID.test(id));
  const fail = (message: string): never => go(`from=${from}&error=${encodeURIComponent(message)}`);

  if (!UUID.test(from)) return go("");
  const passOut = to === PASS_OUT;
  if (!passOut && !UUID.test(to)) return fail("Choose the class the students are moving to.");
  if (to === from) return fail("Choose a different class to move the students to.");
  if (!ids.length) return fail("Select at least one student to move.");

  const supabase = await createClient();
  const { data: classRows } = await supabase.from("classes").select("id, name, section").in("id", passOut ? [from] : [from, to]);
  const fromClass = classRows?.find((c) => c.id === from);
  const toClass = classRows?.find((c) => c.id === to);
  if (!fromClass) return fail("That class could not be found.");
  if (!passOut && !toClass) return fail("The class you are moving to could not be found.");

  // Move (or retire) the students, keeping only those that really changed.
  const moved: string[] = [];
  for (const part of chunks(ids)) {
    const base = supabase.from("students");
    const { data, error } = await (passOut ? base.update({ status: "left" }) : base.update({ class_id: to }))
      .in("id", part)
      .eq("class_id", from)
      .eq("status", "active")
      .select("id");
    if (error) {
      await revert(supabase, moved, from, to, passOut);
      return fail(explain(error.message));
    }
    moved.push(...(data ?? []).map((r) => r.id as string));
  }
  if (!moved.length) return fail("None of the selected students could be moved. They may have changed since the list was opened.");

  // The current academic session, read before it is changed, so the history shows "2026-27 to 2027-28".
  const { data: settings } = await supabase.from("school_settings").select("session_label").eq("id", 1).maybeSingle();
  const sessionFrom = (settings?.session_label as string | null) || null;

  const { data: batch, error: batchError } = await supabase
    .from("promotion_batches")
    .insert({
      kind: passOut ? "pass_out" : "promote",
      from_class_id: from,
      to_class_id: passOut ? null : to,
      from_label: classLabel(fromClass),
      to_label: passOut || !toClass ? null : classLabel(toClass),
      session_from: sessionFrom,
      session_to: newSession || sessionFrom,
      student_count: moved.length,
      created_by: me.id,
      created_by_name: me.fullName || me.email,
    })
    .select("id")
    .single();
  let saveError = batchError?.message ?? "";
  if (batch) {
    for (const part of chunks(moved)) {
      const { error } = await supabase.from("promotion_students").insert(part.map((student_id) => ({ batch_id: batch.id, student_id })));
      if (error) { saveError = error.message; break; }
    }
  }
  if (!batch || saveError) {
    // Without a saved history the run could not be undone later, so put everyone back and report it.
    await revert(supabase, moved, from, to, passOut);
    if (batch) await supabase.from("promotion_batches").delete().eq("id", batch.id);
    return fail(explain(saveError));
  }

  if (newSession) {
    await supabase.from("school_settings").upsert({ id: 1, session_label: newSession, updated_at: new Date().toISOString() });
  }

  revalidatePath("/promotion");
  revalidatePath("/students");
  revalidatePath("/", "layout");
  const label = passOut ? "Passed out" : classLabel(toClass!);
  return go(`done=${moved.length}&skipped=${ids.length - moved.length}&to=${encodeURIComponent(label)}`);
}

async function revert(supabase: Awaited<ReturnType<typeof createClient>>, ids: string[], from: string, to: string, passOut: boolean) {
  for (const part of chunks(ids)) {
    if (passOut) await supabase.from("students").update({ status: "active" }).in("id", part).eq("class_id", from).eq("status", "left");
    else await supabase.from("students").update({ class_id: from }).in("id", part).eq("class_id", to);
  }
}

/** Puts back the students of an earlier run. Students who have moved again since then are left alone. */
export async function undoPromotion(formData: FormData) {
  await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return go("");
  const fail = (message: string): never => go(`error=${encodeURIComponent(message)}`);

  const supabase = await createClient();
  const { data: batch } = await supabase.from("promotion_batches").select("*").eq("id", id).maybeSingle();
  if (!batch) return fail("That promotion could not be found.");
  if (batch.undone_at) return fail("That promotion was already undone.");
  if (!batch.from_class_id) return fail("The original class no longer exists, so this promotion cannot be undone.");
  const passOut = batch.kind === "pass_out";
  if (!passOut && !batch.to_class_id) return fail("The class the students moved to no longer exists, so this promotion cannot be undone.");

  const { data: members, error } = await supabase.from("promotion_students").select("student_id").eq("batch_id", id);
  if (error) return fail(explain(error.message));
  const ids = (members ?? []).map((m) => m.student_id as string);

  let restored = 0;
  for (const part of chunks(ids)) {
    const base = supabase.from("students");
    const { data, error: updateError } = await (passOut
      ? base.update({ status: "active" }).in("id", part).eq("class_id", batch.from_class_id).eq("status", "left")
      : base.update({ class_id: batch.from_class_id }).in("id", part).eq("class_id", batch.to_class_id).eq("status", "active")
    ).select("id");
    if (updateError) return fail(explain(updateError.message));
    restored += data?.length ?? 0;
  }

  await supabase.from("promotion_batches").update({ undone_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/promotion");
  revalidatePath("/students");
  return go(`undone=${restored}&of=${ids.length}`);
}
