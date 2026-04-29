-- Elite Spec: mentor-nominated path when promotion readiness crosses threshold (see elite-spec-flow).

create table if not exists public.elite_spec_nominations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nominated_at timestamptz not null default now(),
  readiness_score numeric not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  mentor_approved_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.elite_spec_nominations is
  'Elite Spec mentor nomination queue; APPROVED rows pair with certified_leader_grants insert.';

create unique index if not exists elite_spec_nominations_one_pending_per_user
  on public.elite_spec_nominations (user_id)
  where status = 'PENDING';

create index if not exists elite_spec_nominations_user_status_idx
  on public.elite_spec_nominations (user_id, status);

alter table public.elite_spec_nominations enable row level security;
