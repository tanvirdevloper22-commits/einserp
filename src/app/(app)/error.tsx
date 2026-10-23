"use client";

import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h1>Something went wrong</h1>
      <p className="sub">
        This page could not be loaded. Your data is safe. Try again, and if it keeps happening, tell the school admin
        {error.digest ? <> and mention code <strong>{error.digest}</strong></> : null}.
      </p>
      <div className="form-actions" style={{ marginTop: 0 }}>
        <button className="btn" onClick={() => reset()}>Try again</button>
        <Link className="btn ghost" href="/">Go to dashboard</Link>
      </div>
    </div>
  );
}
