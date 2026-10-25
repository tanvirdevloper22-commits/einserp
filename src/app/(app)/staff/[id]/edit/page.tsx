import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { EMPTY_STAFF, type StaffInput } from "@/lib/staff";
import { getStaffFormOptions } from "@/lib/staff-options";
import PageHeader from "@/components/PageHeader";
import StaffForm from "@/components/StaffForm";
import { saveStaff } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit staff" };

export default async function EditStaffPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["admin"]);
  const { id } = await params;
  const supabase = await createClient();
  const { data: row } = await supabase.from("staff").select("*").eq("id", id).maybeSingle();
  if (!row) notFound();

  const initial = { ...EMPTY_STAFF };
  for (const key of Object.keys(EMPTY_STAFF) as (keyof StaffInput)[]) {
    initial[key] = (row[key] as string | null) ?? EMPTY_STAFF[key];
  }

  const { classOptions, accountOptions } = await getStaffFormOptions(id);
  return (
    <>
      <PageHeader title={row.full_name as string} description={`Employee no. ${row.employee_no}`} />
      <StaffForm
        mode="update"
        action={saveStaff.bind(null, id)}
        initial={initial}
        classOptions={classOptions}
        accountOptions={accountOptions}
        today={todayISO()}
      />
    </>
  );
}
