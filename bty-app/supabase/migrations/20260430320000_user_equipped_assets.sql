-- Per-slot equipped cosmetics (z_index 0..4 aligned with OUTFIT_MANIFEST layers).

create table if not exists public.user_equipped_assets (
  user_id uuid not null references auth.users (id) on delete cascade,
  slot_index smallint not null check (slot_index >= 0 and slot_index <= 4),
  asset_id text not null,
  equipped_at timestamptz not null default now(),
  primary key (user_id, slot_index)
);

comment on table public.user_equipped_assets is
  'Equipped avatar layer per z_index; engine/avatar-equipped-state.service.ts';

create index if not exists user_equipped_assets_user_idx
  on public.user_equipped_assets (user_id);

alter table public.user_equipped_assets enable row level security;

drop policy if exists "user_equipped_assets_select_own" on public.user_equipped_assets;
create policy "user_equipped_assets_select_own"
  on public.user_equipped_assets for select to authenticated
  using (auth.uid() = user_id);
