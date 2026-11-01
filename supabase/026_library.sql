-- School library (migration 026)
-- Supabase Dashboard -> SQL Editor: paste this whole file and Run.
-- Run it after 002_roles.sql, 008_parent_portal.sql and 012_staff.sql. Safe to run more than once.

create table if not exists library_books (
  id uuid primary key default gen_random_uuid(),
  accession_no text not null check (char_length(accession_no) between 1 and 30),
  title text not null check (char_length(title) between 1 and 200),
  author text check (author is null or char_length(author) <= 120),
  category text check (category is null or char_length(category) <= 60),
  isbn text check (isbn is null or char_length(isbn) <= 20),
  shelf text check (shelf is null or char_length(shelf) <= 30),
  copies int not null default 1 check (copies between 1 and 500),
  created_at timestamptz not null default now()
);
create unique index if not exists library_books_acc_key on library_books (lower(accession_no));
create index if not exists library_books_title_idx on library_books (lower(title));

create table if not exists library_loans (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references library_books(id) on delete restrict,
  student_id uuid references students(id) on delete cascade,
  staff_id uuid references staff(id) on delete cascade,
  issued_on date not null default current_date,
  due_on date not null,
  returned_on date,
  fine numeric(10, 2) not null default 0 check (fine >= 0),
  issued_by_name text,
  created_at timestamptz not null default now(),
  check ((student_id is not null)::int + (staff_id is not null)::int = 1),
  check (due_on >= issued_on),
  check (returned_on is null or returned_on >= issued_on)
);
create index if not exists library_loans_book_idx on library_loans (book_id) where returned_on is null;
create index if not exists library_loans_student_idx on library_loans (student_id);
create index if not exists library_loans_staff_idx on library_loans (staff_id);
create index if not exists library_loans_open_idx on library_loans (due_on) where returned_on is null;

-- Two people issuing the last copy at the same moment: the book row is locked while the count is checked.
create or replace function library_check_copies() returns trigger
language plpgsql as $$
declare total int; out_now int;
begin
  select copies into total from library_books where id = new.book_id for update;
  select count(*) into out_now from library_loans where book_id = new.book_id and returned_on is null;
  if total is null or out_now >= total then
    raise exception 'No copy of this book is available' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists library_loans_copies on library_loans;
create trigger library_loans_copies before insert on library_loans for each row execute function library_check_copies();

alter table library_books enable row level security;
alter table library_loans enable row level security;

drop policy if exists "library_books admin" on library_books;
create policy "library_books admin" on library_books for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');
drop policy if exists "library_books staff read" on library_books;
create policy "library_books staff read" on library_books for select to authenticated
  using (app_role() in ('teacher', 'accountant'));

drop policy if exists "library_loans admin" on library_loans;
create policy "library_loans admin" on library_loans for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');
drop policy if exists "library_loans teacher read" on library_loans;
create policy "library_loans teacher read" on library_loans for select to authenticated
  using (app_role() = 'teacher');

-- Parents see the loans of their own children, and the titles of those books only.
create or replace function is_my_book(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from library_loans l
    join parent_students ps on ps.student_id = l.student_id
    where l.book_id = bid and ps.parent_id = auth.uid()
  );
$$;
drop policy if exists "library_loans parent read" on library_loans;
create policy "library_loans parent read" on library_loans for select to authenticated
  using (app_role() = 'parent' and student_id is not null and is_my_child(student_id));
drop policy if exists "library_books parent read" on library_books;
create policy "library_books parent read" on library_books for select to authenticated
  using (app_role() = 'parent' and is_my_book(id));
