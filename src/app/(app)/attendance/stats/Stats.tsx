"use client";

import { useCallback, useEffect, useState } from "react";
import { totalsOf, type ClassStat } from "@/lib/qr-attendance";
import { getTodayStats } from "../scan/actions";

const REFRESH_MS = 20000;

function Ring({ percent }: { percent: number }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 128 128" width="150" height="150" role="img" aria-label={`${percent}% present`}>
      <circle cx="64" cy="64" r={r} fill="none" stroke="var(--border)" strokeWidth="12" />
      <circle
        cx="64" cy="64" r={r} fill="none" stroke="var(--accent)" strokeWidth="12" strokeLinecap="butt"
        strokeDasharray={`${(Math.min(100, percent) / 100) * c} ${c}`} transform="rotate(-90 64 64)"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      <text x="64" y="62" textAnchor="middle" fontSize="26" fontWeight="650" fill="var(--text)">{percent}%</text>
      <text x="64" y="82" textAnchor="middle" fontSize="10" fill="var(--muted)">present</text>
    </svg>
  );
}

export default function Stats({ initial, initialError }: { initial: ClassStat[]; initialError: string }) {
  const [rows, setRows] = useState(initial);
  const [error, setError] = useState(initialError);
  const [updated, setUpdated] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getTodayStats();
      setRows(r.rows);
      setError(r.error ?? "");
      setUpdated(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" }));
    } catch {
      setError("Could not refresh. Check the internet connection.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setUpdated(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" }));
    const t = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const t = totalsOf(rows);

  return (
    <>
      {error && <div className="notice info">{error}</div>}

      <div className="stats-hero card">
        <Ring percent={t.percent} />
        <div className="stats-hero-grid">
          <div className="stats-big"><span className="label">Students</span><span className="value">{t.total}</span><span className="hint">active in the school</span></div>
          <div className="stats-big ok"><span className="label">Present</span><span className="value">{t.here}</span><span className="hint">{t.late ? `including ${t.late} late` : "scanned or marked today"}</span></div>
          <div className="stats-big bad"><span className="label">Absent</span><span className="value">{t.absent}</span><span className="hint">{t.onLeave ? `not here yet, plus ${t.onLeave} on leave` : "not here yet"}</span></div>
        </div>
      </div>

      <div className="stats-meta no-print">
        <span>{updated ? `Updated ${updated}` : ""}</span>
        <button type="button" className="btn ghost small" onClick={refresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh now"}</button>
      </div>

      <div className="card flush">
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}><h2 style={{ margin: 0 }}>Class by class</h2></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Class</th><th className="num">Students</th><th className="num">Present</th><th className="num">Absent</th><th style={{ width: "34%" }}>Attendance</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const x = totalsOf([r]);
                const tone = x.percent >= 90 ? "ok" : x.percent >= 75 ? "warn" : "bad";
                return (
                  <tr key={r.classId ?? "none"}>
                    <td className="strong">{r.label}</td>
                    <td className="num">{x.total}</td>
                    <td className="num">{x.here}</td>
                    <td className="num">{x.absent}</td>
                    <td>
                      <div className="pct">
                        <div className="pct-track"><div className={`pct-fill ${tone}`} style={{ width: `${x.percent}%` }} /></div>
                        <span className="pct-text">{x.percent}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && !error && <div className="empty"><strong>No students yet</strong>Numbers appear here once students are added.</div>}
      </div>
    </>
  );
}
