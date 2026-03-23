-- Equipped cosmetic selection for avatar outfit panel (POST /api/bty/avatar/equip).

alter table public.user_avatar_state
  add column if not exists equipped_asset_ids text[] not null default '{}'::text[];

comment on column public.user_avatar_state.equipped_asset_ids is
  'Subset of unlocked_assets the user has chosen to display; triggers Realtime refresh with unlocked_assets.';
