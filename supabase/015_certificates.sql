-- Certificates: Transfer Certificate, Bonafide and Character (migration 015)
-- Supabase Dashboard -> SQL Editor: paste this whole file and Run.
-- Run it after 002_roles.sql (it uses profiles and app_role()). Safe to run more than once.

create table if not exists certificates (
  id uuid primary key default gen_random_uuid(),
  cert_type text not null check (cert_type in ('transfer', 'bonafide', 'character')),
  -- Running number within each type (TC-0001, BON-0001, ...).
  cert_no int not null,
  student_id uuid references students(id) on delete set null,
  issued_on date not null default current_date,

  -- The student's details are copied in when the certificate is issued, so editing the student later
  -- never changes a certificate that was already handed out.
  student_name text not null,
  admission_no text not null,
  father_name text,
  mother_name text,
  guardian_name text,
  dob date,
  gender text,
  class_name text,
  admission_date date,
  session_label text,

  leaving_date date,
  reason text,
  conduct text,
  purpose text,
  remarks text,
  dues_cleared boolean,

  issued_by uuid references profiles(id) on delete set null,
  issued_by_name text,
  created_at timestamptz not null default now(),
  unique (cert_type, cert_no)
);
create index if not exists certificates_student_idx on certificates (student_id);
create index if not exists certificates_recent_idx on certificates (created_at desc);

alter table certificates enable row level security;

-- Only admins can issue, see and print certificates.
drop policy if exists "certificates admin" on certificates;
create policy "certificates admin" on certificates for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');
