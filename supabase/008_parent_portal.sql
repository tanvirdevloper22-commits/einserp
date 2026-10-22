-- Parent portal: link parent accounts to their children and let parents read only their own children's records.
-- Run in the Supabase SQL Editor after 002_roles.sql (and 007_timetable.sql if you use the timetable). Safe to run more than once.

create table if not exists parent_students (
  parent_id uuid not null references profiles(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (parent_id, student_id)
);
create index if not exists parent_students_student_idx on parent_students(student_id);

alter table parent_students enable row level security;
drop policy if exists "parent links admin" on parent_students;
create policy "parent links admin" on parent_students for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');
drop policy if exists "parent links own" on parent_students;
create policy "parent links own" on parent_students for select to authenticated
  using (parent_id = auth.uid());

-- Helpers used by the policies below (security definer so they can read parent_students).
create or replace function is_my_child(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from parent_students where parent_id = auth.uid() and student_id = sid);
$$;

create or replace function is_my_fee(fid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from fees f join parent_students ps on ps.student_id = f.student_id
    where f.id = fid and ps.parent_id = auth.uid()
  );
$$;

create or replace function is_my_class(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from students s join parent_students ps on ps.student_id = s.id
    where s.class_id = cid and ps.parent_id = auth.uid()
  );
$$;

-- Parents can read only their own children's rows.
drop policy if exists "students parent read" on students;
create policy "students parent read" on students for select to authenticated
  using (app_role() = 'parent' and is_my_child(id));

drop policy if exists "attendance parent read" on attendance;
create policy "attendance parent read" on attendance for select to authenticated
  using (app_role() = 'parent' and is_my_child(student_id));

drop policy if exists "fees parent read" on fees;
create policy "fees parent read" on fees for select to authenticated
  using (app_role() = 'parent' and is_my_child(student_id));

drop policy if exists "payments parent read" on payments;
create policy "payments parent read" on payments for select to authenticated
  using (app_role() = 'parent' and is_my_fee(fee_id));

drop policy if exists "marks parent read" on marks;
create policy "marks parent read" on marks for select to authenticated
  using (app_role() = 'parent' and is_my_child(student_id));

-- Names that are not private: exam names, subjects, class names and the school's own details.
drop policy if exists "exams parent read" on exams;
create policy "exams parent read" on exams for select to authenticated using (app_role() = 'parent');
drop policy if exists "subjects parent read" on subjects;
create policy "subjects parent read" on subjects for select to authenticated using (app_role() = 'parent');
drop policy if exists "classes parent read" on classes;
create policy "classes parent read" on classes for select to authenticated using (app_role() = 'parent' and is_my_class(id));
drop policy if exists "settings parent read" on school_settings;
create policy "settings parent read" on school_settings for select to authenticated using (app_role() = 'parent');

-- Timetable (only if migration 007 has been run).
do $$
begin
  if to_regclass('public.timetable_slots') is not null then
    execute 'drop policy if exists "timetable periods parent read" on timetable_periods';
    execute 'create policy "timetable periods parent read" on timetable_periods for select to authenticated using (app_role() = ''parent'')';
    execute 'drop policy if exists "timetable slots parent read" on timetable_slots';
    execute 'create policy "timetable slots parent read" on timetable_slots for select to authenticated using (app_role() = ''parent'' and is_my_class(class_id))';
  end if;
end $$;
