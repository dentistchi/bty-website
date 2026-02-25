-- Season end: 10% Seasonal XP carryover (BTY_ARENA_SYSTEM_SPEC).
-- Call when a new league/season is about to start. Updates all weekly_xp rows (league_id IS NULL) to 10% of current total.

create or replace function public.run_season_carryover()
returns void
language sql
security definer
set search_path = public
as $$
  update public.weekly_xp
  set xp_total = floor(greatest(0, xp_total) * 0.1)
  where league_id is null;
$$;

comment on function public.run_season_carryover is 'BTY Arena: at season end, set Seasonal XP to 10% of current (weekly_xp where league_id is null). Call before creating a new league.';
