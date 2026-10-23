import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h1>Page not found</h1>
      <p className="sub">That page or record does not exist, or you do not have access to it.</p>
      <div className="form-actions" style={{ marginTop: 0 }}>
        <Link className="btn" href="/">Go to dashboard</Link>
      </div>
    </div>
  );
}
