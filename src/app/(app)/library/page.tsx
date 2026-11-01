import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/dates";
import { inr } from "@/lib/format";
import { available, daysLate, type Book } from "@/lib/library";
import PageHeader from "@/components/PageHeader";
import { addBook, returnBook } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Library" };

type SP = { error?: string; added?: string; deleted?: string; returned?: string; fine?: string; q?: string; view?: string };
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

type OpenLoan = {
  id: string; book_id: string; issued_on: string; due_on: string;
  library_books: { title: string; accession_no: string } | { title: string; accession_no: string }[] | null;
  students: { full_name: string; admission_no: string } | { full_name: string; admission_no: string }[] | null;
  staff: { full_name: string; employee_no: string } | { full_name: string; employee_no: string }[] | null;
};

export default async function LibraryPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireRole(["admin", "teacher", "accountant"]);
  const isAdmin = me.role === "admin";
  const sp = await searchParams;
  const supabase = await createClient();
  const today = todayISO();
  const q = (sp.q ?? "").trim().replace(/[%,()]/g, " ").slice(0, 60);
  const view = sp.view === "issued" ? "issued" : "books";

  let books = supabase.from("library_books").select("*").order("title").limit(200);
  if (q) books = books.or(`title.ilike.%${q}%,author.ilike.%${q}%,accession_no.ilike.%${q}%,isbn.ilike.%${q}%`);

  const [b, totalRes, open] = await Promise.all([
    books,
    supabase.from("library_books").select("copies"),
    supabase
      .from("library_loans")
      .select("id, book_id, issued_on, due_on, library_books(title, accession_no), students(full_name, admission_no), staff(full_name, employee_no)")
      .is("returned_on", null)
      .order("due_on")
      .limit(500),
  ]);
  const failed = b.error ?? open.error ?? totalRes.error;
  const list = (b.data ?? []) as Book[];
  const loans = (open.data ?? []) as unknown as OpenLoan[];
  const out = new Map<string, number>();
  loans.forEach((l) => out.set(l.book_id, (out.get(l.book_id) ?? 0) + 1));
  const titles = (totalRes.data ?? []).length;
  const copies = (totalRes.data ?? []).reduce((s, x) => s + Number(x.copies), 0);
  const overdue = loans.filter((l) => l.due_on < today).length;

  return (
    <>
      <PageHeader title="Library" description="Books, who has borrowed them, and what is overdue." />
      {sp.added && <div className="notice ok">Book added.</div>}
      {sp.deleted && <div className="notice ok">Book deleted.</div>}
      {sp.returned && <div className="notice ok">Book returned{Number(sp.fine) > 0 ? `. Late fine: ${inr(Number(sp.fine))} (collect it at the desk; it is not added to the fees)` : ""}.</div>}
      {sp.error && <div className="error">{sp.error}</div>}
      {failed && (
        <div className="error">
          {/schema cache|library_|does not exist|relationship/i.test(failed.message)
            ? "The library tables are missing, or Supabase has not noticed them yet. Run supabase/026_library.sql, then run: notify pgrst, 'reload schema';"
            : `The library could not be loaded: ${failed.message}`}
        </div>
      )}

      <div className="grid stats">
        <div className="card stat"><span className="label">Book titles</span><span className="value">{titles}</span></div>
        <div className="card stat"><span className="label">Total copies</span><span className="value">{copies}</span></div>
        <div className="card stat"><span className="label">Issued now</span><span className="value">{loans.length}</span></div>
        <div className="card stat"><span className="label">Overdue</span><span className="value">{overdue}</span></div>
      </div>

      <div className="row tight" style={{ margin: "8px 0 16px" }}>
        <Link className={view === "books" ? "btn" : "btn ghost"} href="/library">Books</Link>
        <Link className={view === "issued" ? "btn" : "btn ghost"} href="/library?view=issued">Issued books{overdue ? ` (${overdue} overdue)` : ""}</Link>
      </div>

      {view === "books" ? (
        <>
          <form method="get" className="row tight" style={{ alignItems: "flex-end", marginBottom: 12 }}>
            <div><label htmlFor="q">Search</label><input id="q" name="q" defaultValue={q} placeholder="Title, author, accession no. or ISBN" /></div>
            <button className="btn ghost">Search</button>
            {q && <Link className="btn ghost" href="/library">Clear</Link>}
          </form>
          <div className="card flush" style={{ marginBottom: 24 }}>
            {list.length === 0 ? <p className="sub" style={{ padding: 16 }}>{q ? "No book matches your search." : "No books yet."}</p> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Book</th><th>Accession no.</th><th>Category</th><th>Shelf</th><th className="num">Available</th></tr></thead>
                  <tbody>
                    {list.map((x) => {
                      const left = available(x.copies, out.get(x.id) ?? 0);
                      return (
                        <tr key={x.id}>
                          <td><Link className="strong" href={`/library/books/${x.id}`}>{x.title}</Link><span className="cell-sub">{x.author ?? ""}</span></td>
                          <td>{x.accession_no}</td>
                          <td>{x.category ?? <span className="muted">-</span>}</td>
                          <td>{x.shelf ?? <span className="muted">-</span>}</td>
                          <td className="num">{left} / {x.copies}{left === 0 && <span className="badge warn" style={{ marginLeft: 6 }}>All out</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {isAdmin && (
            <form action={addBook} className="card">
              <h2 style={{ marginTop: 0 }}>Add a book</h2>
              <div className="form-grid">
                <div><label htmlFor="accession_no">Accession number</label><input id="accession_no" name="accession_no" required maxLength={30} placeholder="e.g. 1024" /></div>
                <div><label htmlFor="title">Title</label><input id="title" name="title" required maxLength={200} /></div>
                <div><label htmlFor="author">Author</label><input id="author" name="author" maxLength={120} /></div>
                <div><label htmlFor="category">Category</label><input id="category" name="category" maxLength={60} placeholder="e.g. Story, Science, Reference" /></div>
                <div><label htmlFor="isbn">ISBN</label><input id="isbn" name="isbn" maxLength={20} /></div>
                <div><label htmlFor="shelf">Shelf</label><input id="shelf" name="shelf" maxLength={30} placeholder="e.g. A-3" /></div>
                <div><label htmlFor="copies">Copies</label><input id="copies" name="copies" type="number" min={1} max={500} defaultValue={1} required /></div>
              </div>
              <div className="row" style={{ marginTop: 12 }}><button className="btn">Add book</button></div>
            </form>
          )}
        </>
      ) : (
        <div className="card flush">
          {loans.length === 0 ? <p className="sub" style={{ padding: 16 }}>No book is issued right now.</p> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Book</th><th>Borrower</th><th>Issued</th><th>Due</th><th /></tr></thead>
                <tbody>
                  {loans.map((l) => {
                    const bk = one(l.library_books);
                    const s = one(l.students);
                    const st = one(l.staff);
                    const late = daysLate(l.due_on, today);
                    return (
                      <tr key={l.id}>
                        <td><Link className="strong" href={`/library/books/${l.book_id}`}>{bk?.title ?? "Book"}</Link><span className="cell-sub">{bk?.accession_no}</span></td>
                        <td>{s ? <>{s.full_name}<span className="cell-sub">Adm. no. {s.admission_no}</span></> : st ? <>{st.full_name}<span className="cell-sub">Staff · {st.employee_no}</span></> : "-"}</td>
                        <td>{formatDate(l.issued_on)}</td>
                        <td>{formatDate(l.due_on)}{late > 0 && <span className="badge bad" style={{ marginLeft: 6 }}>{late} day{late === 1 ? "" : "s"} late</span>}</td>
                        <td className="num">
                          {isAdmin && (
                            <form action={returnBook} className="row tight" style={{ justifyContent: "flex-end" }}>
                              <input type="hidden" name="id" value={l.id} /><input type="hidden" name="back" value="library" />
                              <input name="fine" inputMode="decimal" placeholder={late > 0 ? `Fine ₹${late}` : "Fine ₹"} aria-label="Fine" style={{ maxWidth: 90 }} />
                              <button className="btn small">Return</button>
                            </form>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
