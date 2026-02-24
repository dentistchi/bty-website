-- B-MVP: 30-day league window for Season XP / Leaderboard
-- Active league = one where now() between start_at and end_at.

alter table public.arena_leagues
  add column if not exists start_at timestamptz null,
  add column if not exists end_at timestamptz null;

comment on column public.arena_leagues.start_at is 'League window start (inclusive).';
comment on column public.arena_leagues.end_at is 'League window end (inclusive).';

create index if not exists arena_leagues_window_idx
  on public.arena_leagues(start_at, end_at)
  where start_at is not null and end_at is not null;

-- Leaderboard: allow authenticated users to read all weekly_xp rows (for active league ranking)
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'weekly_xp') then
    drop policy if exists "weekly_xp_select_leaderboard" on public.weekly_xp;
    create policy "weekly_xp_select_leaderboard"
      on public.weekly_xp for select to authenticated using (true);
  end if;
end $$;
