-- Optional outfit multiply tint per unlocked asset (hex stored; UI resolves to rgba in engine).

alter table public.user_avatar_assets
  add column if not exists tint_color text;

comment on column public.user_avatar_assets.tint_color is
  'Optional #RRGGBB outfit layer tint override; null = engine default (outfitTintForAssetId).';

drop policy if exists "user_avatar_assets_update_own" on public.user_avatar_assets;
create policy "user_avatar_assets_update_own"
on public.user_avatar_assets for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
