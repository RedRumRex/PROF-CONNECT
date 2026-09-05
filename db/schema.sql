-- ============================================================
-- ProfConnect — Supabase schema
-- Run in Supabase SQL Editor.
--
-- This drops the manually-created `student` table and recreates
-- it here in code (same fields as before), then adds `teacher`,
-- `appointment`, `student_auth`, `teacher_auth`.
-- ============================================================

-- ── student ────────────────────────────────────────────────
-- Drops your manually-created table and any dependents, then
-- recreates it with the same fields you had:
--   rollno int8 PK, name varchar, phone_no int8, branch varchar,
--   email varchar, year int4
drop table if exists public.student cascade;

create table public.student (
  rollno    bigint primary key,
  name      varchar,
  phone_no  bigint,
  branch    varchar,
  email     varchar,
  year      integer
);

-- ── teacher ────────────────────────────────────────────────
create table public.teacher (
  teacher_id   bigint primary key,
  name         varchar,
  room_number  varchar not null,
  department   varchar not null,
  designation  varchar not null,
  h_index      bigint not null
);

-- ── appointment ────────────────────────────────────────────
-- status is nullable: NULL = pending request, true = scheduled,
-- false = declined by teacher. This matches the 3-state
-- pending/accept/decline flow already built in Dashboard.jsx.
-- (Strictly-boolean-not-null was requested; flagging this deviation —
-- happy to switch to `not null default false` if you'd rather.)
create table public.appointment (
  appointment_id   bigint generated always as identity primary key,
  student_id       bigint not null references public.student(rollno) on delete cascade,
  teacher_id       bigint not null references public.teacher(teacher_id) on delete cascade,
  appointment_date date not null,
  appointment_time time not null,
  status           boolean,
  created_at       timestamptz not null default now()
);

create index idx_appointment_student on public.appointment(student_id);
create index idx_appointment_teacher on public.appointment(teacher_id);

-- ── student_auth ───────────────────────────────────────────
-- 1:1 with student, keyed off the existing rollno PK.
create table public.student_auth (
  rollno         bigint primary key references public.student(rollno) on delete cascade,
  password_hash  text not null,
  created_at     timestamptz not null default now(),
  last_login_at  timestamptz
);

-- ── teacher_auth ───────────────────────────────────────────
-- 1:1 with teacher. email lives here (login identifier) since
-- teacher has no email column of its own.
create table public.teacher_auth (
  teacher_id     bigint primary key references public.teacher(teacher_id) on delete cascade,
  email          varchar not null unique,
  password_hash  text not null,
  created_at     timestamptz not null default now(),
  last_login_at  timestamptz
);

-- ── message ────────────────────────────────────────────────
-- Added later — added on its own with `if not exists` so it's
-- safe to run by itself against the tables above, which already
-- exist in your live project (re-running the whole file from the
-- top would fail on `create table public.teacher` etc. since
-- those aren't idempotent). Just select and run this block.
--
-- One thread per (student, teacher) pair — backs both the
-- student's chat on the booking page and the teacher's "Message"
-- button on each appointment request in the Dashboard.
create table if not exists public.message (
  message_id   bigint generated always as identity primary key,
  student_id   bigint not null references public.student(rollno) on delete cascade,
  teacher_id   bigint not null references public.teacher(teacher_id) on delete cascade,
  sender_role  text not null check (sender_role in ('student', 'teacher')),
  body         text not null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_message_thread on public.message(student_id, teacher_id, created_at);

-- ── notification ───────────────────────────────────────────
-- Added later — same deal as `message` above: `if not exists`, safe
-- to run standalone against your existing live tables. Backs the
-- notification bell in the navbar — a row is created whenever a
-- student books a session, a teacher accepts/declines a request, or
-- either side sends a message.
--
-- recipient_role + recipient_id together identify who it's for (a
-- student's rollno or a teacher's teacher_id). There's no single FK
-- here since which table recipient_id points at depends on
-- recipient_role.
create table if not exists public.notification (
  notification_id bigint generated always as identity primary key,
  recipient_role   text not null check (recipient_role in ('student', 'teacher')),
  recipient_id     bigint not null,
  type             text not null,
  title            text not null,
  body             text,
  link             text,
  read             boolean not null default false,
  created_at       timestamptz not null default now()
);

create index if not exists idx_notification_recipient on public.notification(recipient_role, recipient_id, created_at desc);

-- ── teacher availability persistence ────────────────────────────────────
-- Added later — same deal as `message`/`notification` above: safe to run
-- standalone against a project that already has `teacher` populated.
--
-- "Available in Room" used to live only in server/app/availability_store.py
-- as an in-memory dict, so a professor's status reset to "away" on every
-- backend restart. These two columns make it durable; availability_store.py
-- now reads/writes them instead of the in-memory map.
alter table public.teacher add column if not exists available boolean not null default false;
alter table public.teacher add column if not exists available_updated_at timestamptz;

-- ── timetable_entry ────────────────────────────────────────────────────
-- Added later — same deal as the blocks above: `if not exists`, safe to
-- run standalone against a project that already has `student`/`teacher`
-- populated.
--
-- One row per class in a signed-in user's personal weekly timetable
-- (either role can upload one — see server/app/timetable_parser.py for the
-- CSV format this backs, and README.md's "Timetable" section for the
-- user-facing spec). owner_role + owner_id together identify whose
-- timetable this is (a student's rollno or a teacher's teacher_id) — same
-- pattern as notification's recipient_role/recipient_id, since which
-- table owner_id points at depends on owner_role.
create table if not exists public.timetable_entry (
  entry_id     bigint generated always as identity primary key,
  owner_role   text not null check (owner_role in ('student', 'teacher')),
  owner_id     bigint not null,
  day_of_week  text not null check (day_of_week in ('Mon', 'Tue', 'Wed', 'Thu', 'Fri')),
  start_time   time not null,
  end_time     time not null,
  subject      text not null,
  room         text,
  instructor   text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_timetable_owner on public.timetable_entry(owner_role, owner_id, day_of_week, start_time);

-- ── timetable class type (lecture / tutorial / lab) ─────────────────────
-- Added later — same deal as the blocks above: an idempotent `alter table
-- ... add column if not exists`, safe to run standalone even if
-- `timetable_entry` already has rows in it (they all default to 'lecture').
--
-- Lets the grid color-code by class *kind* rather than by subject — see
-- README.md's "Timetable" section and src/components/TimetableGrid.jsx.
alter table public.timetable_entry
  add column if not exists class_type text not null default 'lecture'
    check (class_type in ('lecture', 'tutorial', 'lab'));

-- ── profile photo ────────────────────────────────────────────────────────
-- Added later — idempotent `alter table ... add column if not exists`,
-- safe to run standalone against a project with existing student/teacher
-- rows (they all default to null, i.e. "no photo uploaded yet" — the
-- frontend falls back to a generated placeholder avatar in that case, see
-- src/lib/profile.js).
--
-- Holds the public URL of whatever's in the `avatars` Storage bucket for
-- that user, not the image bytes themselves — see server/app/routers/
-- profile_photo.py and README.md's "Profile photo" section for the upload
-- flow and the Storage bucket this depends on (created via the Supabase
-- Dashboard or the SQL further down this block, not this file's tables).
alter table public.student add column if not exists avatar_url text;
alter table public.teacher add column if not exists avatar_url text;

-- The bucket itself: a Storage bucket is just a row in `storage.buckets`,
-- so it can be created here too rather than through the Dashboard UI.
-- `public = true` means uploaded photos are served directly over HTTPS
-- with no auth needed to *view* them (uploads still require a valid JWT —
-- see profile_photo.py — since the backend uses the service-role key,
-- which bypasses Storage's row-level security entirely). Re-running this
-- is safe: `on conflict` just refreshes the size/type limits.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/png', 'image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
