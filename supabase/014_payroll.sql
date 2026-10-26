-- Salary and payroll (migration 014)
-- Supabase Dashboard -> SQL Editor: paste this whole file and Run.
-- Run it after 012_staff.sql and 013_staff_attendance.sql. Safe to run more than once.

-- Each staff member's fixed monthly salary.
alter table staff add column if not exists monthly_salary numeric(12, 2)
  check (monthly_salary is null or monthly_salary >= 0);

-- One payslip per person per month. The amounts are copied in when the payslip is generated,
-- so changing a salary later never rewrites a month that was already paid.
create table if not exists payslips (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  basic numeric(12, 2) not null,
  days_in_month int not null,
  unpaid_days numeric(5, 1) not null default 0,
  paid_leave_allowed int not null default 0,
  payable_days numeric(5, 1) not null,
  earned numeric(12, 2) not null,
  allowances numeric(12, 2) not null default 0 check (allowances >= 0),
  deductions numeric(12, 2) not null default 0 check (deductions >= 0),
  deduction_note text,
  net numeric(12, 2) not null check (net >= 0),
  status text not null default 'draft' check (status in ('draft', 'paid')),
  paid_on date,
  payment_mode text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id, month)
);
create index if not exists payslips_month_idx on payslips (month);

alter table payslips enable row level security;

-- Admin: full control.
drop policy if exists "payslips admin" on payslips;
create policy "payslips admin" on payslips for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

-- A staff member with a linked login can read their own paid payslips.
drop policy if exists "payslips own read" on payslips;
create policy "payslips own read" on payslips for select to authenticated
  using (status = 'paid' and staff_id in (select id from staff where profile_id = auth.uid()));
