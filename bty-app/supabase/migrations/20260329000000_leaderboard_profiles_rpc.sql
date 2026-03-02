-- Leaderboard: RLS 없이 지정 user_id 목록의 arena_profiles를 읽기 위한 함수.
-- API가 service role 없이 호출해도 타 유저 프로필(아바타 등)을 가져올 수 있음.

create or replace function public.get_leaderboard_profiles(p_user_ids uuid[])
returns table (
  user_id uuid,
  core_xp_total integer,
  code_index integer,
  sub_name text,
  avatar_url text,
  avatar_character_id text,
  avatar_outfit_theme text
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
    ap.avatar_outfit_theme
  from public.arena_profiles ap
  where ap.user_id = any(p_user_ids);
$$;

comment on function public.get_leaderboard_profiles(uuid[]) is
  'Returns profile rows for given user IDs for leaderboard display. SECURITY DEFINER so RLS does not restrict to current user.';

revoke all on function public.get_leaderboard_profiles(uuid[]) from public;
grant execute on function public.get_leaderboard_profiles(uuid[]) to authenticated;
grant execute on function public.get_leaderboard_profiles(uuid[]) to service_role;
