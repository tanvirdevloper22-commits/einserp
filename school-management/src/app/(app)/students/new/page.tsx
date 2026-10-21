import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { emptyStudent } from "@/lib/students";
import PageHeader from "@/components/PageHeader";
import StudentForm from "@/components/StudentForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "New admission" };

export default async function NewAdmissionPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data: classes } = await supabase.from("classes").select("id, name, section").order("name");

  return (
    <>
      <PageHeader
        title="New admission"
        description="Fill in the details, add the photo and ID proof, then print the admission form for signatures."
      >
        <Link className="btn ghost" href="/students">Back to students</Link>
      </PageHeader>
      <StudentForm mode="create" classes={classes ?? []} initial={emptyStudent()} today={todayISO()} />
    </>
  );
}
