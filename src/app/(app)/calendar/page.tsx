import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/dates";
import { parseMonth, monthBounds, monthLabel } from "@/lib/staff-attendance";
import { DETAILS_MAX, EVENT_COLUMNS, KINDS, KIND_BADGE, KIND_LABEL, TITLE_MAX, eventsOn, monthWeeks, rangeLabel, shiftMonth, type CalEvent } from "@/lib/calendar";
import PageHeader from "@/components/PageHeader";
import ConfirmButton from "@/components/ConfirmButton";
import { addEvent, deleteEvent } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar" };

type SP = { month?: string; error?: string; added?: string; deleted?: string };
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function CalendarPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireRole(["admin", "teacher", "accountant", "parent"]);
  const isAdmin = me.role === "admin";
  const sp = await searchParams;
  const today = todayISO();
  const month = parseMonth(sp.month, today.slice(0, 7));
  const weeks = monthWeeks(month);
  const gridStart = weeks[0][0];
  const gridEnd = weeks[weeks.length - 1][6];
  const { start: mStart, end: mEnd } = monthBounds(month);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("calendar_events")
    .select(EVENT_COLUMNS)
    .lte("start_date", gridEnd)
    .gte("end_date", gridStart)
    .order("start_date")
    .order("title")
    .limit(500);
  const events = (data ?? []) as CalEvent[];
  const inMonth = events.filter((e) => e.start_date <= mEnd && e.end_date >= mStart);
  const holidays = inMonth.filter((e) => e.kind === "holiday").length;

  return (
    <>
      <PageHeader title="School calendar" description="Holidays, exams, meetings and events.">
        <Link className="btn ghost" href={`/calendar?month=${shiftMonth(month, -1)}`}>Previous</Link>
        <Link className="btn ghost" href="/calendar">Today</Link>
        <Link className="btn ghost" href={`/calendar?month=${shiftMonth(month, 1)}`}>Next</Link>
      </PageHeader>

      {sp.added && <div className="notice ok">Added to the calendar.</div>}
      {sp.deleted && <div className="notice ok">Removed from the calendar.</div>}
      {sp.error && <div className="error">{sp.error}</div>}
      {error && <div className="error">The calendar table is missing. Run supabase/024_calendar.sql in the Supabase SQL Editor first.</div>}

      <div className="cal card flush">
        <div className="cal-head">
          <h2 style={{ margin: 0 }}>{monthLabel(month)}</h2>
          <span className="cell-sub">{inMonth.length} entr{inMonth.length === 1 ? "y" : "ies"}{holidays ? `, ${holidays} holiday${holidays === 1 ? "" : "s"}` : ""}</span>
        </div>
        <div className="cal-grid cal-dow">{DOW.map((d) => <div key={d}>{d}</div>)}</div>
        {weeks.map((w) => (
          <div key={w[0]} className="cal-grid">
            {w.map((d) => {
              const evs = eventsOn(events, d);
              const outside = d.slice(0, 7) !== month;
              const sunday = new Date(`${d}T00:00:00Z`).getUTCDay() === 0;
              const holiday = evs.some((e) => e.kind === "holiday");
              return (
                <div key={d} className={`cal-day${outside ? " out" : ""}${sunday ? " sun" : ""}${holiday ? " hol" : ""}${d === today ? " today" : ""}`}>
                  <span className="cal-num">{Number(d.slice(8))}</span>
                  {evs.slice(0, 3).map((e) => <span key={e.id} className={`cal-chip ${e.kind}`} title={e.title}>{e.title}</span>)}
                  {evs.length > 3 && <span className="cal-more">+{evs.length - 3} more</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="card flush" style={{ marginTop: 24 }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}><h2 style={{ margin: 0 }}>This month</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>What</th><th>Type</th>{isAdmin && <th />}</tr></thead>
            <tbody>
              {inMonth.map((e) => (
                <tr key={e.id}>
                  <td>{rangeLabel(e.start_date, e.end_date)}</td>
                  <td><span className="strong">{e.title}</span>{e.details && <span className="cell-sub">{e.details}</span>}</td>
                  <td><span className={`badge ${KIND_BADGE[e.kind]}`}>{KIND_LABEL[e.kind]}</span></td>
                  {isAdmin && (
                    <td className="num">
                      <form action={deleteEvent}>
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="month" value={month} />
                        <ConfirmButton className="btn danger small" message={`Remove "${e.title}" from the calendar?`}>Remove</ConfirmButton>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!inMonth.length && !error && <div className="empty"><strong>Nothing this month</strong>{isAdmin ? "Add a holiday or event below." : "The school has not added anything for this month."}</div>}
      </div>

      {isAdmin && (
        <form action={addEvent} className="card" style={{ marginTop: 24 }}>
          <input type="hidden" name="month" value={month} />
          <h2 style={{ marginTop: 0 }}>Add to the calendar</h2>
          <div className="form-grid">
            <div style={{ gridColumn: "1 / -1" }}><label htmlFor="title">Title</label><input id="title" name="title" required maxLength={TITLE_MAX} placeholder="e.g. Diwali break" /></div>
            <div>
              <label htmlFor="kind">Type</label>
              <select id="kind" name="kind" defaultValue="holiday">{KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
            </div>
            <div />
            <div><label htmlFor="start_date">From</label><input id="start_date" name="start_date" type="date" required defaultValue={month === today.slice(0, 7) ? today : mStart} /></div>
            <div><label htmlFor="end_date">To (leave empty for one day)</label><input id="end_date" name="end_date" type="date" /></div>
            <div style={{ gridColumn: "1 / -1" }}><label htmlFor="details">Details (optional)</label><textarea id="details" name="details" rows={2} maxLength={DETAILS_MAX} /></div>
          </div>
          <div className="form-actions"><button className="btn">Add</button></div>
        </form>
      )}
      <p className="cell-sub" style={{ marginTop: 12 }}>Today is {formatDate(today)}.</p>
    </>
  );
}
