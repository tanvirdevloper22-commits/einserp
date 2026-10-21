-- EinsERP: Fee structure (migration 003)
-- Supabase Dashboard -> SQL Editor mein ye poora file paste karke Run karein.
-- Pehle schema.sql aur 002_roles.sql run ho chuke hone chahiye.

create table if not exists fee_structures (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  title text not null,                 -- e.g. "Tuition", "Transport", "Exam fee"
  amount numeric(10, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (class_id, title)
);

alter table fee_structures enable row level security;

drop policy if exists "fee structures staff" on fee_structures;
create policy "fee structures staff" on fee_structures for all to authenticated
  using (app_role() in ('admin', 'accountant'))
  with check (app_role() in ('admin', 'accountant'));
