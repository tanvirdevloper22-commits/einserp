-- Attender role and QR scanning (migration 019)
-- Supabase Dashboard -> SQL Editor: paste this whole file and Run.
-- Run it after 002_roles.sql. Safe to run more than once.

-- 1. Allow the new "attender" role on profiles (the person at the gate who only scans ID cards).
do $$
declare c text;
begin
  for c in
    select con.conname from pg_constraint con
    where con.conrelid = 'public.profiles'::regclass and con.contype = 'c' and pg_get_constraintdef(con.oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', c);
  end loop;
  alter table public.profiles
    add constraint profiles_role_check check (role in ('pending', 'admin', 'accountant', 'teacher', 'parent', 'attender'));
end $$;

-- 2. Mark one scanned student present or late for today (Indian date). The attender has no access to the tables
--    themselves; this function does the one thing they are allowed to do and returns only the name and class.
create or replace function scan_attendance_mark(p_student uuid, p_status text default 'present')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  today date := (now() at time zone 'Asia/Kolkata')::date;
  cur text;
  who jsonb;
begin
  if app_role() is null or app_role() not in ('admin', 'teacher', 'attender') then
    raise exception 'You are not allowed to scan attendance.';
  end if;
  if p_status not in ('present', 'late') then
    raise exception 'Status must be present or late.';
  end if;

  select st.full_name as full_name, st.admission_no as admission_no, st.status as student_status, c.name as class_name, c.section as class_section
    into s
    from students st left join classes c on c.id = st.class_id
   where st.id = p_student;
  if not found then
    return jsonb_build_object('kind', 'notfound');
  end if;

  who := jsonb_build_object(
    'name', s.full_name,
    'admission_no', s.admission_no,
    'class', case when s.class_name is null then 'No class' else s.class_name || ' - ' || s.class_section end
  );
  if s.student_status <> 'active' then
    return who || jsonb_build_object('kind', 'left');
  end if;

  select a.status into cur from attendance a where a.student_id = p_student and a.date = today;
  if cur in ('present', 'late') then
    return who || jsonb_build_object('kind', 'already', 'status', cur);
  end if;
  if cur = 'leave' then
    return who || jsonb_build_object('kind', 'leave', 'status', cur);
  end if;

  insert into attendance (student_id, date, status) values (p_student, today, p_status)
  on conflict (student_id, date) do update set status = excluded.status;
  return who || jsonb_build_object('kind', 'marked', 'status', p_status);
end;
$$;

-- 3. Today's numbers for every class: active students and how many are present, late, on leave or marked absent.
--    Students with no record yet are not counted in those columns (the app shows them as not arrived).
create or replace function attendance_today()
returns table (cls_id uuid, cls_name text, cls_section text, total int, present int, late int, on_leave int, absent_marked int)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, c.section,
         count(st.id)::int,
         (count(a.id) filter (where a.status = 'present'))::int,
         (count(a.id) filter (where a.status = 'late'))::int,
         (count(a.id) filter (where a.status = 'leave'))::int,
         (count(a.id) filter (where a.status = 'absent'))::int
    from students st
    left join classes c on c.id = st.class_id
    left join attendance a on a.student_id = st.id and a.date = (now() at time zone 'Asia/Kolkata')::date
   where st.status = 'active' and app_role() in ('admin', 'teacher', 'attender')
   group by c.id, c.name, c.section
   order by c.name, c.section
$$;

revoke all on function scan_attendance_mark(uuid, text) from public;
revoke all on function attendance_today() from public;
grant execute on function scan_attendance_mark(uuid, text) to authenticated;
grant execute on function attendance_today() to authenticated;
