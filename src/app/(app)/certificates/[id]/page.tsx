import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatDate } from "@/lib/dates";
import { accentStyle } from "@/lib/templates";
import { certNumber, certType, dateInWords, relationWord } from "@/lib/certificates";
import PageHeader from "@/components/PageHeader";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Certificate" };

type Cert = {
  cert_type: string; cert_no: number; issued_on: string; student_name: string; admission_no: string;
  father_name: string | null; mother_name: string | null; guardian_name: string | null; dob: string | null; gender: string | null;
  class_name: string | null; admission_date: string | null; session_label: string | null; leaving_date: string | null;
  reason: string | null; conduct: string | null; purpose: string | null; remarks: string | null; dues_cleared: boolean | null;
  issued_by_name: string | null;
};

const parentName = (c: Cert) => c.father_name || c.guardian_name || c.mother_name || "";

function TransferBody({ c }: { c: Cert }) {
  const rows: [string, React.ReactNode][] = [
    ["Name of the student", <strong key="n">{c.student_name}</strong>],
    ["Father's / guardian's name", c.father_name || c.guardian_name || "-"],
    ["Mother's name", c.mother_name || "-"],
    ["Date of birth (in figures)", formatDate(c.dob)],
    ["Date of birth (in words)", dateInWords(c.dob) || "-"],
    ["Admission number", c.admission_no],
    ["Date of admission", formatDate(c.admission_date)],
    ["Class in which last studied", c.class_name || "-"],
    ["Date of leaving the school", formatDate(c.leaving_date)],
    ["Reason for leaving", c.reason || "-"],
    ["General conduct", c.conduct || "-"],
    ["School dues", c.dues_cleared === false ? "Not cleared at the time of issue" : "All dues have been paid"],
    ["Remarks", c.remarks || "-"],
  ];
  return (
    <div className="cert-rows">
      {rows.map(([label, value], i) => (
        <div key={label} className="cert-row">
          <span className="cert-no">{i + 1}.</span>
          <span className="cert-label">{label}</span>
          <span className="cert-value">{value}</span>
        </div>
      ))}
    </div>
  );
}

function BonafideBody({ c }: { c: Cert }) {
  return (
    <div className="cert-text">
      <p>
        This is to certify that <strong>{c.student_name}</strong>, {relationWord(c.gender)} <strong>{parentName(c) || "the guardian"}</strong>,
        is a bonafide student of this school, studying in <strong>Class {c.class_name || "-"}</strong>
        {c.session_label ? <> during the academic session <strong>{c.session_label}</strong></> : null}. The admission number is{" "}
        <strong>{c.admission_no}</strong>{c.dob ? <> and the date of birth as per school records is <strong>{formatDate(c.dob)}</strong> ({dateInWords(c.dob)})</> : null}.
      </p>
      {c.purpose && <p>This certificate is issued on request for the purpose of <strong>{c.purpose}</strong>.</p>}
      {c.remarks && <p>{c.remarks}</p>}
    </div>
  );
}

function CharacterBody({ c }: { c: Cert }) {
  return (
    <div className="cert-text">
      <p>
        This is to certify that <strong>{c.student_name}</strong>, {relationWord(c.gender)} <strong>{parentName(c) || "the guardian"}</strong>
        {c.admission_date ? <>, has been studying in this school since <strong>{formatDate(c.admission_date)}</strong></> : null}
        {c.leaving_date ? <> until <strong>{formatDate(c.leaving_date)}</strong></> : <> and is currently in <strong>Class {c.class_name || "-"}</strong></>}.
        Admission number: <strong>{c.admission_no}</strong>.
      </p>
      <p>
        During this period the student&apos;s character and conduct have been <strong>{(c.conduct || "good").toLowerCase()}</strong>.
      </p>
      {c.purpose && <p>This certificate is issued on request for the purpose of <strong>{c.purpose}</strong>.</p>}
      {c.remarks && <p>{c.remarks}</p>}
    </div>
  );
}

export default async function CertificatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ issued?: string }>;
}) {
  await requireRole(["admin"]);
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("certificates").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const c = data as Cert;
  const settings = await getSettings();
  const meta = certType(c.cert_type);
  const number = certNumber(c.cert_type, c.cert_no);

  return (
    <>
      <PageHeader title={meta?.title ?? "Certificate"} description={`${number} · ${c.student_name}`}>
        <Link className="btn ghost" href="/certificates">Back to certificates</Link>
        <PrintButton />
      </PageHeader>

      {sp.issued && <div className="notice ok no-print">Certificate {number} issued. You can print it now.</div>}

      <div className="card invoice cert" data-doc={settings.invoice_template} style={accentStyle(settings.accent_color)}>
        <div className="invoice-top">
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
          <div className="invoice-meta">
            <div className="inv-no">{number}</div>
            <div className="cell-sub">Date of issue: {formatDate(c.issued_on)}</div>
            {c.session_label && <div className="cell-sub">Session {c.session_label}</div>}
          </div>
        </div>

        <h1 className="cert-title">{(meta?.title ?? "Certificate").toUpperCase()}</h1>

        {c.cert_type === "transfer" && <TransferBody c={c} />}
        {c.cert_type === "bonafide" && <BonafideBody c={c} />}
        {c.cert_type === "character" && <CharacterBody c={c} />}

        <div className="cert-sign">
          <div><span>Prepared by</span></div>
          <div><span>Checked by</span></div>
          <div><span>Principal</span></div>
        </div>
        <p className="cell-sub" style={{ marginTop: 18, marginBottom: 0 }}>
          Place: {settings.address ? settings.address.split(",").slice(-1)[0].trim() || "-" : "-"} · Issued by {c.issued_by_name || "the school office"}.
        </p>
      </div>
    </>
  );
}
