import { createClient } from "@/lib/supabase/server";

export type SchoolSettings = {
  school_name: string;
  address: string;
  phone: string;
  email: string;
  upi_id: string;
  upi_name: string;
  invoice_note: string;
};

/** Reads the single settings row. Falls back to blanks if migration 004 has not been run yet. */
export async function getSettings(): Promise<SchoolSettings> {
  const supabase = await createClient();
  const { data } = await supabase.from("school_settings").select("*").eq("id", 1).maybeSingle();
  return {
    school_name: data?.school_name || "Your School",
    address: data?.address ?? "",
    phone: data?.phone ?? "",
    email: data?.email ?? "",
    upi_id: data?.upi_id ?? "",
    upi_name: data?.upi_name ?? "",
    invoice_note: data?.invoice_note ?? "",
  };
}
