-- Admission enquiries and student category fields (migration 023)
-- Supabase Dashboard -> SQL Editor: paste this whole file and Run.
-- Run it after 002_roles.sql and 005_admission_files.sql. Safe to run more than once.

-- 1. Student category and welfare flags (used by RTE reports and the UDISE+ style export).
alter table students
  add column if not exists social_category text check (social_category is null or social_category in ('General', 'OBC', 'SC', 'ST', 'EWS')),
  add column if not exists is_rte boolean not null default false,
  add column if not exists is_bpl boolean not null default false,
  add column if not exists is_cwsn boolean not null default false,
  add column if not exists mother_tongue text;

-- 2. Admission enquiries: parents who ask about admission, followed until they join or drop out.
create table if not exists enquiries (
  id uuid primary key default gen_random_uuid(),
  child_name text not null check (char_length(child_name) between 1 and 100),
  class_applied text,
  guardian_name text,
  phone text not null check (char_length(phone) between 7 and 20),
  email text,
  source text not null default 'walk_in' check (source in ('walk_in', 'phone', 'website', 'referral', 'social', 'advertisement', 'other')),
  status text not null default 'new' check (status in ('new', 'contacted', 'visit', 'applied', 'admitted', 'lost')),
  follow_up_date date,
  student_id uuid references students(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists enquiries_status_idx on enquiries (status, created_at desc);
create index if not exists enquiries_follow_idx on enquiries (follow_up_date) where follow_up_date is not null;
create index if not exists enquiries_phone_idx on enquiries (phone);

-- The conversation history of one enquiry (calls made, what was said, status changes).
create table if not exists enquiry_notes (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references enquiries(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_by uuid references profiles(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists enquiry_notes_enquiry_idx on enquiry_notes (enquiry_id, created_at);

alter table enquiries enable row level security;
alter table enquiry_notes enable row level security;

drop policy if exists "enquiries admin" on enquiries;
create policy "enquiries admin" on enquiries for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');
drop policy if exists "enquiry notes admin" on enquiry_notes;
create policy "enquiry notes admin" on enquiry_notes for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');
