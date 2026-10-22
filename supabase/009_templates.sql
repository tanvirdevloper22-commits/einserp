-- Document templates and accent colour (migration 009)
-- Supabase Dashboard -> SQL Editor: paste this whole file and Run.
-- Run it after 004_settings_invoices.sql and 006_logo_idcards.sql (it extends school_settings). Safe to run more than once.

alter table school_settings
  add column if not exists invoice_template text not null default 'classic',     -- also used for payment receipts
  add column if not exists report_template text not null default 'classic',
  add column if not exists admission_template text not null default 'classic',
  add column if not exists timetable_template text not null default 'classic',
  add column if not exists idcard_template text not null default 'classic',
  add column if not exists accent_color text not null default '#036cf9';
