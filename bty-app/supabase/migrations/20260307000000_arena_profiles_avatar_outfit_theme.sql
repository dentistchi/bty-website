-- Track D2: Outfit theme (professional / fantasy) on arena_profiles.
-- null = use default (professional). Used with getOutfitForLevel(theme, maxUnlockedLevel) for avatar URL.

alter table public.arena_profiles
  add column if not exists avatar_outfit_theme text null;

comment on column public.arena_profiles.avatar_outfit_theme is 'Outfit theme for level-based avatar skin: professional | fantasy. Null = default (professional).';
