-- Arena 아바타·코드네임 마이그레이션 3개 일괄 적용
-- 실행: Supabase Dashboard > SQL Editor에서 붙여넣기 후 Run
-- 또는: psql "$DATABASE_URL" -f scripts/apply-arena-avatar-migrations.sql

-- 1) 20260309000000_arena_profiles_avatar_character_locked
alter table public.arena_profiles
  add column if not exists avatar_character_locked boolean not null default false;
comment on column public.arena_profiles.avatar_character_locked is 'True after first avatar character save; character cannot be changed, only outfit theme. Reset on code evolution.';

-- 2) 20260310000000_arena_profiles_sub_name_renamed_at_code_index
alter table public.arena_profiles
  add column if not exists sub_name_renamed_at_code_index smallint null;
comment on column public.arena_profiles.sub_name_renamed_at_code_index is 'Code index (0-5) at which user last used the one-time sub-name rename. Next code allows one more rename at tier 25+.';
update public.arena_profiles
set sub_name_renamed_at_code_index = least(6, greatest(0, code_index))
where sub_name_renamed_in_code = true and sub_name_renamed_at_code_index is null;

-- 3) 20260311000000_arena_profiles_avatar_selected_outfit_id
alter table public.arena_profiles
  add column if not exists avatar_selected_outfit_id text null;
comment on column public.arena_profiles.avatar_selected_outfit_id is 'User-selected outfit id within current theme (e.g. figs_scrub, adventurer). Null = use level-based default.';
