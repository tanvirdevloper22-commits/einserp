-- Librarian role (migration 028)
-- Supabase Dashboard -> SQL Editor: paste this whole file and Run.
-- Run it after 026_library.sql. Safe to run more than once.

-- 1. Allow the "librarian" role on profiles.
do $$
declare c text;
begin
  for c in
    select con.conname from pg_constraint con
    where con.conrelid = 'public.profiles'::regclass and con.contype = 'c' and pg_get_constraintdef(con.oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', c);
  end loop;
  alter table public.profiles
    add constraint profiles_role_check check (role in ('pending', 'admin', 'accountant', 'teacher', 'parent', 'attender', 'librarian'));
end $$;

-- 2. A loan remembers the borrower's name and number, so the library pages work without access to the student and staff tables.
alter table library_loans add column if not exists borrower_name text;
alter table library_loans add column if not exists borrower_ref text;

update library_loans l set borrower_name = s.full_name, borrower_ref = s.admission_no
  from students s where l.student_id = s.id and l.borrower_name is null;
update library_loans l set borrower_name = s.full_name, borrower_ref = s.employee_no
  from staff s where l.staff_id = s.id and l.borrower_name is null;

create or replace function library_fill_borrower() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.student_id is not null then
    select full_name, admission_no into new.borrower_name, new.borrower_ref from students where id = new.student_id;
  elsif new.staff_id is not null then
    select full_name, employee_no into new.borrower_name, new.borrower_ref from staff where id = new.staff_id;
  end if;
  return new;
end $$;
drop trigger if exists library_loans_borrower on library_loans;
create trigger library_loans_borrower before insert on library_loans for each row execute function library_fill_borrower();

-- 3. The librarian manages books and loans, and nothing else.
drop policy if exists "library_books librarian" on library_books;
create policy "library_books librarian" on library_books for all to authenticated
  using (app_role() = 'librarian') with check (app_role() = 'librarian');
drop policy if exists "library_loans librarian" on library_loans;
create policy "library_loans librarian" on library_loans for all to authenticated
  using (app_role() = 'librarian') with check (app_role() = 'librarian');

-- 4. Finding a borrower: active students and staff by name or number, up to 25, for admin and librarian only.
create or replace function library_find_borrowers(q text)
returns table (kind text, id uuid, name text, ref text)
language sql stable security definer set search_path = public as $$
  select * from (
    select 'student'::text as kind, s.id, s.full_name as name, s.admission_no as ref
      from students s
     where s.status = 'active' and (s.full_name ilike '%' || q || '%' or s.admission_no ilike '%' || q || '%')
    union all
    select 'staff'::text, t.id, t.full_name, t.employee_no
      from staff t
     where t.status = 'active' and (t.full_name ilike '%' || q || '%' or t.employee_no ilike '%' || q || '%')
  ) x
  where app_role() in ('admin', 'librarian') and char_length(trim(q)) >= 2
  order by x.name
  limit 25
$$;
revoke all on function library_find_borrowers(text) from public;
grant execute on function library_find_borrowers(text) to authenticated;

notify pgrst, 'reload schema';
