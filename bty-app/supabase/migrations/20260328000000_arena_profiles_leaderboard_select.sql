-- Leaderboard: allow authenticated users to read all arena_profiles for display (avatar, code name, tier).
-- Without this, anon client only sees own row (profiles_select_own) so other users show default avatar.
-- Service role bypasses RLS; this policy makes leaderboard work when API uses anon/authenticated client.

drop policy if exists "profiles_select_leaderboard" on public.arena_profiles;
create policy "profiles_select_leaderboard"
on public.arena_profiles for select
to authenticated
using (true);

comment on policy "profiles_select_leaderboard" on public.arena_profiles is
  'Allow any authenticated user to read all profiles for leaderboard display (avatar, code name, XP).';
