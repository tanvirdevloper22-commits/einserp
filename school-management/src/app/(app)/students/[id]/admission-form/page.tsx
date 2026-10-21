import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatDate } from "@/lib/dates";
import { STUDENT_BUCKET } from "@/lib/students";
import PageHeader from "@/components/PageHeader";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admission form" };

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const GENDER: Record<string, string> = { male: "Male", female: "Female", other: "Other" };

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="af-row">
      <span className="af-label">{label}</span>
      <span className="af-value">{value || ""}</span>
    </div>
  );
}

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

      <div className="card admission">
        <header className="af-head">
          <div>
            <div className="school-id">
              {settings.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="school-logo" src={settings.logoUrl} alt="" />
              )}
              <div>
                <h2>{settings.school_name}</h2>
                {settings.address && <div className="cell-sub">{settings.address}</div>}
                {(settings.phone || settings.email) && (
                  <div className="cell-sub">{[settings.phone, settings.email].filter(Boolean).join("  |  ")}</div>
                )}
              </div>
            </div>
            <div className="af-title">Admission form</div>
          </div>
          <div className="af-photo">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="Student photo" />
            ) : (
              <span>Affix photo here</span>
            )}
          </div>
        </header>

        <div className="af-grid three">
          <Row label="Admission no." value={s.admission_no} />
          <Row label="Admission date" value={formatDate(s.admission_date ?? s.created_at)} />
          <Row label="Class" value={cls ? `${cls.name} - ${cls.section}` : ""} />
        </div>

        <h3 className="af-section">Student details</h3>
        <div className="af-grid">
          <Row label="Full name" value={s.full_name} />
          <Row label="Date of birth" value={s.dob ? formatDate(s.dob) : ""} />
          <Row label="Gender" value={s.gender ? GENDER[s.gender] ?? s.gender : ""} />
          <Row label="Blood group" value={s.blood_group} />
          <Row label="Previous school" value={s.previous_school} />
        </div>

        <h3 className="af-section">Parents and guardian</h3>
        <div className="af-grid">
          <Row label="Father's name" value={s.father_name} />
          <Row label="Mother's name" value={s.mother_name} />
          <Row label="Guardian (main contact)" value={s.guardian_name} />
          <Row label="Phone" value={s.guardian_phone} />
          <Row label="Alternate phone" value={s.alternate_phone} />
          <Row label="Email" value={s.guardian_email} />
        </div>
        <div className="af-grid one">
          <Row label="Address" value={s.address} />
        </div>

        <h3 className="af-section">ID proof submitted</h3>
        <div className="af-grid">
          <Row label="Document" value={s.id_proof_type} />
          <Row label="Document number" value={s.id_proof_number} />
          <Row label="Copy attached" value={s.id_proof_path ? "Yes" : "No"} />
        </div>

        <p className="af-declaration">
          I declare that the information given above is true and complete. I agree to follow the rules and
          regulations of the school and to pay the fees on time.
        </p>

        <div className="af-sign">
          <div><div className="af-line" />Student&apos;s signature</div>
          <div><div className="af-line" />Parent or guardian&apos;s signature</div>
          <div><div className="af-line" />Date</div>
        </div>

        <div className="af-office">
          <span>For office use</span>
          <div className="af-sign" style={{ marginTop: 36 }}>
            <div><div className="af-line" />Checked by</div>
            <div><div className="af-line" />Principal or admin&apos;s signature and stamp</div>
          </div>
        </div>
      </div>
    </div>
  );
}
