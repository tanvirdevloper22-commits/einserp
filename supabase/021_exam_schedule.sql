-- Exam date sheet and admit cards (migration 021)
-- Supabase Dashboard -> SQL Editor: paste this whole file and Run.
-- Run it after 002_roles.sql and 008_parent_portal.sql (it uses app_role() and is_my_class()). Safe to run more than once.

-- One row per paper: which class writes which subject on which day, and when it starts and ends.
create table if not exists exam_papers (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references exams(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  paper_date date not null,
  start_time time,
  end_time time,
  created_at timestamptz not null default now(),
  unique (exam_id, class_id, subject_id)
);
create index if not exists exam_papers_exam_class_idx on exam_papers (exam_id, class_id, paper_date);

-- Instructions printed on the admit card of this exam (one per line). Empty means the default list.
alter table exams add column if not exists instructions text;

alter table exam_papers enable row level security;

drop policy if exists "exam papers admin" on exam_papers;
create policy "exam papers admin" on exam_papers for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

drop policy if exists "exam papers teacher read" on exam_papers;
create policy "exam papers teacher read" on exam_papers for select to authenticated
  using (app_role() = 'teacher');

-- Parents see the date sheet of their own children's classes only.
drop policy if exists "exam papers parent read" on exam_papers;
create policy "exam papers parent read" on exam_papers for select to authenticated
  using (app_role() = 'parent' and is_my_class(class_id));
