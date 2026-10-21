-- EinsERP: School settings, UPI details and invoice numbers (migration 004)
-- Supabase Dashboard -> SQL Editor: paste this whole file and Run.
-- Run it after schema.sql, 002_roles.sql and 003_fee_structure.sql.

-- 1. One-row settings table (school details shown on invoices, UPI payee for the QR code)
create table if not exists school_settings (
  id int primary key default 1 check (id = 1),
  school_name text not null default 'Your School',
  address text,
  phone text,
  email text,
  upi_id text,            -- e.g. schoolname@okaxis
  upi_name text,          -- payee name shown in the UPI app
  invoice_note text,      -- footer text on invoices
  updated_at timestamptz not null default now()
);

insert into school_settings (id) values (1) on conflict (id) do nothing;

alter table school_settings enable row level security;

drop policy if exists "settings read" on school_settings;
drop policy if exists "settings admin write" on school_settings;
create policy "settings read" on school_settings for select to authenticated
  using (app_role() in ('admin', 'accountant'));
create policy "settings admin write" on school_settings for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

-- 2. Invoice numbers: every fee gets a running number (existing fees are numbered too)
alter table fees add column if not exists invoice_no bigint generated always as identity;
create unique index if not exists fees_invoice_no_key on fees(invoice_no);
