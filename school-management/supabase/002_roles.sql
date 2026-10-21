-- EinsERP: Role-based access (migration 002)
-- Supabase Dashboard -> SQL Editor mein ye poora file paste karke Run karein.
-- Pehle schema.sql run ho chuka hona chahiye.

-- 1. Profiles: har login user ka role
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'pending'
    check (role in ('pending', 'admin', 'accountant', 'teacher', 'parent')),
  created_at timestamptz not null default now()
);

-- 2. Logged-in user ka role batane wala helper (RLS policies isi ko use karti hain)
create or replace function app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

-- 3. Naya user bante hi profile apne aap ban jaye (role = pending, admin approve karega)
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 4. Jo users pehle se hain unhe admin bana do (taaki aap lock-out na hon)
insert into profiles (id, email, role)
select id, email, 'admin' from auth.users
on conflict (id) do nothing;

-- 5. Profiles ki RLS: apni row sab dekh sakte hain, admin sab dekh aur badal sakta hai
alter table profiles enable row level security;
drop policy if exists "profiles read" on profiles;
drop policy if exists "profiles admin update" on profiles;
create policy "profiles read" on profiles for select to authenticated
  using (id = auth.uid() or app_role() = 'admin');
create policy "profiles admin update" on profiles for update to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

-- 6. Purani "sabko poora access" policies hatao
do $$
declare t text;
begin
  foreach t in array array['classes','students','attendance','fees','payments','subjects','exams','marks']
  loop
    execute format('drop policy if exists "staff full access" on %I', t);
  end loop;
end $$;

-- 7. Role-wise policies
-- classes, subjects: staff padh sakta hai, sirf admin badal sakta hai
drop policy if exists "classes read" on classes;
drop policy if exists "classes admin write" on classes;
create policy "classes read" on classes for select to authenticated
  using (app_role() in ('admin', 'accountant', 'teacher'));
create policy "classes admin write" on classes for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

drop policy if exists "subjects read" on subjects;
drop policy if exists "subjects admin write" on subjects;
create policy "subjects read" on subjects for select to authenticated
  using (app_role() in ('admin', 'accountant', 'teacher'));
create policy "subjects admin write" on subjects for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

-- students: staff padh sakta hai, sirf admin add/edit/delete
drop policy if exists "students read" on students;
drop policy if exists "students admin write" on students;
create policy "students read" on students for select to authenticated
  using (app_role() in ('admin', 'accountant', 'teacher'));
create policy "students admin write" on students for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

-- attendance: admin aur teacher
drop policy if exists "attendance staff" on attendance;
create policy "attendance staff" on attendance for all to authenticated
  using (app_role() in ('admin', 'teacher')) with check (app_role() in ('admin', 'teacher'));

-- fees aur payments: admin aur accountant
drop policy if exists "fees staff" on fees;
create policy "fees staff" on fees for all to authenticated
  using (app_role() in ('admin', 'accountant')) with check (app_role() in ('admin', 'accountant'));

drop policy if exists "payments staff" on payments;
create policy "payments staff" on payments for all to authenticated
  using (app_role() in ('admin', 'accountant')) with check (app_role() in ('admin', 'accountant'));

-- exams: admin aur teacher padh sakte hain, sirf admin exam bana sakta hai
drop policy if exists "exams read" on exams;
drop policy if exists "exams admin write" on exams;
create policy "exams read" on exams for select to authenticated
  using (app_role() in ('admin', 'teacher'));
create policy "exams admin write" on exams for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

-- marks: admin aur teacher
drop policy if exists "marks staff" on marks;
create policy "marks staff" on marks for all to authenticated
  using (app_role() in ('admin', 'teacher')) with check (app_role() in ('admin', 'teacher'));
