-- Perspective-switch pool usage (LRU / POV rotation) for Arena.

create table if not exists public.perspective_switch_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pool_entry_id text not null,
  pov text not null
    check (pov in ('subordinate', 'peer', 'client', 'observer')),
  used_at timestamptz not null default now()
);

-- Backfill missing columns if table already existed in an older shape
alter table public.perspective_switch_history
  add column if not exists pool_entry_id text,
  add column if not exists pov text,
  add column if not exists used_at timestamptz not null default now();

comment on table public.perspective_switch_history is
  'Rows when a perspective-switch pool scenario was served; drives LRU + POV rotation.';

create index if not exists perspective_switch_history_user_used_idx
  on public.perspective_switch_history (user_id, used_at desc);

create index if not exists perspective_switch_history_user_pool_idx
  on public.perspective_switch_history (user_id, pool_entry_id, used_at desc);

alter table public.perspective_switch_history enable row level security;

drop policy if exists "perspective_switch_history_select_own" on public.perspective_switch_history;
create policy "perspective_switch_history_select_own"
on public.perspective_switch_history for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "perspective_switch_history_insert_own" on public.perspective_switch_history;
create policy "perspective_switch_history_insert_own"
on public.perspective_switch_history for insert
to authenticated
with check (auth.uid() = user_id);