import { createClient } from "@/lib/supabase/server";
import { DOC_TEMPLATES, ID_TEMPLATES, pickAccent, pickTemplate } from "@/lib/templates";

export const ASSET_BUCKET = "school-assets";
export const LOGO_PATH = "logo.png";

export type SchoolSettings = {
  school_name: string;
  address: string;
  phone: string;
  email: string;
  upi_id: string;
  upi_name: string;
  invoice_note: string;
  session_label: string;
  invoice_template: string;
  report_template: string;
  admission_template: string;
  timetable_template: string;
  idcard_template: string;
  accent_color: string;
  /** Public URL of the school logo, or null when none has been uploaded. */
  logoUrl: string | null;
};

/** Reads the single settings row. Falls back to blanks and the Classic templates if migrations 004, 006 or 009 have not been run yet. */
export async function getSettings(): Promise<SchoolSettings> {
  const supabase = await createClient();
  const { data } = await supabase.from("school_settings").select("*").eq("id", 1).maybeSingle();

  let logoUrl: string | null = null;
  if (data?.logo_path) {
    const { data: pub } = supabase.storage.from(ASSET_BUCKET).getPublicUrl(data.logo_path);
    // The file name never changes, so the update time is added to bypass the browser cache after a new upload.
    const version = data.updated_at ? `?v=${encodeURIComponent(String(data.updated_at))}` : "";
    logoUrl = pub.publicUrl + version;
  }

  return {
    school_name: data?.school_name || "Your School",
    address: data?.address ?? "",
    phone: data?.phone ?? "",
    email: data?.email ?? "",
    upi_id: data?.upi_id ?? "",
    upi_name: data?.upi_name ?? "",
    invoice_note: data?.invoice_note ?? "",
    session_label: data?.session_label ?? "",
    invoice_template: pickTemplate(data?.invoice_template, DOC_TEMPLATES),
    report_template: pickTemplate(data?.report_template, DOC_TEMPLATES),
    admission_template: pickTemplate(data?.admission_template, DOC_TEMPLATES),
    timetable_template: pickTemplate(data?.timetable_template, DOC_TEMPLATES),
    idcard_template: pickTemplate(data?.idcard_template, ID_TEMPLATES),
    accent_color: pickAccent(data?.accent_color),
    logoUrl,
  };
}
