-- Homework / assignments (migration 018)
-- Supabase Dashboard -> SQL Editor: paste this whole file and Run.
-- Run it after 002_roles.sql and 008_parent_portal.sql (it uses app_role() and is_my_class()). Safe to run more than once.

create table if not exists homework (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  subject_id uuid references subjects(id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  details text check (details is null or char_length(details) <= 2000),
  assigned_on date not null default current_date,
  due_date date,
  created_by uuid references profiles(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists homework_class_due_idx on homework (class_id, due_date);
create index if not exists homework_recent_idx on homework (created_at desc);

alter table homework enable row level security;

-- Admin: full control.
drop policy if exists "homework admin" on homework;
create policy "homework admin" on homework for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

-- Teachers can read all homework, post their own, and change or delete only their own.
drop policy if exists "homework teacher read" on homework;
create policy "homework teacher read" on homework for select to authenticated
  using (app_role() = 'teacher');
drop policy if exists "homework teacher insert" on homework;
create policy "homework teacher insert" on homework for insert to authenticated
  with check (app_role() = 'teacher' and created_by = auth.uid());
drop policy if exists "homework teacher update" on homework;
create policy "homework teacher update" on homework for update to authenticated
  using (app_role() = 'teacher' and created_by = auth.uid())
  with check (app_role() = 'teacher' and created_by = auth.uid());
drop policy if exists "homework teacher delete" on homework;
create policy "homework teacher delete" on homework for delete to authenticated
  using (app_role() = 'teacher' and created_by = auth.uid());

-- Parents see only the homework of their own children's classes.
drop policy if exists "homework parent read" on homework;
create policy "homework parent read" on homework for select to authenticated
  using (app_role() = 'parent' and is_my_class(class_id));
