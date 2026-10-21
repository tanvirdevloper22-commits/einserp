"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { ASSET_BUCKET, LOGO_PATH } from "@/lib/settings";

type Result = { ok: true } | { error: string };

function explain(message: string): string {
  return /column .* does not exist|schema cache|logo_path/i.test(message)
    ? "The database is missing the logo fields. Run supabase/006_logo_idcards.sql in the Supabase SQL Editor first."
    : message;
}

function refresh() {
  for (const p of ["/settings", "/fees", "/students"]) revalidatePath(p, "layout");
}

/** Records that a logo file has been uploaded to storage. The file itself is uploaded from the browser. */
export async function attachLogo(): Promise<Result> {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("school_settings")
    .upsert({ id: 1, logo_path: LOGO_PATH, updated_at: new Date().toISOString() });
  if (error) return { error: explain(error.message) };
  refresh();
  return { ok: true };
}

export async function removeLogo(): Promise<Result> {
  await requireRole(["admin"]);
  const supabase = await createClient();
  await supabase.storage.from(ASSET_BUCKET).remove([LOGO_PATH]);
  const { error } = await supabase
    .from("school_settings")
    .update({ logo_path: null, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return { error: explain(error.message) };
  refresh();
  return { ok: true };
}
