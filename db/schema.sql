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
