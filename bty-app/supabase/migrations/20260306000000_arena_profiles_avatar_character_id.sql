-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- Track C: arena_profiles.avatar_character_id — 선택한 캐릭터 id (게임 스타일)

alter table public.arena_profiles
  add column if not exists avatar_character_id text null;

comment on column public.arena_profiles.avatar_character_id is '선택한 캐릭터 id (게임 스타일). null이면 캐릭터 미선택.';
