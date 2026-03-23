-- Role mirror curated pool: track per-user LRU selections for bilingual mirror templates.

create table if not exists public.role_mirror_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pool_entry_id text not null,
  origin_flag_type text not null,
  selected_at timestamptz not null default now()
);

comment on table public.role_mirror_history is
  'Selections from ROLE_MIRROR_POOL for LRU; one row per getRoleMirrorScenario persist.';

create index if not exists role_mirror_history_user_pool_selected_idx
  on public.role_mirror_history (user_id, pool_entry_id, selected_at desc);

create index if not exists role_mirror_history_user_selected_idx
  on public.role_mirror_history (user_id, selected_at desc);

alter table public.role_mirror_history enable row level security;

drop policy if exists "role_mirror_history_select_own" on public.role_mirror_history;
create policy "role_mirror_history_select_own"
  on public.role_mirror_history for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "role_mirror_history_insert_own" on public.role_mirror_history;
create policy "role_mirror_history_insert_own"
  on public.role_mirror_history for insert to authenticated
  with check (auth.uid() = user_id);
