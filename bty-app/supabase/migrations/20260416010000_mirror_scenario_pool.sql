-- Queue for mirror / follow-up scenarios when session AIR declines (Arena → Foundry bridge).

create table if not exists public.mirror_scenario_pool (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_type text not null,
  air_delta double precision not null,
  source text not null default 'arena_session_end',
  created_at timestamptz not null default now()
);

comment on table public.mirror_scenario_pool is 'Arena session outcomes: AIR decline → queued mirror scenario follow-up.';

create index if not exists mirror_scenario_pool_user_created_idx
  on public.mirror_scenario_pool(user_id, created_at desc);

alter table public.mirror_scenario_pool enable row level security;

drop policy if exists "mirror_scenario_pool_select_own" on public.mirror_scenario_pool;
create policy "mirror_scenario_pool_select_own"
on public.mirror_scenario_pool for select
to authenticated
using (auth.uid() = user_id);
