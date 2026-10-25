import { requireRole } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { EMPTY_STAFF } from "@/lib/staff";
import { getStaffFormOptions } from "@/lib/staff-options";
import PageHeader from "@/components/PageHeader";
import StaffForm from "@/components/StaffForm";
import { saveStaff } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add staff" };

export default async function NewStaffPage() {
  await requireRole(["admin"]);
  const { classOptions, accountOptions } = await getStaffFormOptions();
  return (
    <>
      <PageHeader title="Add staff member" description="Record a teacher or other school employee." />
      <StaffForm
        mode="create"
        action={saveStaff.bind(null, null)}
        initial={EMPTY_STAFF}
        classOptions={classOptions}
        accountOptions={accountOptions}
        today={todayISO()}
      />
    </>
  );
}
