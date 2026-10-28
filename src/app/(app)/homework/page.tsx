import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { TITLE_MAX, DETAILS_MAX, type Homework } from "@/lib/homework";
import PageHeader from "@/components/PageHeader";
import HomeworkList from "@/components/HomeworkList";
import { createHomework } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Homework" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function HomeworkPage({ searchParams }: { searchParams: Promise<{ error?: string; posted?: string; class?: string }> }) {
  const me = await requireRole(["admin", "teacher"]);
  const sp = await searchParams;
  const supabase = await createClient();
  const filter = sp.class && UUID.test(sp.class) ? sp.class : "";

  let query = supabase
    .from("homework")
    .select("id, class_id, title, details, assigned_on, due_date, created_by, created_by_name, created_at, subjects(name), classes(name, section)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (filter) query = query.eq("class_id", filter);

  const [{ data, error }, { data: classes }, { data: subjects }] = await Promise.all([
    query,
    supabase.from("classes").select("id, name, section").order("name").order("section"),
    supabase.from("subjects").select("id, name").order("name"),
  ]);
  const items = (data ?? []) as unknown as Homework[];

  return (
    <>
      <PageHeader title="Homework" description="Post homework for a class. Parents see it in their portal." />

      {sp.posted && <div className="notice ok">Homework posted.</div>}
      {sp.error && <div className="error">{sp.error}</div>}
      {error && <div className="error">The homework table is missing. Run supabase/018_homework.sql in the Supabase SQL Editor first.</div>}

      <form action={createHomework} className="card" style={{ marginBottom: 24 }}>
        <h2>New homework</h2>
        <div className="form-grid">
          <div>
            <label htmlFor="class_id">Class</label>
            <select id="class_id" name="class_id" required defaultValue={filter}>
              <option value="" disabled>Choose a class</option>
              {(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="subject_id">Subject (optional)</label>
            <select id="subject_id" name="subject_id" defaultValue="">
              <option value="">No subject</option>
              {(subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="title">Title</label>
            <input id="title" name="title" required maxLength={TITLE_MAX} placeholder="e.g. Chapter 5 exercise questions 1 to 10" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="details">Details (optional)</label>
            <textarea id="details" name="details" rows={3} maxLength={DETAILS_MAX} placeholder="Instructions, page numbers, what to bring" />
          </div>
          <div>
            <label htmlFor="due_date">Due date (optional)</label>
            <input id="due_date" name="due_date" type="date" min={todayISO()} />
          </div>
        </div>
        <div className="form-actions"><button className="btn">Post homework</button></div>
      </form>

      <form method="get" className="card toolbar">
        <div className="row">
          <div className="grow" style={{ maxWidth: 280 }}>
            <label htmlFor="f_class">Show class</label>
            <select id="f_class" name="class" defaultValue={filter}>
              <option value="">All classes</option>
              {(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
            </select>
          </div>
          <button className="btn ghost">Filter</button>
        </div>
      </form>

      {items.length === 0 ? (
        <div className="card empty"><strong>No homework yet</strong>Post the first one using the form above.</div>
      ) : (
        <HomeworkList items={items} showClass manage={{ role: me.role as "admin" | "teacher", userId: me.id }} />
      )}
    </>
  );
}
