import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import Scanner from "./Scanner";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scan attendance" };

export default async function ScanPage() {
  await requireRole(["admin", "teacher"]);
  const supabase = await createClient();
  const { data: classes } = await supabase.from("classes").select("id, name, section").order("name").order("section");
  return (
    <>
      <PageHeader title="Scan attendance" description="Scan the QR code on a student ID card to mark that student present for today.">
        <Link className="btn ghost" href="/attendance">Back to attendance</Link>
      </PageHeader>
      <Scanner classes={classes ?? []} />
    </>
  );
}
