-- Arena ejection: suspend play until Center lift; audit log.

alter table public.arena_profiles
  add column if not exists arena_status text not null default 'ACTIVE'
  check (arena_status in ('ACTIVE', 'EJECTED'));

comment on column public.arena_profiles.arena_status is 'ACTIVE | EJECTED — Arena scenario access blocked until lift (see arena_ejection_log + Center phase gates).';

create table if not exists public.arena_ejection_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null,
  ejected_at timestamptz not null default now()
);

create index if not exists arena_ejection_log_user_ejected_idx
  on public.arena_ejection_log (user_id, ejected_at desc);

comment on table public.arena_ejection_log is
  'BTY Arena ejection audit (AIR below threshold / consecutive INTEGRITY_SLIP). Service role writes.';

alter table public.arena_ejection_log enable row level security;
