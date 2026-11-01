-- Admission number prefix (migration 027)
-- Supabase Dashboard -> SQL Editor: paste this whole file and Run.
-- Run it after 004_settings_invoices.sql. Safe to run more than once.
alter table school_settings
  add column if not exists admission_prefix text check (admission_prefix is null or admission_prefix ~ '^[A-Za-z0-9/_.-]{0,12}$');
notify pgrst, 'reload schema';
