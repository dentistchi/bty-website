-- Per-asset unlock history (tier threshold grants). Complements user_avatar_state.unlocked_assets array.

create table if not exists public.user_avatar_assets (
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, asset_id)
);

comment on table public.user_avatar_assets is
  'Rows inserted when user crosses avatar tier thresholds; asset_id matches ASSET_UNLOCK_MAP tier grants.';

create index if not exists user_avatar_assets_user_unlocked_at_idx
  on public.user_avatar_assets (user_id, unlocked_at);

alter table public.user_avatar_assets enable row level security;

drop policy if exists "user_avatar_assets_select_own" on public.user_avatar_assets;
create policy "user_avatar_assets_select_own"
on public.user_avatar_assets for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_avatar_assets_insert_own" on public.user_avatar_assets;
create policy "user_avatar_assets_insert_own"
on public.user_avatar_assets for insert
to authenticated
with check (auth.uid() = user_id);
