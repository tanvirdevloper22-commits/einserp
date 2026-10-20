import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { STUDENT_BUCKET, studentToInput } from "@/lib/students";
import PageHeader from "@/components/PageHeader";
import StudentForm from "@/components/StudentForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit student" };

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["admin"]);
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: student }, { data: classes }] = await Promise.all([
    supabase.from("students").select("*").eq("id", id).maybeSingle(),
    supabase.from("classes").select("id, name, section").order("name"),
  ]);
  if (!student) notFound();

  const sign = async (path: string | null) => {
    if (!path) return null;
    const { data } = await supabase.storage.from(STUDENT_BUCKET).createSignedUrl(path, 600);
    return data?.signedUrl ?? null;
  };
  const [photoUrl, idProofUrl] = await Promise.all([sign(student.photo_path), sign(student.id_proof_path)]);

  return (
    <>
      <PageHeader title="Edit student" description={`${student.full_name} (${student.admission_no})`}>
        <Link className="btn ghost" href={`/students/${id}/admission-form`}>Admission form</Link>
        <Link className="btn ghost" href="/students">Back to students</Link>
      </PageHeader>
      <StudentForm
        mode="update"
        studentId={id}
        classes={classes ?? []}
        initial={studentToInput(student)}
        currentPhotoUrl={photoUrl}
        currentIdProofUrl={idProofUrl}
        today={todayISO()}
      />
    </>
  );
}
