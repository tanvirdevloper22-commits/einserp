-- Staff attendance (migration 013)
-- Supabase Dashboard -> SQL Editor: paste this whole file and Run.
-- Run it after 012_staff.sql. Safe to run more than once.

create table if not exists staff_attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  date date not null,
  status text not null check (status in ('present', 'absent', 'late', 'half_day', 'leave')),
  note text,
  marked_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (staff_id, date)
);
create index if not exists staff_attendance_date_idx on staff_attendance (date);

alter table staff_attendance enable row level security;

-- Admin: full control.
drop policy if exists "staff attendance admin" on staff_attendance;
create policy "staff attendance admin" on staff_attendance for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

-- A staff member with a linked login can read their own attendance.
drop policy if exists "staff attendance own read" on staff_attendance;
create policy "staff attendance own read" on staff_attendance for select to authenticated
  using (staff_id in (select id from staff where profile_id = auth.uid()));
