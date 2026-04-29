-- Certified Leader: granted when LRI `promotion_ready`; 90d window; daily cron marks EXPIRED.

create table if not exists public.certified_leader_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'EXPIRED')),
  created_at timestamptz not null default now()
);

comment on table public.certified_leader_grants is
  'Certified Leader grant window. At most one ACTIVE row per user; cron sets EXPIRED after expires_at.';

create unique index if not exists certified_leader_grants_one_active_per_user
  on public.certified_leader_grants (user_id)
  where status = 'ACTIVE';

create index if not exists certified_leader_grants_expires_active_idx
  on public.certified_leader_grants (expires_at)
  where status = 'ACTIVE';

alter table public.certified_leader_grants enable row level security;
