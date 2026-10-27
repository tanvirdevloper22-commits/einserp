-- Fee concessions (sibling, scholarship, RTE, staff child) and late fine (migration 016)
-- Supabase Dashboard -> SQL Editor: paste this whole file and Run.
-- Run it after 003_fee_structure.sql and 004_settings_invoices.sql. Safe to run more than once.

-- Concessions given to a student. They are applied when fees are generated or added.
create table if not exists fee_concessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  kind text not null check (kind in ('sibling', 'scholarship', 'rte', 'staff_child', 'other')),
  mode text not null check (mode in ('percent', 'fixed', 'full')),
  value numeric(10, 2) not null default 0 check (value >= 0),
  -- Only fees whose title starts with this text get the concession (for example "Tuition"). Empty means every fee.
  applies_to text,
  note text,
  active boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint fee_concessions_value_ok check (
    mode = 'full'
    or (mode = 'percent' and value between 1 and 100)
    or (mode = 'fixed' and value > 0)
  )
);
create index if not exists fee_concessions_student_idx on fee_concessions (student_id);

alter table fee_concessions enable row level security;

-- Admins manage concessions; accountants can see them.
drop policy if exists "fee concessions admin" on fee_concessions;
create policy "fee concessions admin" on fee_concessions for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');
drop policy if exists "fee concessions accountant read" on fee_concessions;
create policy "fee concessions accountant read" on fee_concessions for select to authenticated
  using (app_role() = 'accountant');

-- A fee keeps its original amount and the concession given, so the invoice can show both.
-- "amount" stays the amount payable, so balances and payments keep working as before.
alter table fees
  add column if not exists gross_amount numeric(10, 2),
  add column if not exists concession_amount numeric(10, 2) not null default 0 check (concession_amount >= 0),
  add column if not exists concession_note text;

-- Late fine: a flat amount added once to each fee that is still unpaid after its due date plus the grace days.
alter table school_settings
  add column if not exists late_fine_amount numeric(10, 2) not null default 0 check (late_fine_amount >= 0),
  add column if not exists late_fine_grace_days int not null default 0 check (late_fine_grace_days >= 0);
