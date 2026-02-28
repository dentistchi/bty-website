-- weekly_xp: allow authenticated users to INSERT/UPDATE their own row (league_id NULL).
-- Required for POST /api/arena/run/complete and POST /api/arena/beginner-complete to write
-- seasonal XP so the user appears on the leaderboard.
-- See docs/supabase/001_weekly_xp.sql for the same policies; this migration ensures they
-- exist when only the numbered migrations were applied (e.g. table created elsewhere).

do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'weekly_xp') then
    -- INSERT: own user_id only
    drop policy if exists "weekly_xp_insert_own" on public.weekly_xp;
    create policy "weekly_xp_insert_own"
      on public.weekly_xp for insert to authenticated
      with check (user_id = auth.uid());

    -- UPDATE: own row only
    drop policy if exists "weekly_xp_update_own" on public.weekly_xp;
    create policy "weekly_xp_update_own"
      on public.weekly_xp for update to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;
