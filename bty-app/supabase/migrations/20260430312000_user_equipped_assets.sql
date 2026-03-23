-- Row-level equipped cosmetics for Realtime (complements user_avatar_state.equipped_asset_ids).

create table if not exists public.user_equipped_assets (
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, asset_id)
);

comment on table public.user_equipped_assets is
  'Equipped cosmetic asset ids; synced from POST /api/bty/avatar/equip; Realtime for AvatarComposite.';

create index if not exists user_equipped_assets_user_idx on public.user_equipped_assets (user_id);

alter table public.user_equipped_assets enable row level security;

drop policy if exists "user_equipped_assets_select_own" on public.user_equipped_assets;
create policy "user_equipped_assets_select_own"
on public.user_equipped_assets for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_equipped_assets_insert_own" on public.user_equipped_assets;
create policy "user_equipped_assets_insert_own"
on public.user_equipped_assets for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_equipped_assets_delete_own" on public.user_equipped_assets;
create policy "user_equipped_assets_delete_own"
on public.user_equipped_assets for delete
to authenticated
using (auth.uid() = user_id);

alter publication supabase_realtime add table only public.user_equipped_assets;
