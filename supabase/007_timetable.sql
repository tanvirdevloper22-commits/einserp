-- Timetable: period timings and the weekly slots for each class.
-- Run in the Supabase SQL Editor after 002_roles.sql. Safe to run more than once.

create table if not exists timetable_periods (
  period_no int primary key check (period_no between 1 and 12),
  start_time time not null,
  end_time time not null,
  is_break boolean not null default false,
  label text,
  check (end_time > start_time)
);

create table if not exists timetable_slots (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  day_no int not null check (day_no between 1 and 7),          -- 1 = Monday ... 7 = Sunday
  period_no int not null references timetable_periods(period_no) on delete cascade,
  subject_id uuid references subjects(id) on delete set null,
  teacher_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (class_id, day_no, period_no)
);
create index if not exists timetable_slots_class_idx on timetable_slots(class_id);

-- A teacher cannot be in two classes in the same period.
create unique index if not exists timetable_teacher_clash
  on timetable_slots(teacher_id, day_no, period_no) where teacher_id is not null;

alter table timetable_periods enable row level security;
alter table timetable_slots enable row level security;

drop policy if exists "timetable periods read" on timetable_periods;
create policy "timetable periods read" on timetable_periods for select to authenticated
  using (app_role() in ('admin', 'accountant', 'teacher'));
drop policy if exists "timetable periods admin write" on timetable_periods;
create policy "timetable periods admin write" on timetable_periods for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

drop policy if exists "timetable slots read" on timetable_slots;
create policy "timetable slots read" on timetable_slots for select to authenticated
  using (app_role() in ('admin', 'accountant', 'teacher'));
drop policy if exists "timetable slots admin write" on timetable_slots;
create policy "timetable slots admin write" on timetable_slots for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

-- Default day: 7 periods and a break. Edit the timings on the Timetable page.
insert into timetable_periods (period_no, start_time, end_time, is_break, label) values
  (1, '08:00', '08:40', false, null),
  (2, '08:40', '09:20', false, null),
  (3, '09:20', '10:00', false, null),
  (4, '10:00', '10:20', true,  'Break'),
  (5, '10:20', '11:00', false, null),
  (6, '11:00', '11:40', false, null),
  (7, '11:40', '12:20', false, null),
  (8, '12:20', '13:00', false, null)
on conflict (period_no) do nothing;
