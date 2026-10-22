import { Fragment } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { STUDENT_BUCKET } from "@/lib/students";
import PageHeader from "@/components/PageHeader";
import { mirrorRows, toSheets } from "@/lib/idcards";
import PrintButton from "@/components/PrintButton";
import { IdCardFront, IdCardBack, type IdCardStudent, type IdCardSchool } from "@/components/IdCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "ID cards" };

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export default async function IdCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; student?: string; sides?: string }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const supabase = await createClient();
  const settings = await getSettings();
  const frontOnly = sp.sides === "front";

  const { data: classes } = await supabase.from("classes").select("id, name, section").order("name");

  let students: IdCardStudent[] = [];
  let loadError: string | null = null;

  if (sp.student || sp.class) {
    let q = supabase
      .from("students")
      .select("id, full_name, admission_no, dob, blood_group, guardian_name, guardian_phone, address, photo_path, classes(name, section)")
      .order("full_name");
    q = sp.student ? q.eq("id", sp.student) : q.eq("class_id", sp.class!).eq("status", "active");
    const { data, error } = await q;
    if (error) {
      loadError = /column .* does not exist|schema cache/i.test(error.message)
        ? "The database is missing the admission fields. Run supabase/005_admission_files.sql in the Supabase SQL Editor first."
        : error.message;
    }

    const rows = data ?? [];
    const paths = rows.map((r) => r.photo_path).filter((p): p is string => Boolean(p));
    const urls = new Map<string, string>();
    if (paths.length) {
      const { data: signed } = await supabase.storage.from(STUDENT_BUCKET).createSignedUrls(paths, 3600);
      signed?.forEach((s) => {
        if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
      });
    }

    students = rows.map((r) => {
      const cls = one(r.classes);
      return {
        id: r.id,
        full_name: r.full_name,
        admission_no: r.admission_no,
        dob: r.dob,
        blood_group: r.blood_group,
        guardian_name: r.guardian_name,
        guardian_phone: r.guardian_phone,
        address: r.address,
        className: cls ? `Class ${cls.name.replace(/^class\s*/i, "")} - ${cls.section}` : "",
        photoUrl: r.photo_path ? urls.get(r.photo_path) ?? null : null,
      };
    });
  }

  const school: IdCardSchool = {
    name: settings.school_name,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
    session: settings.session_label,
    logoUrl: settings.logoUrl,
    template: settings.idcard_template,
    accent: settings.accent_color,
  };

  const sheets = toSheets(students);
  const noPhoto = students.filter((s) => !s.photoUrl);

  return (
    <div className="idcards-page">
      <PageHeader
        title="ID cards"
        description="Print student ID cards on A4 paper, nine to a page, ready to cut and laminate."
      >
        <Link className="btn ghost" href="/students">Back to students</Link>
        {students.length > 0 && <PrintButton />}
      </PageHeader>

      <form method="get" className="card toolbar no-print">
        <div className="row">
          <div className="grow" style={{ maxWidth: 260 }}>
            <label htmlFor="class">Class</label>
            <select id="class" name="class" defaultValue={sp.student ? "" : sp.class ?? ""}>
              <option value="">Select a class</option>
              {classes?.map((c) => (
                <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
              ))}
            </select>
          </div>
          <div style={{ width: 200 }}>
            <label htmlFor="sides">Print</label>
            <select id="sides" name="sides" defaultValue={frontOnly ? "front" : "both"}>
              <option value="both">Front and back</option>
              <option value="front">Front only</option>
            </select>
          </div>
          <button className="btn ghost">Show cards</button>
        </div>
      </form>

      {loadError && <div className="error no-print">{loadError}</div>}

      {!sp.student && !sp.class && (
        <div className="card no-print">
          <div className="empty">
            <strong>Choose a class</strong>
            Pick a class above to preview its ID cards, or use the ID card button next to a student for a single card.
          </div>
        </div>
      )}

      {(sp.student || sp.class) && !loadError && students.length === 0 && (
        <div className="card no-print">
          <div className="empty">
            <strong>No students to print</strong>
            This class has no active students.
          </div>
        </div>
      )}

      {students.length > 0 && (
        <>
          <div className="notice info no-print">
            {students.length} {students.length === 1 ? "card" : "cards"} on {sheets.length} {sheets.length === 1 ? "sheet" : "sheets"}
            {frontOnly ? "" : ", each with a back side"}.
            {!frontOnly && " For two-sided printing, choose the double-sided option that flips on the long edge, so the backs line up with the fronts."}
            {noPhoto.length > 0 && (
              <>
                {" "}<strong>{noPhoto.length} without a photo:</strong> {noPhoto.map((s) => s.full_name).join(", ")}. Add photos from Students, Edit.
              </>
            )}
            {!settings.logoUrl && " No school logo yet; add one under Settings."}
          </div>

          {sheets.map((sheet, i) => (
            <Fragment key={i}>
              <div className="sheet-label no-print">Sheet {i + 1}, front</div>
              <div className="id-sheet">
                {sheet.map((s) => <IdCardFront key={s.id} student={s} school={school} />)}
              </div>

              {!frontOnly && (
                <>
                  <div className="sheet-label no-print">Sheet {i + 1}, back (printed on the reverse side)</div>
                  <div className="id-sheet">
                    {mirrorRows(sheet).map((s, j) =>
                      s ? <IdCardBack key={s.id} student={s} school={school} /> : <div key={`blank-${j}`} className="idc-blank" />
                    )}
                  </div>
                </>
              )}
            </Fragment>
          ))}
        </>
      )}
    </div>
  );
}
