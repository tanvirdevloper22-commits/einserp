import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import { getTodayStats } from "../scan/actions";
import Stats from "./Stats";
import FinishClass from "./FinishClass";

export const dynamic = "force-dynamic";
export const metadata = { title: "Today's attendance" };

export default async function StatsPage() {
  const me = await requireRole(["admin", "teacher", "attender"]);
  const canFinish = me.role !== "attender";
  const [initial, classes] = await Promise.all([
    getTodayStats(),
    canFinish
      ? createClient().then(async (s) => (await s.from("classes").select("id, name, section").order("name").order("section")).data ?? [])
      : Promise.resolve([] as { id: string; name: string; section: string }[]),
  ]);
  return (
    <>
      <PageHeader title="Today's attendance" description="Live numbers for the whole school. They update by themselves." />
      <Stats initial={initial.rows} initialError={initial.error ?? ""} />
      {canFinish && <FinishClass classes={classes} />}
    </>
  );
}
