-- 캐릭터 고정+옷 선택: 유저가 선택한 옷(테마 내 outfit id). null이면 레벨 기본값 사용.
alter table public.arena_profiles
  add column if not exists avatar_selected_outfit_id text null;

comment on column public.arena_profiles.avatar_selected_outfit_id is 'User-selected outfit id within current theme (e.g. figs_scrub, adventurer). Null = use level-based default.';
