-- ProfConnect meeting metadata. Run after the existing db/schema.sql.
-- Appointment meetings are unique per appointment; invitation tokens are
-- stored only as hashes. The service-role key must remain backend-only.
create table if not exists public.meeting (
  meeting_id text primary key,
  appointment_id bigint not null unique
    references public.appointment(appointment_id) on delete cascade,
  host_teacher_id bigint not null
    references public.teacher(teacher_id) on delete cascade,
  created_by_role text not null check (created_by_role in ('student', 'teacher')),
  created_by_id bigint not null,
  status text not null default 'available'
    check (status in ('available', 'active', 'ended', 'cancelled')),
  invite_token_hash text unique,
  invite_enabled boolean not null default false,
  passcode_hash text not null default '',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

create index if not exists idx_meeting_appointment on public.meeting(appointment_id);
create index if not exists idx_meeting_host on public.meeting(host_teacher_id);
