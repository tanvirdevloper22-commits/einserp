-- Notices / announcements (migration 011)
-- Supabase Dashboard -> SQL Editor: paste this whole file and Run.
-- Run it after 002_roles.sql and 008_parent_portal.sql (it uses app_role() and is_my_class()). Safe to run more than once.

create table if not exists notices (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 2000),
  audience text not null default 'all' check (audience in ('all', 'staff', 'parents', 'class')),
  class_id uuid references classes(id) on delete cascade,
  pinned boolean not null default false,
  expires_on date,
  created_by uuid references profiles(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  -- A class notice needs a class; every other audience must not have one.
  constraint notices_class_matches_audience check ((audience = 'class') = (class_id is not null))
);
create index if not exists notices_recent_idx on notices (pinned desc, created_at desc);
create index if not exists notices_class_idx on notices (class_id);

alter table notices enable row level security;

-- Admin: full control.
drop policy if exists "notices admin" on notices;
create policy "notices admin" on notices for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

-- Accountants and teachers can read every notice.
drop policy if exists "notices staff read" on notices;
create policy "notices staff read" on notices for select to authenticated
  using (app_role() in ('accountant', 'teacher'));

-- Teachers can post notices for their classes or for staff, and edit or delete only their own.
drop policy if exists "notices teacher insert" on notices;
create policy "notices teacher insert" on notices for insert to authenticated
  with check (app_role() = 'teacher' and created_by = auth.uid() and audience in ('class', 'staff'));
drop policy if exists "notices teacher update" on notices;
create policy "notices teacher update" on notices for update to authenticated
  using (app_role() = 'teacher' and created_by = auth.uid())
  with check (app_role() = 'teacher' and created_by = auth.uid() and audience in ('class', 'staff'));
drop policy if exists "notices teacher delete" on notices;
create policy "notices teacher delete" on notices for delete to authenticated
  using (app_role() = 'teacher' and created_by = auth.uid());

-- Parents see notices for everyone, for parents, and for their own children's classes.
drop policy if exists "notices parent read" on notices;
create policy "notices parent read" on notices for select to authenticated
  using (
    app_role() = 'parent'
    and (audience in ('all', 'parents') or (audience = 'class' and is_my_class(class_id)))
  );
