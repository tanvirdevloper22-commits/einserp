import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { getNotices, postableAudiences, AUDIENCE_LABEL, TITLE_MAX, BODY_MAX } from "@/lib/notices";
import PageHeader from "@/components/PageHeader";
import NoticeList from "@/components/NoticeList";
import { createNotice } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notices" };

export default async function NoticesPage({ searchParams }: { searchParams: Promise<{ error?: string; posted?: string }> }) {
  const me = await getProfile();
  const sp = await searchParams;
  const canPost = me.role === "admin" || me.role === "teacher";
  const audiences = postableAudiences(me.role);

  const supabase = await createClient();
  const [{ notices, error }, classes] = await Promise.all([
    getNotices({ includeExpired: canPost }),
    canPost
      ? supabase.from("classes").select("id, name, section").order("name").then((r) => r.data ?? [])
      : Promise.resolve([] as { id: string; name: string; section: string }[]),
  ]);

  return (
    <>
      <PageHeader
        title="Notices"
        description={canPost ? "Post announcements for parents, staff or a single class." : "Announcements from the school."}
      />

      {sp.posted && <div className="notice ok">Notice posted.</div>}
      {sp.error && <div className="error">{sp.error}</div>}
      {error && (
        <div className="error">
          The notices table is missing. Run supabase/011_notices.sql in the Supabase SQL Editor first.
        </div>
      )}

      {canPost && (
        <form action={createNotice} className="card" style={{ marginBottom: 24 }}>
          <h2>New notice</h2>
          <div className="form-grid">
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="title">Title</label>
              <input id="title" name="title" required maxLength={TITLE_MAX} placeholder="e.g. School closed on Friday" />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="body">Notice</label>
              <textarea id="body" name="body" required rows={4} maxLength={BODY_MAX} placeholder="Write the full announcement here" />
            </div>
            <div>
              <label htmlFor="audience">Send to</label>
              <select id="audience" name="audience" defaultValue={audiences[0]}>
                {audiences.map((a) => <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>)}
              </select>
            </div>
            {audiences.includes("class") && (
              <div>
                <label htmlFor="class_id">Class (only for &quot;One class&quot;)</label>
                <select id="class_id" name="class_id" defaultValue="">
                  <option value="">Choose a class</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="expires_on">Hide after (optional)</label>
              <input id="expires_on" name="expires_on" type="date" min={todayISO()} />
            </div>
            {me.role === "admin" && (
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <input type="checkbox" name="pinned" style={{ width: "auto", minHeight: 0 }} /> Pin to the top
                </label>
              </div>
            )}
          </div>
          <div className="form-actions">
            <button className="btn">Post notice</button>
          </div>
        </form>
      )}

      {notices.length === 0 ? (
        <div className="card empty">
          <strong>No notices yet</strong>
          {canPost ? "Post the first announcement using the form above." : "New announcements from the school will show up here."}
        </div>
      ) : (
        <NoticeList notices={notices} manage={canPost ? { role: me.role as "admin" | "teacher", userId: me.id } : undefined} />
      )}
    </>
  );
}
