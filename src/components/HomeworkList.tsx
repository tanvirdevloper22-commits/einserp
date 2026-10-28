import { formatDate, todayISO } from "@/lib/dates";
import { dueLabel, type Homework } from "@/lib/homework";
import { deleteHomework } from "@/app/(app)/homework/actions";
import ConfirmButton from "@/components/ConfirmButton";

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/** A list of homework items. With manage set, items the viewer may delete show a Delete button. */
export default function HomeworkList({
  items,
  showClass,
  manage,
}: {
  items: Homework[];
  showClass?: boolean;
  manage?: { role: "admin" | "teacher"; userId: string };
}) {
  const today = todayISO();
  return (
    <div className="notice-list">
      {items.map((h) => {
        const subject = one(h.subjects);
        const cls = one(h.classes);
        const due = dueLabel(h.due_date, today);
        const canDelete = manage && (manage.role === "admin" || h.created_by === manage.userId);
        return (
          <article key={h.id} className={`notice-item${due?.text === "Past due" ? " expired" : ""}`}>
            <div className="notice-head">
              <h3>{h.title}</h3>
              <div className="row tight">
                {subject && <span className="badge accent">{subject.name}</span>}
                {showClass && cls && <span className="badge neutral">{cls.name} - {cls.section}</span>}
                {due && <span className={`badge ${due.tone}`}>{due.text}</span>}
              </div>
            </div>
            {h.details && <p className="notice-body">{h.details}</p>}
            <div className="notice-meta">
              <span>
                {h.created_by_name ? `${h.created_by_name} · ` : ""}
                Posted {formatDate(h.assigned_on)}
                {h.due_date ? ` · Due ${formatDate(h.due_date)}` : ""}
              </span>
              {canDelete && (
                <span className="row tight no-print">
                  <form action={deleteHomework}>
                    <input type="hidden" name="id" value={h.id} />
                    <ConfirmButton className="btn danger small" message="Delete this homework? This cannot be undone.">Delete</ConfirmButton>
                  </form>
                </span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
