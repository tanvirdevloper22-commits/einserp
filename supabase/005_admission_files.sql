-- EinsERP: Admission details, student photo and ID proof (migration 005)
-- Supabase Dashboard -> SQL Editor: paste this whole file and Run.
-- Run it after schema.sql and 002_roles.sql (it uses app_role()).

-- 1. Extra details collected at admission
alter table students
  add column if not exists admission_date date,
  add column if not exists father_name text,
  add column if not exists mother_name text,
  add column if not exists guardian_email text,
  add column if not exists alternate_phone text,
  add column if not exists blood_group text,
  add column if not exists previous_school text,
  add column if not exists id_proof_type text,
  add column if not exists id_proof_number text,
  add column if not exists photo_path text,
  add column if not exists id_proof_path text;

-- 2. Private storage bucket for photos and ID proofs (5 MB per file, images and PDF only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-files', 'student-files', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 3. Who can touch the files
--    admin: everything (photos/ and id-proofs/)
--    accountant and teacher: can only view photos/, never ID proofs
drop policy if exists "student files admin all" on storage.objects;
create policy "student files admin all" on storage.objects
  for all to authenticated
  using (bucket_id = 'student-files' and public.app_role() = 'admin')
  with check (bucket_id = 'student-files' and public.app_role() = 'admin');

drop policy if exists "student photos staff read" on storage.objects;
create policy "student photos staff read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'student-files'
    and (storage.foldername(name))[1] = 'photos'
    and public.app_role() in ('accountant', 'teacher')
  );
