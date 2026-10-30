-- Leave applications (migration 022)
-- Supabase Dashboard -> SQL Editor: paste this whole file and Run.
-- Run it after 002_roles.sql, 008_parent_portal.sql, 012_staff.sql and 013_staff_attendance.sql. Safe to run more than once.

create table if not exists leave_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('student', 'staff')),
  student_id uuid references students(id) on delete cascade,
  staff_id uuid references staff(id) on delete cascade,
  from_date date not null,
  to_date date not null,
  reason text not null check (char_length(reason) between 1 and 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  applied_by uuid references profiles(id) on delete set null,
  applied_by_name text,
  decided_by uuid references profiles(id) on delete set null,
  decided_by_name text,
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 300),
  created_at timestamptz not null default now(),
  check (to_date >= from_date and to_date - from_date <= 60),
  check ((kind = 'student' and student_id is not null and staff_id is null)
      or (kind = 'staff' and staff_id is not null and student_id is null))
);
create index if not exists leave_status_idx on leave_requests (status, created_at desc);
create index if not exists leave_student_idx on leave_requests (student_id);
create index if not exists leave_staff_idx on leave_requests (staff_id);

-- The staff record of the logged-in user (security definer so a teacher can use it inside a policy).
create or replace function my_staff_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from staff where profile_id = auth.uid() limit 1;
$$;

alter table leave_requests enable row level security;

-- Admin: full control.
drop policy if exists "leave admin" on leave_requests;
create policy "leave admin" on leave_requests for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

-- Parents: apply for their own child, see their children's requests, and withdraw one that is still pending.
drop policy if exists "leave parent read" on leave_requests;
create policy "leave parent read" on leave_requests for select to authenticated
  using (app_role() = 'parent' and kind = 'student' and is_my_child(student_id));
drop policy if exists "leave parent insert" on leave_requests;
create policy "leave parent insert" on leave_requests for insert to authenticated
  with check (app_role() = 'parent' and kind = 'student' and is_my_child(student_id) and applied_by = auth.uid() and status = 'pending');
drop policy if exists "leave parent withdraw" on leave_requests;
create policy "leave parent withdraw" on leave_requests for delete to authenticated
  using (app_role() = 'parent' and kind = 'student' and is_my_child(student_id) and status = 'pending');

-- Teachers: read every student request and decide them; apply for their own leave and read it; withdraw their own pending request.
drop policy if exists "leave teacher read" on leave_requests;
create policy "leave teacher read" on leave_requests for select to authenticated
  using (app_role() = 'teacher' and (kind = 'student' or staff_id = my_staff_id()));
drop policy if exists "leave teacher decide" on leave_requests;
create policy "leave teacher decide" on leave_requests for update to authenticated
  using (app_role() = 'teacher' and kind = 'student') with check (app_role() = 'teacher' and kind = 'student');
drop policy if exists "leave teacher insert" on leave_requests;
create policy "leave teacher insert" on leave_requests for insert to authenticated
  with check (app_role() = 'teacher' and kind = 'staff' and staff_id = my_staff_id() and applied_by = auth.uid() and status = 'pending');
drop policy if exists "leave teacher withdraw" on leave_requests;
create policy "leave teacher withdraw" on leave_requests for delete to authenticated
  using (app_role() = 'teacher' and kind = 'staff' and staff_id = my_staff_id() and status = 'pending');
