"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import jsQR from "jsqr";
import { totalsOf, type ClassStat, type ScanResult } from "@/lib/qr-attendance";
import { scanAttendance, markRestAbsent, countUnmarked, getTodayStats } from "./actions";

type Entry = ScanResult & { at: string };

function beep(ok: boolean) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    osc.frequency.value = ok ? 880 : 220;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.12 : 0.3));
  } catch {}
}

export default function Scanner({ classes, canFinish }: { classes: { id: string; name: string; section: string }[]; canFinish: boolean }) {
  const [mode, setMode] = useState<"present" | "late">("present");
  const [last, setLast] = useState<Entry | null>(null);
  const [log, setLog] = useState<Entry[]>([]);
  const [camera, setCamera] = useState<"off" | "starting" | "on">("off");
  const [camError, setCamError] = useState("");
  const [busy, startTransition] = useTransition();
  const [classId, setClassId] = useState("");
  const [rest, setRest] = useState("");
  const [typed, setTyped] = useState("");
  const [stats, setStats] = useState<ClassStat[] | null>(null);
  const [statsError, setStatsError] = useState("");

  const refreshStats = useCallback(async () => {
    try {
      const r = await getTodayStats();
      setStats(r.rows);
      setStatsError(r.error ?? "");
    } catch {}
  }, []);
  useEffect(() => {
    refreshStats();
    const t = setInterval(refreshStats, 30000);
    return () => clearInterval(t);
  }, [refreshStats]);

  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef(0);
  const recent = useRef(new Map<string, number>());
  const modeRef = useRef(mode);
  const inFlight = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  modeRef.current = mode;

  const submit = useCallback((text: string) => {
    const key = text.trim();
    if (!key) return;
    const now = Date.now();
    if (inFlight.current || now - (recent.current.get(key) ?? 0) < 4000) return; // the same card in front of the camera
    recent.current.set(key, now);
    inFlight.current = true;
    startTransition(async () => {
      try {
        const r = await scanAttendance(key, modeRef.current);
        const entry = { ...r, at: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" }) };
        setLast(entry);
        setLog((l) => [entry, ...l].slice(0, 30));
        beep(r.ok);
        refreshStats();
      } catch {
        setLast({ ok: false, kind: "error", message: "Could not reach the server. Check the internet connection.", at: "" });
        beep(false);
      } finally {
        inFlight.current = false;
      }
    });
  }, [refreshStats]);

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setCamera("off");
  }, []);

  const start = useCallback(async () => {
    setCamError("");
    setCamera("starting");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      stream.current = s;
      const v = video.current!;
      v.srcObject = s;
      await v.play();
      setCamera("on");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      const tick = () => {
        if (!stream.current) return;
        if (v.readyState >= 2 && v.videoWidth) {
          const scale = Math.min(1, 640 / v.videoWidth);
          canvas.width = Math.round(v.videoWidth * scale);
          canvas.height = Math.round(v.videoHeight * scale);
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
          if (code?.data) submit(code.data);
        }
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      setCamera("off");
      setCamError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Camera permission was denied. Allow the camera for this site in the browser settings, then try again."
          : "The camera could not be started. You can still use a USB barcode scanner or type the code below.",
      );
    }
  }, [submit]);

  useEffect(() => () => stop(), [stop]);

  const tone = !last ? "" : last.kind === "marked" ? "ok" : last.kind === "already" ? "info" : "bad";

  const totals = totalsOf(stats ?? []);

  return (
    <>
      <div className="grid stats" style={{ marginBottom: 16 }}>
        <div className="card stat"><span className="label">Students</span><span className="value">{stats ? totals.total : "-"}</span></div>
        <div className="card stat"><span className="label">Present</span><span className="value">{stats ? totals.here : "-"}</span><span className="hint">{stats && totals.late ? `${totals.late} of them late` : "scanned today"}</span></div>
        <div className="card stat"><span className="label">Absent</span><span className="value">{stats ? totals.absent : "-"}</span><span className="hint">{stats && totals.onLeave ? `not scanned yet, plus ${totals.onLeave} on leave` : "not scanned yet"}</span></div>
        <div className="card stat"><span className="label">Attendance</span><span className="value">{stats ? `${totals.percent}%` : "-"}</span><span className="hint">present out of all students</span></div>
      </div>
      {statsError && <div className="notice info" style={{ marginBottom: 16 }}>{statsError}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label htmlFor="mode">Mark scanned students as</label>
            <select id="mode" value={mode} onChange={(e) => setMode(e.target.value as "present" | "late")}>
              <option value="present">Present</option>
              <option value="late">Late</option>
            </select>
          </div>
          {camera === "off" ? (
            <button type="button" className="btn" onClick={start}>Start camera</button>
          ) : (
            <button type="button" className="btn ghost" onClick={stop} disabled={camera === "starting"}>Stop camera</button>
          )}
        </div>
        {camError && <div className="error" style={{ marginTop: 12 }}>{camError}</div>}
        <div style={{ display: camera === "off" ? "none" : "block", marginTop: 16, maxWidth: 420 }}>
          <video ref={video} playsInline muted style={{ width: "100%", background: "#000", display: "block" }} />
          <span className="cell-sub" style={{ marginTop: 6 }}>Hold the ID card so the QR code is inside the picture. It scans by itself.</span>
        </div>
      </div>

      <form
        className="card"
        style={{ marginBottom: 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          submit(typed);
          setTyped("");
          inputRef.current?.focus();
        }}
      >
        <label htmlFor="code">USB barcode / QR scanner, or type the code</label>
        <div className="row">
          <input id="code" ref={inputRef} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" placeholder="Click here, then scan with the USB scanner" className="grow" />
          <button className="btn ghost" disabled={busy || !typed.trim()}>Mark</button>
        </div>
        <span className="cell-sub" style={{ marginTop: 6 }}>A USB scanner types the code and presses Enter, so keep this box selected.</span>
      </form>

      {last && (
        <div className={`notice ${tone === "bad" ? "" : tone}`} style={tone === "bad" ? { background: "var(--bad-soft)", color: "var(--bad)", marginBottom: 16 } : { marginBottom: 16 }} aria-live="polite">
          {last.name ? (
            <>
              <strong style={{ fontSize: 18 }}>{last.name}</strong>
              <div>{last.className} · Adm. no. {last.admissionNo}</div>
            </>
          ) : null}
          <div>{last.message}</div>
        </div>
      )}

      {canFinish && (
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Finish a class</h2>
        <p className="sub" style={{ marginTop: -6 }}>When everyone has been scanned, mark the students of a class who were not scanned as absent. Saved records are never changed.</p>
        <div className="row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label htmlFor="cls">Class</label>
            <select id="cls" value={classId} onChange={(e) => { setClassId(e.target.value); setRest(""); }}>
              <option value="">Choose a class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
            </select>
          </div>
          <button
            type="button"
            className="btn ghost"
            disabled={!classId || busy}
            onClick={() =>
              startTransition(async () => {
                const n = await countUnmarked(classId);
                if (n === 0) return setRest("Nobody is left unmarked in this class.");
                if (!window.confirm(`Mark ${n} student${n === 1 ? "" : "s"} with no attendance today as absent?`)) return;
                const r = await markRestAbsent(classId);
                setRest(r.message);
              })
            }
          >
            Mark rest absent
          </button>
        </div>
        {rest && <div className="notice info" style={{ marginTop: 12 }}>{rest}</div>}
      </div>
      )}

      {stats && stats.length > 0 && (
        <details className="card flush" style={{ marginBottom: 16 }}>
          <summary style={{ padding: "14px 16px", cursor: "pointer", fontWeight: 600 }}>Class by class</summary>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Class</th><th className="num">Students</th><th className="num">Present</th><th className="num">Absent</th><th className="num">Attendance</th></tr></thead>
              <tbody>
                {stats.map((r) => {
                  const t = totalsOf([r]);
                  return (
                    <tr key={r.classId ?? "none"}>
                      <td className="strong">{r.label}</td>
                      <td className="num">{t.total}</td>
                      <td className="num">{t.here}</td>
                      <td className="num">{t.absent}</td>
                      <td className="num">{t.percent}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {log.length > 0 && (
        <div className="card flush">
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}><h2 style={{ margin: 0 }}>This session</h2></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Time</th><th>Student</th><th>Class</th><th>Result</th></tr></thead>
              <tbody>
                {log.map((e, i) => (
                  <tr key={i}>
                    <td>{e.at}</td>
                    <td className="strong">{e.name ?? "-"}</td>
                    <td>{e.className ?? "-"}</td>
                    <td><span className={`badge ${e.kind === "marked" ? "ok" : e.kind === "already" ? "neutral" : "bad"}`}>{e.kind === "marked" ? "Marked" : e.kind === "already" ? "Already marked" : e.message}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
