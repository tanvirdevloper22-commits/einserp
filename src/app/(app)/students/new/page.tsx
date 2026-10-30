import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { emptyStudent } from "@/lib/students";
import { matchClass } from "@/lib/enquiries";
import PageHeader from "@/components/PageHeader";
import StudentForm from "@/components/StudentForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "New admission" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NewAdmissionPage({ searchParams }: { searchParams: Promise<{ enquiry?: string }> }) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data: classes } = await supabase.from("classes").select("id, name, section").order("name");
  const sp = await searchParams;

  // Coming from an enquiry: fill in what the parent already told the school.
  const initial = emptyStudent();
  let enquiryId: string | undefined;
  if (sp.enquiry && UUID.test(sp.enquiry)) {
    const { data: enq } = await supabase.from("enquiries").select("id, child_name, class_applied, guardian_name, phone, email, status").eq("id", sp.enquiry).maybeSingle();
    if (enq && enq.status !== "admitted") {
      enquiryId = enq.id as string;
      initial.full_name = enq.child_name as string;
      initial.guardian_name = (enq.guardian_name as string | null) ?? "";
      initial.guardian_phone = enq.phone as string;
      initial.guardian_email = (enq.email as string | null) ?? "";
      initial.class_id = matchClass(enq.class_applied as string | null, classes ?? []);
    }
  }

  return (
    <>
      <PageHeader
        title="New admission"
        description="Fill in the details, add the photo and ID proof, then print the admission form for signatures."
      >
        <Link className="btn ghost" href="/students">Back to students</Link>
      </PageHeader>
      {enquiryId && <div className="notice info">Details from the enquiry are filled in. Saving this admission marks the enquiry as admitted.</div>}
      <StudentForm mode="create" classes={classes ?? []} initial={initial} today={todayISO()} enquiryId={enquiryId} />
    </>
  );
}
