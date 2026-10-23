-- Performance indexes (migration 010)
-- Supabase Dashboard -> SQL Editor: paste this whole file and Run. Safe to run more than once, and it does not change any data.
-- Speeds up searching students, filtering lists and the fee, payment and marks pages as the data grows.

-- Fast "contains" search on names, admission numbers and phone numbers (used by the search boxes).
create extension if not exists pg_trgm with schema extensions;
create index if not exists students_name_trgm on students using gin (full_name extensions.gin_trgm_ops);
create index if not exists students_admission_trgm on students using gin (admission_no extensions.gin_trgm_ops);
create index if not exists students_phone_trgm on students using gin (guardian_phone extensions.gin_trgm_ops);

-- Lists filtered by class and status, and sorted by name.
create index if not exists students_class_status_idx on students(class_id, status);
create index if not exists students_status_name_idx on students(status, full_name);

-- Fees and payments pages.
create index if not exists fees_due_date_idx on fees(due_date);
create index if not exists payments_created_idx on payments(created_at desc);
create index if not exists payments_paid_on_idx on payments(paid_on);

-- Exam results.
create index if not exists marks_exam_subject_idx on marks(exam_id, subject_id);
create index if not exists marks_exam_student_idx on marks(exam_id, student_id);

-- Timetable by teacher (only if migration 007 has been run).
do $$
begin
  if to_regclass('public.timetable_slots') is not null then
    execute 'create index if not exists timetable_slots_teacher_idx on timetable_slots(teacher_id)';
  end if;
end $$;
