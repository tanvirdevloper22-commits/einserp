-- School Management System: Supabase schema (v1)
-- Supabase Dashboard -> SQL Editor mein ye poora file paste karke Run karein.

create extension if not exists "pgcrypto";

-- Classes
create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,            -- e.g. "Class 5"
  section text not null default 'A',
  created_at timestamptz not null default now(),
  unique (name, section)
);

-- Students
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  admission_no text not null unique,
  full_name text not null,
  dob date,
  gender text check (gender in ('male', 'female', 'other')),
  guardian_name text,
  guardian_phone text,
  address text,
  class_id uuid references classes(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'left')),
  created_at timestamptz not null default now()
);
create index if not exists students_class_idx on students(class_id);

-- Attendance (ek student, ek din, ek record)
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  date date not null,
  status text not null check (status in ('present', 'absent', 'late', 'leave')),
  created_at timestamptz not null default now(),
  unique (student_id, date)
);
create index if not exists attendance_date_idx on attendance(date);

-- Fees (student par lagayi gayi fee) aur Payments (jama ki gayi rakam)
create table if not exists fees (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  title text not null,           -- e.g. "Tuition Oct 2026"
  amount numeric(10, 2) not null check (amount >= 0),
  due_date date,
  created_at timestamptz not null default now()
);
create index if not exists fees_student_idx on fees(student_id);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  fee_id uuid not null references fees(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  paid_on date not null default current_date,
  mode text not null default 'cash' check (mode in ('cash', 'upi', 'bank', 'cheque')),
  receipt_no bigint generated always as identity,
  created_at timestamptz not null default now()
);
create index if not exists payments_fee_idx on payments(fee_id);

-- Har fee ka balance (kitna lagaya, kitna jama hua, kitna baaki)
create or replace view fee_balances as
select
  f.id as fee_id,
  f.student_id,
  f.title,
  f.amount,
  f.due_date,
  coalesce(sum(p.amount), 0) as paid,
  f.amount - coalesce(sum(p.amount), 0) as due
from fees f
left join payments p on p.fee_id = f.id
group by f.id;

-- Exams, Subjects, Marks
create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists exams (
  id uuid primary key default gen_random_uuid(),
  name text not null,            -- e.g. "Half Yearly 2026"
  exam_date date,
  created_at timestamptz not null default now()
);

create table if not exists marks (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references exams(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  marks_obtained numeric(5, 2) not null check (marks_obtained >= 0),
  max_marks numeric(5, 2) not null default 100 check (max_marks > 0),
  unique (exam_id, student_id, subject_id)
);
create index if not exists marks_student_idx on marks(student_id);

-- Row Level Security: v1 mein sirf logged-in staff ko poora access.
-- Aage chalkar roles (admin / teacher / parent) ke hisaab se policies tight karein.
alter table classes enable row level security;
alter table students enable row level security;
alter table attendance enable row level security;
alter table fees enable row level security;
alter table payments enable row level security;
alter table subjects enable row level security;
alter table exams enable row level security;
alter table marks enable row level security;

do $$
declare t text;
begin
  foreach t in array array['classes','students','attendance','fees','payments','subjects','exams','marks']
  loop
    execute format('drop policy if exists "staff full access" on %I', t);
    execute format(
      'create policy "staff full access" on %I for all to authenticated using (true) with check (true)', t
    );
  end loop;
end $$;

alter view fee_balances set (security_invoker = true);

-- Sample data (optional)
insert into classes (name, section) values ('Class 1','A'),('Class 2','A'),('Class 3','A'),('Class 4','A'),('Class 5','A')
on conflict do nothing;
insert into subjects (name) values ('English'),('Hindi'),('Maths'),('Science'),('Social Studies')
on conflict do nothing;
