import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { STUDENT_BUCKET } from "@/lib/students";

/**
 * Opens a student's uploaded ID proof. Only admins may use it. The file stays private in storage; this hands out a
 * short-lived link (60 seconds) and sends the browser straight to it.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getProfile();
  if (me.role !== "admin") return NextResponse.redirect(new URL("/", request.url));

  const { id } = await params;
  const supabase = await createClient();
  const { data: student } = await supabase.from("students").select("id_proof_path").eq("id", id).maybeSingle();
  if (!student?.id_proof_path) {
    return NextResponse.redirect(new URL(`/students?error=${encodeURIComponent("No ID proof has been uploaded for this student.")}`, request.url));
  }

  const { data, error } = await supabase.storage.from(STUDENT_BUCKET).createSignedUrl(student.id_proof_path, 60);
  if (error || !data?.signedUrl) {
    return NextResponse.redirect(new URL(`/students?error=${encodeURIComponent("The ID proof file could not be opened.")}`, request.url));
  }
  return NextResponse.redirect(data.signedUrl);
}
