import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/dates";
import { inr } from "@/lib/format";
import { LOAN_DAYS, addDays, available, daysLate, type Book } from "@/lib/library";
import PageHeader from "@/components/PageHeader";
import ConfirmButton from "@/components/ConfirmButton";
import { deleteBook, issueBook, returnBook, updateBook } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Book" };

type SP = { error?: string; saved?: string; issued?: string; returned?: string; fine?: string; q?: string };
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
type L = {
  id: string; issued_on: string; due_on: string; returned_on: string | null; fine: number; student_id: string | null;
  borrower_name: string | null; borrower_ref: string | null;
};

export default async function BookPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const me = await requireRole(["admin", "teacher", "accountant", "librarian"]);
  const isAdmin = me.role === "admin" || me.role === "librarian"; // may issue, return, edit
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("library_books").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const book = data as Book;
  const today = todayISO();

  const { data: loanData } = await supabase
    .from("library_loans")
    .select("id, issued_on, due_on, returned_on, fine, student_id, borrower_name, borrower_ref")
    .eq("book_id", id)
    .order("issued_on", { ascending: false })
    .limit(100);
  const loans = (loanData ?? []) as unknown as L[];
  const openLoans = loans.filter((l) => !l.returned_on);
  const left = available(book.copies, openLoans.length);

  // Who can borrow: search active students and staff by name / admission or employee number.
  const q = (sp.q ?? "").trim().replace(/[%,()]/g, " ").slice(0, 40);
  let people: { value: string; label: string }[] = [];
  if (isAdmin && q.length >= 2) {
    const { data: found } = await supabase.rpc("library_find_borrowers", { q });
    people = ((found ?? []) as { kind: string; id: string; name: string; ref: string }[]).map((x) => ({
      value: `${x.kind}:${x.id}`,
      label: x.kind === "student" ? `${x.name} (student, adm. no. ${x.ref})` : `${x.name} (staff, ${x.ref})`,
    }));
  }

  return (
    <>
      <PageHeader title={book.title} description={[book.author, book.category, book.shelf ? `Shelf ${book.shelf}` : ""].filter(Boolean).join(" · ") || "Library book"}>
        <Link className="btn ghost" href="/library">Back</Link>
      </PageHeader>
      {sp.saved && <div className="notice ok">Saved.</div>}
      {sp.issued && <div className="notice ok">Book issued.</div>}
      {sp.returned && <div className="notice ok">Book returned{Number(sp.fine) > 0 ? `. Late fine: ${inr(Number(sp.fine))} (collect it at the desk)` : ""}.</div>}
      {sp.error && <div className="error">{sp.error}</div>}

      <div className="grid stats">
        <div className="card stat"><span className="label">Available</span><span className="value">{left} / {book.copies}</span></div>
        <div className="card stat"><span className="label">Accession no.</span><span className="value" style={{ fontSize: 20 }}>{book.accession_no}</span></div>
        <div className="card stat"><span className="label">Times issued</span><span className="value">{loans.length}</span></div>
      </div>

      {isAdmin && (
        <div className="card" style={{ margin: "16px 0 24px" }}>
          <h2 style={{ marginTop: 0 }}>Issue this book</h2>
          {left === 0 ? <p className="sub">All copies are out.</p> : (
            <>
              <form method="get" className="row tight" style={{ alignItems: "flex-end", marginBottom: 12 }}>
                <div><label htmlFor="q">Find the borrower</label><input id="q" name="q" defaultValue={q} placeholder="Name, admission or employee no." /></div>
                <button className="btn ghost">Search</button>
              </form>
              {q.length >= 2 && people.length === 0 && <p className="sub">No active student or staff member found.</p>}
              {people.length > 0 && (
                <form action={issueBook} className="row tight" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
                  <input type="hidden" name="book_id" value={id} />
                  <div>
                    <label htmlFor="borrower">Borrower</label>
                    <select id="borrower" name="borrower" required>{people.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
                  </div>
                  <div><label htmlFor="due_on">Due date</label><input id="due_on" name="due_on" type="date" min={today} defaultValue={addDays(today, LOAN_DAYS)} /></div>
                  <button className="btn">Issue book</button>
                </form>
              )}
            </>
          )}
        </div>
      )}

      <h2 style={{ margin: "0 0 8px" }}>Issue history</h2>
      <div className="card flush" style={{ marginBottom: 24 }}>
        {loans.length === 0 ? <p className="sub" style={{ padding: 16 }}>This book has not been issued yet.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Borrower</th><th>Issued</th><th>Due</th><th>Returned</th><th className="num">Fine</th><th /></tr></thead>
              <tbody>
                {loans.map((l) => {
                  const late = daysLate(l.due_on, l.returned_on ?? today);
                  return (
                    <tr key={l.id}>
                      <td>{l.borrower_name ? <>{l.borrower_name}<span className="cell-sub">{l.student_id ? `Adm. no. ${l.borrower_ref ?? "-"}` : `Staff · ${l.borrower_ref ?? "-"}`}</span></> : "-"}</td>
                      <td>{formatDate(l.issued_on)}</td>
                      <td>{formatDate(l.due_on)}</td>
                      <td>{l.returned_on ? formatDate(l.returned_on) : <span className={`badge ${late > 0 ? "bad" : "warn"}`}>{late > 0 ? `${late} day${late === 1 ? "" : "s"} late` : "Not returned"}</span>}</td>
                      <td className="num">{Number(l.fine) > 0 ? inr(Number(l.fine)) : "-"}</td>
                      <td className="num">
                        {isAdmin && !l.returned_on && (
                          <form action={returnBook} className="row tight" style={{ justifyContent: "flex-end" }}>
                            <input type="hidden" name="id" value={l.id} /><input type="hidden" name="book_id" value={id} />
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

      {isAdmin && (
        <>
          <form action={updateBook} className="card" style={{ marginBottom: 24 }}>
            <h2 style={{ marginTop: 0 }}>Book details</h2>
            <input type="hidden" name="id" value={id} />
            <div className="form-grid">
              <div><label htmlFor="accession_no">Accession number</label><input id="accession_no" name="accession_no" required maxLength={30} defaultValue={book.accession_no} /></div>
              <div><label htmlFor="title">Title</label><input id="title" name="title" required maxLength={200} defaultValue={book.title} /></div>
              <div><label htmlFor="author">Author</label><input id="author" name="author" maxLength={120} defaultValue={book.author ?? ""} /></div>
              <div><label htmlFor="category">Category</label><input id="category" name="category" maxLength={60} defaultValue={book.category ?? ""} /></div>
              <div><label htmlFor="isbn">ISBN</label><input id="isbn" name="isbn" maxLength={20} defaultValue={book.isbn ?? ""} /></div>
              <div><label htmlFor="shelf">Shelf</label><input id="shelf" name="shelf" maxLength={30} defaultValue={book.shelf ?? ""} /></div>
              <div><label htmlFor="copies">Copies</label><input id="copies" name="copies" type="number" min={1} max={500} required defaultValue={book.copies} /></div>
            </div>
            <div className="row" style={{ marginTop: 12 }}><button className="btn">Save changes</button></div>
          </form>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Delete book</h2>
            <p className="sub">A book that has been issued before keeps its history and cannot be deleted.</p>
            <form action={deleteBook}>
              <input type="hidden" name="id" value={id} />
              <ConfirmButton className="btn ghost" message={`Delete "${book.title}"?`}>Delete book</ConfirmButton>
            </form>
          </div>
        </>
      )}
    </>
  );
}
