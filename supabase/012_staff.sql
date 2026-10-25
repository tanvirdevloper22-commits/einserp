-- Teacher and staff records (migration 012)
-- Supabase Dashboard -> SQL Editor: paste this whole file and Run.
-- Run it after 002_roles.sql (it uses profiles and app_role()). Safe to run more than once.

create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  employee_no text not null,
  full_name text not null,
  staff_type text not null default 'teaching' check (staff_type in ('teaching', 'non_teaching')),
  designation text,
  subjects text,
  phone text,
  email text,
  gender text,
  dob date,
  joining_date date,
  qualification text,
  address text,
  emergency_name text,
  emergency_phone text,
  -- The login account this person uses, if any. One account belongs to at most one staff record.
  profile_id uuid references profiles(id) on delete set null,
  -- The class this teacher is class teacher of. A class has at most one class teacher.
  class_teacher_of uuid references classes(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'left')),
  left_on date,
  notes text,
  created_at timestamptz not null default now()
);

create unique index if not exists staff_employee_no_key on staff (lower(employee_no));
create unique index if not exists staff_profile_id_key on staff (profile_id) where profile_id is not null;
create unique index if not exists staff_class_teacher_of_key on staff (class_teacher_of) where class_teacher_of is not null;
create index if not exists staff_name_idx on staff (full_name);

alter table staff enable row level security;

-- Admin: full control.
drop policy if exists "staff admin" on staff;
create policy "staff admin" on staff for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

-- Everyone else can read only their own record (matched through the linked login account).
drop policy if exists "staff own read" on staff;
create policy "staff own read" on staff for select to authenticated
  using (profile_id = auth.uid());
