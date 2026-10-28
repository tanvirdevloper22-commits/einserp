-- Absent alerts (migration 020)
-- Supabase Dashboard -> SQL Editor: paste this whole file and Run.
-- Run it after 002_roles.sql. Safe to run more than once.

-- The message text parents receive; {student}, {guardian}, {class}, {date} and {school} are filled in. Empty means the default text.
alter table school_settings add column if not exists absent_message text;

-- A record of which parents have already been alerted (so two teachers do not send the same message twice).
create table if not exists absence_alerts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  alert_date date not null,
  channel text not null check (channel in ('whatsapp', 'sms')),
  sent_by uuid references profiles(id) on delete set null,
  sent_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists absence_alerts_date_idx on absence_alerts (alert_date, student_id);

alter table absence_alerts enable row level security;

drop policy if exists "absence alerts read" on absence_alerts;
create policy "absence alerts read" on absence_alerts for select to authenticated
  using (app_role() in ('admin', 'teacher'));
drop policy if exists "absence alerts insert" on absence_alerts;
create policy "absence alerts insert" on absence_alerts for insert to authenticated
  with check (app_role() in ('admin', 'teacher') and sent_by = auth.uid());
drop policy if exists "absence alerts admin delete" on absence_alerts;
create policy "absence alerts admin delete" on absence_alerts for delete to authenticated
  using (app_role() = 'admin');
