-- Realtime for weekly_xp so leaderboard UIs can refresh on XP changes (global pool rows).
do $$
begin
  alter publication supabase_realtime add table only public.weekly_xp;
exception
  when duplicate_object then null;
end $$;
