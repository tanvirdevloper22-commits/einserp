"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { saveStudent, attachStudentFiles } from "@/app/(app)/students/actions";
import {
  BLOOD_GROUPS,
  ID_PROOF_TYPES,
  STUDENT_BUCKET,
  PHOTO_PATH,
  ID_PROOF_PATH,
  type StudentInput,
} from "@/lib/students";

type ClassOption = { id: string; name: string; section: string };

type Props = {
  mode: "create" | "update";
  classes: ClassOption[];
  initial: StudentInput;
  studentId?: string;
  currentPhotoUrl?: string | null;
  currentIdProofUrl?: string | null;
  today: string;
};

const MAX_PDF_BYTES = 5 * 1024 * 1024;

export default function StudentForm({ mode, classes, initial, studentId, currentPhotoUrl, currentIdProofUrl, today }: Props) {
  const router = useRouter();
  const idRef = useRef(studentId ?? "");
  const savedRef = useRef(mode === "update");
  const [photo, setPhoto] = useState<File | null>(null);
  const [idProof, setIdProof] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!idRef.current) idRef.current = crypto.randomUUID();
  }, []);

  useEffect(() => {
    if (!photo) return setPhotoPreview(null);
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const isCreate = mode === "create";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    if (isCreate && !photo) return setError("Add the student's photo.");
    if (isCreate && !idProof) return setError("Add a copy of the ID proof.");
    if (idProof && idProof.type === "application/pdf" && idProof.size > MAX_PDF_BYTES) {
      return setError("The ID proof PDF is larger than 5 MB. Use a smaller file or a photo of the document.");
    }

    const fd = new FormData(e.currentTarget);
    const get = (k: keyof StudentInput) => String(fd.get(k) ?? "").trim();
    const input: StudentInput = {
      admission_no: get("admission_no"),
      full_name: get("full_name"),
      dob: get("dob"),
      gender: get("gender"),
      class_id: get("class_id"),
      admission_date: get("admission_date"),
      blood_group: get("blood_group"),
      previous_school: get("previous_school"),
      father_name: get("father_name"),
      mother_name: get("mother_name"),
      guardian_name: get("guardian_name"),
      guardian_phone: get("guardian_phone"),
      alternate_phone: get("alternate_phone"),
      guardian_email: get("guardian_email"),
      address: get("address"),
      id_proof_type: get("id_proof_type"),
      id_proof_number: get("id_proof_number"),
      status: get("status") || "active",
    };

    const id = idRef.current;
    setBusy("Saving details...");
    const saved = await saveStudent(savedRef.current ? "update" : "create", id, input);
    if ("error" in saved) {
      setBusy(null);
      return setError(saved.error);
    }
    savedRef.current = true;

    try {
      const supabase = createClient();
      const uploaded: { photo?: boolean; idProof?: "jpg" | "pdf" } = {};

      if (photo) {
        setBusy("Uploading photo...");
        const blob = await compressImage(photo, 800, 0.85);
        const { error: upErr } = await supabase.storage
          .from(STUDENT_BUCKET)
          .upload(PHOTO_PATH(id), blob, { upsert: true, contentType: "image/jpeg" });
        if (upErr) throw new Error(upErr.message);
        uploaded.photo = true;
      }

      if (idProof) {
        setBusy("Uploading ID proof...");
        const isPdf = idProof.type === "application/pdf";
        const ext = isPdf ? "pdf" : "jpg";
        const body = isPdf ? idProof : await compressImage(idProof, 1600, 0.8);
        const { error: upErr } = await supabase.storage
          .from(STUDENT_BUCKET)
          .upload(ID_PROOF_PATH(id, ext), body, { upsert: true, contentType: isPdf ? "application/pdf" : "image/jpeg" });
        if (upErr) throw new Error(upErr.message);
        uploaded.idProof = ext;
      }

      if (uploaded.photo || uploaded.idProof) {
        const attached = await attachStudentFiles(id, uploaded);
        if ("error" in attached) throw new Error(attached.error);
      }
    } catch (err) {
      setBusy(null);
      const message = err instanceof Error ? err.message : "Unknown error";
      return setError(
        `The student was saved, but a file could not be uploaded: ${message}. Press the save button again to retry the upload.`
      );
    }

    setBusy("Done");
    router.push(isCreate ? `/students/${id}/admission-form?new=1` : "/students");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="stack">
      {error && <div className="error" role="alert">{error}</div>}

      <div className="card">
        <h2>Student details</h2>
        <div className="form-grid">
          <Field id="admission_no" label="Admission number" required defaultValue={initial.admission_no} />
          <Field id="full_name" label="Full name" required defaultValue={initial.full_name} />
          <Field id="admission_date" label="Admission date" type="date" defaultValue={initial.admission_date || today} />
          <div>
            <label htmlFor="class_id">Class{isCreate && " *"}</label>
            <select id="class_id" name="class_id" defaultValue={initial.class_id} required={isCreate}>
              <option value="">Select a class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
              ))}
            </select>
          </div>
          <Field id="dob" label="Date of birth" type="date" required={isCreate} defaultValue={initial.dob} />
          <div>
            <label htmlFor="gender">Gender{isCreate && " *"}</label>
            <select id="gender" name="gender" defaultValue={initial.gender} required={isCreate}>
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label htmlFor="blood_group">Blood group</label>
            <select id="blood_group" name="blood_group" defaultValue={initial.blood_group}>
              <option value="">Not known</option>
              {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <Field id="previous_school" label="Previous school" defaultValue={initial.previous_school} />
          {!isCreate && (
            <div>
              <label htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue={initial.status || "active"}>
                <option value="active">Active</option>
                <option value="left">Left school</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Parents and guardian</h2>
        <div className="form-grid">
          <Field id="father_name" label="Father's name" defaultValue={initial.father_name} />
          <Field id="mother_name" label="Mother's name" defaultValue={initial.mother_name} />
          <Field id="guardian_name" label="Parent or guardian (main contact)" required={isCreate} defaultValue={initial.guardian_name} />
          <Field id="guardian_phone" label="Phone number" type="tel" required={isCreate} defaultValue={initial.guardian_phone} />
          <Field id="alternate_phone" label="Alternate phone" type="tel" defaultValue={initial.alternate_phone} />
          <Field id="guardian_email" label="Email" type="email" defaultValue={initial.guardian_email} />
        </div>
        <div style={{ marginTop: 16 }}>
          <label htmlFor="address">Address</label>
          <textarea id="address" name="address" rows={2} defaultValue={initial.address} />
        </div>
      </div>

      <div className="card">
        <h2>Photo and ID proof</h2>
        <div className="upload-grid">
          <div>
            <label htmlFor="photo">Student photo{isCreate && " *"}</label>
            <div className="upload">
              <div className="upload-thumb">
                {photoPreview || currentPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoPreview ?? currentPhotoUrl ?? ""} alt="Student photo preview" />
                ) : (
                  <span>No photo</span>
                )}
              </div>
              <div>
                <input id="photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
                <span className="cell-sub" style={{ marginTop: 6 }}>
                  A clear face photo. Large photos are shrunk automatically before upload.
                </span>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="id_proof_type">ID proof{isCreate && " *"}</label>
            <div className="form-grid one">
              <select id="id_proof_type" name="id_proof_type" defaultValue={initial.id_proof_type} required={isCreate}>
                <option value="">Select the document type</option>
                {ID_PROOF_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input name="id_proof_number" placeholder="Document number (optional)" defaultValue={initial.id_proof_number} autoComplete="off" />
              <input id="id_proof" type="file" accept="image/*,application/pdf" aria-label="ID proof file" onChange={(e) => setIdProof(e.target.files?.[0] ?? null)} />
              {currentIdProofUrl && !idProof && (
                <a className="cell-sub" href={currentIdProofUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
                  View the ID proof on file
                </a>
              )}
              <span className="cell-sub">A photo or PDF of the document, up to 5 MB. Only admins can open it.</span>
            </div>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button className="btn" disabled={Boolean(busy)}>
          {busy ?? (isCreate ? "Save and open admission form" : "Save changes")}
        </button>
        <Link className="btn ghost" href="/students">Cancel</Link>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  type = "text",
  required,
  defaultValue,
}: {
  id: keyof StudentInput;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div>
      <label htmlFor={id}>{label}{required && " *"}</label>
      <input id={id} name={id} type={type} required={required} defaultValue={defaultValue ?? ""} />
    </div>
  );
}
