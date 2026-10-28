"use client";

import { useState, useTransition } from "react";
import { markRestAbsent, countUnmarked } from "../scan/actions";

export default function FinishClass({ classes }: { classes: { id: string; name: string; section: string }[] }) {
  const [classId, setClassId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, startTransition] = useTransition();

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <h2 style={{ marginTop: 0 }}>Finish a class</h2>
      <p className="sub" style={{ marginTop: -6 }}>
        When everyone has been scanned, mark the students of a class who were not scanned as absent. Records already saved are never changed.
      </p>
      <div className="row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <label htmlFor="cls">Class</label>
          <select id="cls" value={classId} onChange={(e) => { setClassId(e.target.value); setMessage(""); }}>
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
              if (n === 0) return setMessage("Nobody is left unmarked in this class.");
              if (!window.confirm(`Mark ${n} student${n === 1 ? "" : "s"} with no attendance today as absent?`)) return;
              const r = await markRestAbsent(classId);
              setMessage(r.message);
            })
          }
        >
          Mark rest absent
        </button>
      </div>
      {message && <div className="notice info" style={{ marginTop: 12 }}>{message}</div>}
    </div>
  );
}
