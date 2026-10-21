-- EinsERP: School logo and ID card details (migration 006)
-- Supabase Dashboard -> SQL Editor: paste this whole file and Run.
-- Run it after 004_settings_invoices.sql (it extends school_settings) and 002_roles.sql (it uses app_role()).

-- 1. Logo file name and the academic session printed on ID cards
alter table school_settings
  add column if not exists logo_path text,
  add column if not exists session_label text;   -- e.g. 2026-27

-- 2. Public bucket for the school logo only (a logo is not sensitive, and it is shown on printed pages).
--    1 MB limit, images only. Student photos and ID proofs stay in the private student-files bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('school-assets', 'school-assets', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 3. Anyone can view the logo (public bucket); only admins can upload, replace or remove it
drop policy if exists "school assets admin write" on storage.objects;
create policy "school assets admin write" on storage.objects
  for all to authenticated
  using (bucket_id = 'school-assets' and public.app_role() = 'admin')
  with check (bucket_id = 'school-assets' and public.app_role() = 'admin');
