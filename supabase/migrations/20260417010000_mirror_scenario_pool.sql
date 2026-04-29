-- Perspective switch: mirrored Arena scenarios (user plays opposing role).

create table if not exists public.mirror_scenario_pool (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  origin_scenario_id text not null,
  target_role text not null,
  mirror_title text not null,
  mirror_context text not null,
  created_at timestamptz not null default now()
);

-- Backfill missing columns if table already existed in an older shape
alter table public.mirror_scenario_pool
  add column if not exists origin_scenario_id text,
  add column if not exists target_role text,
  add column if not exists mirror_title text,
  add column if not exists mirror_context text,
  add column if not exists created_at timestamptz not null default now();

comment on table public.mirror_scenario_pool is 'Mirrored Arena scenarios derived from recent CHOICE_CONFIRMED events; target_role is the role the user plays in the mirror.';
comment on column public.mirror_scenario_pool.origin_scenario_id is 'Source Arena scenario id (e.g. from arena_events.scenario_id).';
comment on column public.mirror_scenario_pool.target_role is 'Stable role key for the opposing POV (e.g. patient, hygienist, manager).';

create unique index if not exists mirror_scenario_pool_user_origin_unique
  on public.mirror_scenario_pool (user_id, origin_scenario_id);

create index if not exists mirror_scenario_pool_user_created_idx
  on public.mirror_scenario_pool (user_id, created_at desc);

alter table public.mirror_scenario_pool enable row level security;

drop policy if exists "mirror_scenario_pool_select_own" on public.mirror_scenario_pool;
create policy "mirror_scenario_pool_select_own"
on public.mirror_scenario_pool for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "mirror_scenario_pool_insert_own" on public.mirror_scenario_pool;
create policy "mirror_scenario_pool_insert_own"
on public.mirror_scenario_pool for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "mirror_scenario_pool_update_own" on public.mirror_scenario_pool;
create policy "mirror_scenario_pool_update_own"
on public.mirror_scenario_pool for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "mirror_scenario_pool_delete_own" on public.mirror_scenario_pool;
create policy "mirror_scenario_pool_delete_own"
on public.mirror_scenario_pool for delete
to authenticated
using (auth.uid() = user_id);