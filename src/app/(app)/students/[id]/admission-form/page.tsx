import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatDate } from "@/lib/dates";
import { STUDENT_BUCKET } from "@/lib/students";
import PageHeader from "@/components/PageHeader";
import PrintButton from "@/components/PrintButton";
import AdmissionSheet from "@/components/AdmissionSheet";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admission form" };

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
export default async function AdmissionFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  await requireRole(["admin"]);
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: s }, settings] = await Promise.all([
    supabase.from("students").select("*, classes(name, section)").eq("id", id).maybeSingle(),
    getSettings(),
  ]);
  if (!s) notFound();

  const cls = one(s.classes);
  let photoUrl: string | null = null;
  if (s.photo_path) {
    const { data } = await supabase.storage.from(STUDENT_BUCKET).createSignedUrl(s.photo_path, 600);
    photoUrl = data?.signedUrl ?? null;
  }

  return (
    <div className="admission-page">
      <PageHeader title="Admission form" description={`${s.full_name} (${s.admission_no})`}>
        <Link className="btn ghost" href="/students">Back to students</Link>
        <Link className="btn ghost" href={`/students/${id}/edit`}>Edit details</Link>
        <PrintButton />
      </PageHeader>

      {sp.new && (
        <div className="notice ok no-print">
          Admission saved. Print this form and get the student and parent or guardian to sign it.{" "}
          <Link href="/students/new" style={{ textDecoration: "underline", fontWeight: 600 }}>Add another admission</Link>
        </div>
      )}

      <AdmissionSheet settings={settings} s={s} cls={cls} photoUrl={photoUrl} idProofHref={`/students/${id}/id-proof`} />
    </div>
  );
}
