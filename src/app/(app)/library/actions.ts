"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { parseMoney } from "@/lib/payroll";
import { todayISO } from "@/lib/dates";
import { LOAN_DAYS, addDays, suggestedFine } from "@/lib/library";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MISSING = "The library tables are missing. Run supabase/026_library.sql in the Supabase SQL Editor first.";
const explain = (m: string) => (/library_|schema cache|does not exist/i.test(m) ? MISSING : m);
const t = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const go = (path: string, qs: string): never => redirect(`${path}?${qs}`);
const err = (path: string, m: string): never => go(path, `error=${encodeURIComponent(m)}`);
const refresh = () => { revalidatePath("/library"); revalidatePath("/portal"); };

function readBook(f: FormData, back: string) {
  const acc = t(f, "accession_no");
  const title = t(f, "title");
  const copies = Number(t(f, "copies") || "1");
  if (!acc || acc.length > 30) err(back, "Enter the accession number (up to 30 characters).");
  if (!title || title.length > 200) err(back, "Enter the title of the book.");
  if (!Number.isInteger(copies) || copies < 1 || copies > 500) err(back, "Copies must be a whole number from 1 to 500.");
  const opt = (k: string, max: number) => t(f, k).slice(0, max) || null;
  return { accession_no: acc, title, author: opt("author", 120), category: opt("category", 60), isbn: opt("isbn", 20), shelf: opt("shelf", 30), copies };
}

export async function addBook(formData: FormData) {
  await requireRole(["admin"]);
  const row = readBook(formData, "/library");
  const supabase = await createClient();
  const { error } = await supabase.from("library_books").insert(row);
  if (error) err("/library", error.code === "23505" ? `Accession number ${row.accession_no} is already used.` : explain(error.message));
  refresh();
  return go("/library", "added=1");
}

export async function updateBook(formData: FormData) {
  await requireRole(["admin"]);
  const id = t(formData, "id");
  if (!UUID.test(id)) return redirect("/library");
  const back = `/library/books/${id}`;
  const row = readBook(formData, back);
  const supabase = await createClient();
  const { count } = await supabase.from("library_loans").select("id", { count: "exact", head: true }).eq("book_id", id).is("returned_on", null);
  if ((count ?? 0) > row.copies) err(back, `${count} copies are out right now, so the total cannot be less than ${count}.`);
  const { error } = await supabase.from("library_books").update(row).eq("id", id);
  if (error) err(back, error.code === "23505" ? `Accession number ${row.accession_no} is already used.` : explain(error.message));
  refresh();
  return go(back, "saved=1");
}

export async function deleteBook(formData: FormData) {
  await requireRole(["admin"]);
  const id = t(formData, "id");
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("library_books").delete().eq("id", id);
  if (error) err(`/library/books/${id}`, error.code === "23503" ? "This book has issue history, so it cannot be deleted. Reduce its copies instead if you no longer have it." : explain(error.message));
  refresh();
  redirect("/library?deleted=1");
}

export async function issueBook(formData: FormData) {
  const me = await requireRole(["admin"]);
  const bookId = t(formData, "book_id");
  const who = t(formData, "borrower"); // "student:<id>" or "staff:<id>"
  const back = `/library/books/${bookId}`;
  if (!UUID.test(bookId)) return redirect("/library");
  const [kind, id] = who.split(":");
  if (!["student", "staff"].includes(kind) || !UUID.test(id ?? "")) err(back, "Choose who is borrowing the book.");
  const issued = todayISO();
  let due = t(formData, "due_on");
  if (!due) due = addDays(issued, LOAN_DAYS);
  if (!DATE.test(due) || due < issued) err(back, "The due date cannot be before today.");

  const supabase = await createClient();
  const { error } = await supabase.from("library_loans").insert({
    book_id: bookId,
    student_id: kind === "student" ? id : null,
    staff_id: kind === "staff" ? id : null,
    issued_on: issued,
    due_on: due,
    issued_by_name: me.fullName || me.email || null,
  });
  if (error) err(back, /No copy/i.test(error.message) ? "No copy of this book is available right now." : explain(error.message));
  refresh();
  return go(back, "issued=1");
}

export async function returnBook(formData: FormData) {
  await requireRole(["admin"]);
  const id = t(formData, "id");
  const back = t(formData, "back") === "library" ? "/library" : `/library/books/${t(formData, "book_id")}`;
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  const { data: loan } = await supabase.from("library_loans").select("id, due_on, returned_on").eq("id", id).maybeSingle();
  if (!loan || loan.returned_on) err(back, "That loan was not found or is already returned.");
  const today = todayISO();
  const typed = t(formData, "fine");
  const fine = typed === "" ? suggestedFine(loan!.due_on as string, today) : parseMoney(typed);
  if (fine === null) err(back, "Enter the fine as a number, or leave it empty.");
  const { error } = await supabase.from("library_loans").update({ returned_on: today, fine: fine ?? 0 }).eq("id", id).is("returned_on", null);
  if (error) err(back, explain(error.message));
  refresh();
  return go(back, `returned=1&fine=${fine ?? 0}`);
}
