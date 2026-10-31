-- Holiday and events calendar (migration 024)
-- Supabase Dashboard -> SQL Editor: paste this whole file and Run.
-- Run it after 002_roles.sql. Safe to run more than once.

create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  kind text not null default 'event' check (kind in ('holiday', 'event', 'exam', 'meeting', 'other')),
  start_date date not null,
  end_date date not null,
  details text check (details is null or char_length(details) <= 500),
  created_by uuid references profiles(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date and end_date - start_date <= 60)
);
create index if not exists calendar_events_dates_idx on calendar_events (start_date, end_date);

alter table calendar_events enable row level security;

-- Admin: full control.
drop policy if exists "calendar admin" on calendar_events;
create policy "calendar admin" on calendar_events for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

-- Everyone with a role can read the school calendar.
drop policy if exists "calendar read" on calendar_events;
create policy "calendar read" on calendar_events for select to authenticated
  using (app_role() in ('teacher', 'accountant', 'parent', 'attender'));
