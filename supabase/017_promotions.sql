-- Year-end promotion (migration 017)
-- Supabase Dashboard -> SQL Editor: paste this whole file and Run.
-- Run it after 002_roles.sql (it uses profiles and app_role()). Safe to run more than once.

-- One row per class promotion run, kept so it can be seen later and undone.
create table if not exists promotion_batches (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('promote', 'pass_out')),
  from_class_id uuid references classes(id) on delete set null,
  to_class_id uuid references classes(id) on delete set null,
  from_label text not null,
  to_label text,                       -- empty for students who passed out
  session_from text,
  session_to text,
  student_count int not null check (student_count >= 0),
  undone_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists promotion_batches_recent_idx on promotion_batches (created_at desc);

-- The students that were moved in each run.
create table if not exists promotion_students (
  batch_id uuid not null references promotion_batches(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  primary key (batch_id, student_id)
);
create index if not exists promotion_students_student_idx on promotion_students (student_id);

alter table promotion_batches enable row level security;
alter table promotion_students enable row level security;

-- Only admins can see or run promotions.
drop policy if exists "promotion batches admin" on promotion_batches;
create policy "promotion batches admin" on promotion_batches for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');
drop policy if exists "promotion students admin" on promotion_students;
create policy "promotion students admin" on promotion_students for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');
