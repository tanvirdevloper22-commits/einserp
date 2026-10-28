import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import Scanner from "./Scanner";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scan attendance" };

export default async function ScanPage() {
  const me = await requireRole(["admin", "teacher", "attender"]);
  const canFinish = me.role !== "attender";
  const supabase = await createClient();
  // The gate attender has no access to the class list; only admins and teachers use "Mark rest absent".
  const classes = canFinish ? ((await supabase.from("classes").select("id, name, section").order("name").order("section")).data ?? []) : [];
  return (
    <>
      <PageHeader title="Scan attendance" description="Scan the QR code on a student ID card to mark that student present for today.">
        {canFinish && <Link className="btn ghost" href="/attendance">Back to attendance</Link>}
      </PageHeader>
      <Scanner classes={classes} canFinish={canFinish} />
    </>
  );
}
