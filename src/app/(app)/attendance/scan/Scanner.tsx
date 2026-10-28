"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import jsQR from "jsqr";
import type { ScanResult } from "@/lib/qr-attendance";
import { scanAttendance } from "./actions";

type Entry = ScanResult & { at: string };
type Facing = "environment" | "user";

const IDLE_AFTER_MS = 5000;
const SAME_CARD_MS = 4000;

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

const store = {
  get: (k: string) => { try { return window.localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { window.localStorage.setItem(k, v); } catch {} },
};

type WakeLock = { release: () => Promise<void> };

export default function Scanner() {
  const [mode, setMode] = useState<"present" | "late">("present");
  const [facing, setFacing] = useState<Facing>("environment");
  const [camera, setCamera] = useState<"off" | "starting" | "on">("off");
  const [camError, setCamError] = useState("");
  const [last, setLast] = useState<Entry | null>(null);
  const [recent, setRecent] = useState<Entry[]>([]);
  const [count, setCount] = useState(0);
  const [full, setFull] = useState(false);
  const [busy, startTransition] = useTransition();
  const [typed, setTyped] = useState("");

  const wrap = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef(0);
  const seen = useRef(new Map<string, number>());
  const modeRef = useRef(mode);
  const inFlight = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wake = useRef<WakeLock | null>(null);
  const wanted = useRef(false);
  modeRef.current = mode;

  const submit = useCallback((text: string) => {
    const key = text.trim();
    if (!key) return;
    const now = Date.now();
    if (inFlight.current || now - (seen.current.get(key) ?? 0) < SAME_CARD_MS) return; // same card still in front of the camera
    seen.current.set(key, now);
    inFlight.current = true;
    startTransition(async () => {
      let entry: Entry;
      try {
        const r = await scanAttendance(key, modeRef.current);
        entry = { ...r, at: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) };
      } catch {
        entry = { ok: false, kind: "error", message: "Could not reach the server. Check the internet connection.", at: "" };
      }
      inFlight.current = false;
      setLast(entry);
      if (entry.name) setRecent((l) => [entry, ...l].slice(0, 5));
      if (entry.kind === "marked") setCount((c) => c + 1);
      beep(entry.ok);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setLast(null), IDLE_AFTER_MS);
    });
  }, []);

  const releaseWake = useCallback(() => {
    wake.current?.release().catch(() => {});
    wake.current = null;
  }, []);
  const holdWake = useCallback(async () => {
    try {
      const nav = navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<WakeLock> } };
      if (nav.wakeLock && !wake.current) wake.current = await nav.wakeLock.request("screen");
    } catch {}
  }, []);

  const halt = useCallback(() => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  const stop = useCallback(() => {
    wanted.current = false;
    halt();
    releaseWake();
    setCamera("off");
  }, [halt, releaseWake]);

  const open = useCallback(async (want: Facing) => {
    halt();
    wanted.current = true;
    setCamError("");
    setCamera("starting");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException("No camera API", "NotSupportedError");
      let s: MediaStream;
      try {
        s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: want }, width: { ideal: 1280 } }, audio: false });
      } catch (e) {
        if (e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError")) throw e;
        s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); // a device that does not know "facing"
      }
      stream.current = s;
      const v = video.current!;
      v.srcObject = s;
      await v.play();
      setFacing(want);
      store.set("scanner-facing", want);
      store.set("scanner-on", "1");
      setCamera("on");
      holdWake();

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      const tick = () => {
        if (stream.current !== s) return;
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
      halt();
      wanted.current = false;
      setCamera("off");
      store.set("scanner-on", "0");
      setCamError(
        e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError")
          ? "Camera permission was denied. Tap the lock icon in the address bar, allow the camera for this site, then try again."
          : e instanceof DOMException && e.name === "NotFoundError"
            ? "No camera was found on this device. You can still use a USB scanner or type the code below."
            : "The camera could not be started. You can still use a USB scanner or type the code below.",
      );
    }
  }, [halt, holdWake, submit]);

  // Restore the last camera choice, and start straight away when the browser already trusts this site with the camera.
  useEffect(() => {
    const saved = store.get("scanner-facing") === "user" ? "user" : "environment";
    setFacing(saved);
    if (store.get("scanner-on") === "1") {
      navigator.permissions
        ?.query({ name: "camera" as PermissionName })
        .then((p) => { if (p.state === "granted") open(saved); })
        .catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible" && wanted.current) holdWake(); };
    const onFull = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("fullscreenchange", onFull);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("fullscreenchange", onFull);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      halt();
      releaseWake();
    };
  }, [halt, holdWake, releaseWake]);

  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else wrap.current?.requestFullscreen?.().catch(() => {});
  };

  const tone = !last ? "idle" : last.kind === "marked" ? "ok" : last.kind === "already" ? "info" : "bad";
  const mirrored = facing === "user";

  return (
    <div ref={wrap} className={`kiosk${full ? " is-full" : ""}`}>
      <div className="kiosk-bar">
        <div>
          <div className="kiosk-eyebrow">Attendance</div>
          <div className="kiosk-title">Show your ID card</div>
        </div>
        <div className="kiosk-tools">
          <button type="button" className="kiosk-btn" onClick={toggleFull} aria-label={full ? "Exit full screen" : "Full screen"}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {full ? <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" /> : <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />}
            </svg>
            <span>{full ? "Exit" : "Full screen"}</span>
          </button>
        </div>
      </div>

      <div className="kiosk-stage">
        <video ref={video} playsInline muted className={mirrored ? "mirror" : ""} />
        <div className="kiosk-frame" aria-hidden>
          <i /><i /><i /><i />
          {camera === "on" && <span className="kiosk-line" />}
        </div>
        {camera !== "on" && (
          <div className="kiosk-off">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 9a2 2 0 0 1 2-2h1.5l1.4-2h8.2l1.4 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.5" />
            </svg>
            <p>{camera === "starting" ? "Starting the camera…" : "The camera is off"}</p>
            {camera === "off" && <button type="button" className="kiosk-primary" onClick={() => open(facing)}>Start scanner</button>}
          </div>
        )}
        {camera === "on" && (
          <button type="button" className="kiosk-flip" onClick={() => open(facing === "environment" ? "user" : "environment")} aria-label="Switch between front and back camera">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 7h13l-3-3M21 17H8l3 3" />
            </svg>
            <span>{facing === "environment" ? "Back camera" : "Front camera"}</span>
          </button>
        )}
      </div>

      {camError && <div className="kiosk-error">{camError}</div>}

      <div className={`kiosk-result ${tone}`} aria-live="polite">
        {!last ? (
          <>
            <div className="kiosk-result-title">Ready</div>
            <div className="kiosk-result-sub">Hold the QR code on your ID card in front of the camera.</div>
          </>
        ) : (
          <>
            <div className="kiosk-result-icon" aria-hidden>
              {last.kind === "marked" ? (
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              ) : last.kind === "already" ? (
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></svg>
              ) : (
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              )}
            </div>
            {last.name && <div className="kiosk-result-title">{last.name}</div>}
            {last.name && <div className="kiosk-result-sub">{last.className} · Adm. no. {last.admissionNo}</div>}
            <div className="kiosk-result-msg">{last.message}</div>
          </>
        )}
      </div>

      <div className="kiosk-foot">
        <label className="kiosk-mode">
          <span>Mark as</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as "present" | "late")}>
            <option value="present">Present</option>
            <option value="late">Late</option>
          </select>
        </label>
        <span className="kiosk-count">{count} marked in this session</span>
        {camera === "on" && <button type="button" className="kiosk-btn" onClick={stop}>Stop camera</button>}
      </div>

      {recent.length > 0 && (
        <ul className="kiosk-recent">
          {recent.map((e, i) => (
            <li key={i}>
              <span className="kiosk-recent-name">{e.name}</span>
              <span className="kiosk-recent-class">{e.className}</span>
              <span className={`kiosk-recent-tag ${e.kind}`}>{e.kind === "marked" ? "Marked" : e.kind === "already" ? "Already marked" : "Not marked"}</span>
              <span className="kiosk-recent-time">{e.at}</span>
            </li>
          ))}
        </ul>
      )}

      <form
        className="kiosk-manual"
        onSubmit={(e) => {
          e.preventDefault();
          submit(typed);
          setTyped("");
        }}
      >
        <label htmlFor="code">USB scanner or typed code</label>
        <div className="kiosk-manual-row">
          <input id="code" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" placeholder="Scan with a USB scanner, or paste the code" />
          <button className="kiosk-btn" disabled={busy || !typed.trim()}>Mark</button>
        </div>
      </form>
    </div>
  );
}
