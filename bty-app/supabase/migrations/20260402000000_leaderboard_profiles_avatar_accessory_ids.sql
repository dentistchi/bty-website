-- AVATAR_LAYER_SPEC §4: 리더보드 행에 아바타 키(accessoryKeys) 포함. get_leaderboard_profiles에 avatar_accessory_ids 추가.

create or replace function public.get_leaderboard_profiles(p_user_ids uuid[])
returns table (
  user_id uuid,
  core_xp_total integer,
  code_index integer,
  sub_name text,
  avatar_url text,
  avatar_character_id text,
  avatar_outfit_theme text,
  avatar_selected_outfit_id text,
  avatar_accessory_ids text[]
)
language sql
security definer
set search_path = public
stable
as $$
  select
    ap.user_id,
    ap.core_xp_total,
    ap.code_index,
    ap.sub_name,
    ap.avatar_url,
    ap.avatar_character_id,
    ap.avatar_outfit_theme,
    ap.avatar_selected_outfit_id,
    coalesce(ap.avatar_accessory_ids, '{}'::text[])
  from public.arena_profiles ap
  where ap.user_id = any(p_user_ids);
$$;

comment on function public.get_leaderboard_profiles(uuid[]) is
  'Returns profile rows for given user IDs for leaderboard display. SECURITY DEFINER. Includes avatar keys (avatar_accessory_ids) for §4 composite.';

revoke all on function public.get_leaderboard_profiles(uuid[]) from public;
grant execute on function public.get_leaderboard_profiles(uuid[]) to authenticated;
grant execute on function public.get_leaderboard_profiles(uuid[]) to service_role;
