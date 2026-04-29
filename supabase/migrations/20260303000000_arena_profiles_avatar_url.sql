-- Phase 3-3: User avatar URL on arena_profiles (Ready Player Me or any provider)
-- Store 2D avatar image URL; UI shows fallback when null.

alter table public.arena_profiles
  add column if not exists avatar_url text null;

comment on column public.arena_profiles.avatar_url is 'User avatar image URL (e.g. Ready Player Me 2D render). Null = use fallback (initials or default icon).';
