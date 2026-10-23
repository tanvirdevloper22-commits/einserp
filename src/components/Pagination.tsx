import Link from "next/link";
import { PAGE_SIZE } from "@/lib/pagination";

/** Previous / next links that keep the other filters in the address. Renders nothing when everything fits on one page. */
export default function Pagination({
  basePath, params, page, total, size = PAGE_SIZE,
}: { basePath: string; params: Record<string, string | undefined>; page: number; total: number; size?: number }) {
  const pages = Math.max(1, Math.ceil(total / size));
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(page * size, total);

  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  if (pages <= 1) {
    return total > 0 ? <p className="cell-sub pager-note no-print">Showing all {total}</p> : null;
  }
  return (
    <div className="pager no-print">
      <span className="cell-sub">Showing {from}-{to} of {total}</span>
      <div className="row tight">
        {page > 1 ? <Link className="btn ghost small" href={href(page - 1)}>Previous</Link> : <span className="btn ghost small" aria-disabled="true" style={{ opacity: 0.4 }}>Previous</span>}
        <span className="cell-sub">Page {page} of {pages}</span>
        {page < pages ? <Link className="btn ghost small" href={href(page + 1)}>Next</Link> : <span className="btn ghost small" aria-disabled="true" style={{ opacity: 0.4 }}>Next</span>}
      </div>
    </div>
  );
}
