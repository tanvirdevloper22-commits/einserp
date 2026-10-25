import { formatDate, todayISO } from "@/lib/dates";
import { AUDIENCE_LABEL, type Notice } from "@/lib/notices";
import { deleteNotice, togglePin } from "@/app/(app)/notices/actions";
import ConfirmButton from "@/components/ConfirmButton";

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/**
 * A list of notices. With manage set, each notice shows delete (and, for admins, pin) controls
 * for the notices the viewer is allowed to change.
 */
export default function NoticeList({
  notices,
  manage,
}: {
  notices: Notice[];
  manage?: { role: "admin" | "teacher"; userId: string };
}) {
  const today = todayISO();
  return (
    <div className="notice-list">
      {notices.map((n) => {
        const cls = one(n.classes);
        const expired = Boolean(n.expires_on && n.expires_on < today);
        const canDelete = manage && (manage.role === "admin" || n.created_by === manage.userId);
        const audience = n.audience === "class" && cls ? `Class ${cls.name} - ${cls.section}` : AUDIENCE_LABEL[n.audience];
        return (
          <article key={n.id} className={`notice-item${n.pinned ? " pinned" : ""}${expired ? " expired" : ""}`}>
            <div className="notice-head">
              <h3>{n.title}</h3>
              <div className="row tight">
                {n.pinned && <span className="badge accent">Pinned</span>}
                {expired && <span className="badge neutral">Expired</span>}
                <span className="badge neutral">{audience}</span>
              </div>
            </div>
            <p className="notice-body">{n.body}</p>
            <div className="notice-meta">
              <span>
                {n.created_by_name ? `${n.created_by_name} · ` : ""}
                {formatDate(n.created_at)}
                {n.expires_on && !expired ? ` · Until ${formatDate(n.expires_on)}` : ""}
              </span>
              {manage && (
                <span className="row tight no-print">
                  {manage.role === "admin" && (
                    <form action={togglePin}>
                      <input type="hidden" name="id" value={n.id} />
                      <input type="hidden" name="pinned" value={String(n.pinned)} />
                      <button className="btn ghost small">{n.pinned ? "Unpin" : "Pin"}</button>
                    </form>
                  )}
                  {canDelete && (
                    <form action={deleteNotice}>
                      <input type="hidden" name="id" value={n.id} />
                      <ConfirmButton className="btn danger small" message="Delete this notice? This cannot be undone.">
                        Delete
                      </ConfirmButton>
                    </form>
                  )}
                </span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
