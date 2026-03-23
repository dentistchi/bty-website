-- LE integrity slip audit + Arena account lockout (AIR monitor / engine)

create table if not exists public.integrity_slip_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  previous_air numeric,
  new_air numeric,
  air_delta numeric,
  created_at timestamptz not null default now()
);

create index if not exists integrity_slip_log_user_created_idx
  on public.integrity_slip_log (user_id, created_at desc);

comment on table public.integrity_slip_log is 'Integrity slip / lockout reasons (service role writes).';

alter table public.arena_profiles
  add column if not exists account_status text not null default 'ACTIVE'
    check (account_status in ('ACTIVE', 'LOCKED'));

alter table public.arena_profiles
  add column if not exists lockout_start timestamptz;

comment on column public.arena_profiles.account_status is 'ACTIVE | LOCKED (AIR integrity lockout).';
comment on column public.arena_profiles.lockout_start is 'When LOCKED; null if ACTIVE.';

alter table public.integrity_slip_log enable row level security;
