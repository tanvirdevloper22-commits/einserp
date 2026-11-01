"use client";

import { useState } from "react";
import { planPapers } from "@/lib/datesheet";

type Option = { id: string; label: string };
type Row = { on: boolean; date: string; start: string; end: string };

/** Adds papers for many subjects and classes at once, each with its own date and time, with an optional helper that fills them in with a gap. */
export default function DateSheetBuilder({
  action,
  examId,
  subjects,
  classes,
  defaultDate,
  defaultClass,
}: {
  action: (formData: FormData) => void | Promise<void>;
  examId: string;
  subjects: Option[];
  classes: Option[];
  defaultDate: string;
  defaultClass: string;
}) {
  const [rows, setRows] = useState<Record<string, Row>>(() => Object.fromEntries(subjects.map((s) => [s.id, { on: false, date: defaultDate, start: "", end: "" }])));
  const [picked, setPicked] = useState<Set<string>>(() => new Set(defaultClass ? [defaultClass] : []));
  const [first, setFirst] = useState({ date: defaultDate, start: "09:00", hours: "3", gap: "1", unit: "hours" as "hours" | "days", perDay: "", skipSunday: true });
  const [message, setMessage] = useState("");

  const ticked = subjects.filter((s) => rows[s.id]?.on);
  const allSubjects = subjects.length > 0 && ticked.length === subjects.length;
  const allClasses = classes.length > 0 && picked.size === classes.length;

  const patch = (id: string, change: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...change } }));
  const setAllSubjects = (on: boolean) => setRows((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { ...v, on }])));

  function fill() {
    if (!ticked.length) return setMessage("Tick the subjects first.");
    const result = planPapers(ticked.length, {
      firstDate: first.date,
      firstStart: first.start,
      lengthMin: Math.round(Number(first.hours || "0") * 60),
      gap: Number(first.gap || "0"),
      unit: first.unit,
      skipSunday: first.skipSunday,
      perDay: Number(first.perDay || "0"),
    });
    if ("error" in result) return setMessage(result.error);
    setRows((r) => {
      const next = { ...r };
      ticked.forEach((s, i) => { next[s.id] = { ...next[s.id], ...result.papers[i] }; });
      return next;
    });
    setMessage(`Filled in ${ticked.length} paper${ticked.length === 1 ? "" : "s"}. You can still change any date or time below.`);
  }

  return (
    <form action={action} className="card" style={{ marginBottom: 24 }}>
      <input type="hidden" name="exam_id" value={examId} />
      <h2 style={{ marginTop: 0 }}>Add papers</h2>
      <p className="sub" style={{ marginTop: -6 }}>
        Tick the classes and subjects. Every subject has its own date and time. A subject already on a class&apos;s date sheet is updated.
      </p>

      <label>Classes</label>
      <div className="row tight" style={{ flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
        <label className="badge ok" style={{ display: "inline-flex", gap: 6, alignItems: "center", cursor: "pointer", margin: 0, padding: "6px 10px" }}>
          <input type="checkbox" checked={allClasses} onChange={(e) => setPicked(e.target.checked ? new Set(classes.map((c) => c.id)) : new Set())} style={{ width: "auto", minHeight: 0 }} /> Select all
        </label>
        {classes.map((c) => (
          <label key={c.id} className="badge neutral" style={{ display: "inline-flex", gap: 6, alignItems: "center", cursor: "pointer", margin: 0, padding: "6px 10px" }}>
            <input
              type="checkbox"
              name="class_id"
              value={c.id}
              checked={picked.has(c.id)}
              onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n; })}
              style={{ width: "auto", minHeight: 0 }}
            /> {c.label}
          </label>
        ))}
      </div>
      {!classes.length && <span className="cell-sub">Add classes first.</span>}

      <div className="card" style={{ margin: "16px 0", background: "var(--surface-2)" }}>
        <strong>Fill the dates and times automatically (optional)</strong>
        <p className="sub" style={{ margin: "4px 0 12px" }}>
          Gives the ticked subjects dates and times one after another, in the order listed below. Then change any row you like.
        </p>
        <div className="form-grid">
          <div><label htmlFor="f_date">First paper date</label><input id="f_date" type="date" value={first.date} onChange={(e) => setFirst({ ...first, date: e.target.value })} /></div>
          <div><label htmlFor="f_start">First paper starts</label><input id="f_start" type="time" value={first.start} onChange={(e) => setFirst({ ...first, start: e.target.value })} /></div>
          <div><label htmlFor="f_len">Each paper lasts (hours)</label><input id="f_len" type="number" min="0" max="12" step="0.25" value={first.hours} onChange={(e) => setFirst({ ...first, hours: e.target.value })} /></div>
          <div>
            <label htmlFor="f_gap">Gap between two papers</label>
            <div className="row tight">
              <input id="f_gap" type="number" min="0" max="90" step="0.25" value={first.gap} onChange={(e) => setFirst({ ...first, gap: e.target.value })} style={{ maxWidth: 100 }} />
              <select aria-label="Gap unit" value={first.unit} onChange={(e) => setFirst({ ...first, unit: e.target.value as "hours" | "days" })}>
                <option value="hours">hours (same day)</option>
                <option value="days">days</option>
              </select>
            </div>
          </div>
          {first.unit === "hours" && (
            <div><label htmlFor="f_per">Most papers in one day (optional)</label><input id="f_per" type="number" min="1" max="10" value={first.perDay} onChange={(e) => setFirst({ ...first, perDay: e.target.value })} placeholder="No limit" /></div>
          )}
          <div style={{ alignSelf: "end" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", margin: 0 }}>
              <input type="checkbox" checked={first.skipSunday} onChange={(e) => setFirst({ ...first, skipSunday: e.target.checked })} style={{ width: "auto", minHeight: 0 }} /> Skip Sundays
            </label>
          </div>
        </div>
        <div className="row tight" style={{ marginTop: 12, alignItems: "center" }}>
          <button type="button" className="btn ghost" onClick={fill}>Fill dates and times</button>
          {message && <span className="cell-sub" role="status">{message}</span>}
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}><input type="checkbox" aria-label="Select all subjects" checked={allSubjects} onChange={(e) => setAllSubjects(e.target.checked)} style={{ width: "auto", minHeight: 0 }} /></th>
              <th>Subject</th><th>Date</th><th>Starts</th><th>Ends</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((s) => {
              const r = rows[s.id];
              return (
                <tr key={s.id} style={{ opacity: r.on ? 1 : 0.55 }}>
                  <td><input type="checkbox" name="subject_id" value={s.id} checked={r.on} onChange={(e) => patch(s.id, { on: e.target.checked })} aria-label={`Include ${s.label}`} style={{ width: "auto", minHeight: 0 }} /></td>
                  <td className="strong">{s.label}</td>
                  <td><input type="date" name={`date_${s.id}`} value={r.date} onChange={(e) => patch(s.id, { date: e.target.value, on: true })} aria-label={`Date for ${s.label}`} /></td>
                  <td><input type="time" name={`start_${s.id}`} value={r.start} onChange={(e) => patch(s.id, { start: e.target.value })} aria-label={`Start time for ${s.label}`} /></td>
                  <td><input type="time" name={`end_${s.id}`} value={r.end} onChange={(e) => patch(s.id, { end: e.target.value })} aria-label={`End time for ${s.label}`} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!subjects.length && <span className="cell-sub">No subjects yet. Add them on the Exams page.</span>}

      <div className="form-actions"><button className="btn">Save papers</button></div>
    </form>
  );
}
