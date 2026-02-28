-- =============================================================================
-- BTY Arena: League system, weekly (seasonal) XP, season resets, duplicate prevention
-- Design: docs/ARENA_DB_SCHEMA.md
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) arena_seasons — single source of truth for season lifecycle
-- -----------------------------------------------------------------------------
create table if not exists public.arena_seasons (
  season_id uuid primary key default gen_random_uuid(),
  season_number int not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now()
);

comment on table public.arena_seasons is 'BTY Arena season lifecycle. One row per season; run_season_carryover() when ending.';
comment on column public.arena_seasons.season_number is 'Monotonically increasing season index (1, 2, 3, …).';
comment on column public.arena_seasons.start_at is 'Season start (inclusive).';
comment on column public.arena_seasons.end_at is 'Season end (inclusive).';
comment on column public.arena_seasons.status is 'active = current season; ended = carryover applied, next season created.';

create unique index if not exists arena_seasons_number_uq on public.arena_seasons(season_number);
create index if not exists arena_seasons_status_idx on public.arena_seasons(status) where status = 'active';

-- -----------------------------------------------------------------------------
-- 2) arena_leagues — link to season, status, keep existing window columns
-- -----------------------------------------------------------------------------
alter table public.arena_leagues
  add column if not exists season_id uuid references public.arena_seasons(season_id) on delete set null,
  add column if not exists status text null;

comment on column public.arena_leagues.season_id is 'League belongs to this season. NULL for legacy leagues.';
comment on column public.arena_leagues.name is 'Display name of the league.';
comment on column public.arena_leagues.min_lifetime_xp is 'Minimum Core XP (or legacy lifetime_xp) to qualify for this league.';
comment on column public.arena_leagues.status is 'active = visible for ranking; closed = season ended.';
comment on table public.arena_leagues is 'League definition per season. start_at/end_at = ranking window; status controls visibility.';

-- Allow status check once column exists (idempotent)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'arena_leagues' and column_name = 'status'
  ) then
    alter table public.arena_leagues drop constraint if exists arena_leagues_status_check;
    alter table public.arena_leagues add constraint arena_leagues_status_check
      check (status is null or status in ('active', 'closed'));
  end if;
end $$;

create index if not exists arena_leagues_season_id_idx on public.arena_leagues(season_id) where season_id is not null;
create index if not exists arena_leagues_status_idx on public.arena_leagues(status) where status = 'active';

-- -----------------------------------------------------------------------------
-- 3) weekly_xp — comments and indexes for leaderboard / duplicate prevention
--    Requires weekly_xp to exist (e.g. from docs/supabase/001_weekly_xp.sql or ONE_BLOCK).
-- -----------------------------------------------------------------------------
comment on table public.weekly_xp is 'Seasonal (competition) XP per user per league. One row per (user_id, league_id); prevents duplicate league entries. Leaderboard reads from here only.';
comment on column public.weekly_xp.user_id is 'References auth.users. One row per user when league_id IS NULL (global pool).';
comment on column public.weekly_xp.league_id is 'NULL = global/current pool; non-NULL = this league. Unique with user_id to prevent duplicate entries.';
comment on column public.weekly_xp.xp_total is 'Seasonal XP total for this user in this league. Reset/carryover at season end.';

-- Prevent duplicate league entries: one row per (user_id, league_id)
create unique index if not exists weekly_xp_user_null_league_uq on public.weekly_xp(user_id) where league_id is null;
create unique index if not exists weekly_xp_user_league_uq on public.weekly_xp(user_id, league_id) where league_id is not null;

-- Leaderboard: top N by league
create index if not exists weekly_xp_league_xp_desc_idx on public.weekly_xp(league_id, xp_total desc) where league_id is not null;

-- Lookup: user's row for a league
create index if not exists weekly_xp_user_league_idx on public.weekly_xp(user_id, league_id);

-- -----------------------------------------------------------------------------
-- 4) arena_profiles — comments only (Core XP lives here; no structural change)
-- -----------------------------------------------------------------------------
comment on table public.arena_profiles is 'One per user. Core XP is permanent; league_id is display-only, not used for leaderboard.';
comment on column public.arena_profiles.league_id is 'Display/current league only. Leaderboard ranking comes from weekly_xp, not this.';

-- -----------------------------------------------------------------------------
-- 5) RLS for arena_seasons (read-only for authenticated)
-- -----------------------------------------------------------------------------
alter table public.arena_seasons enable row level security;

drop policy if exists "arena_seasons_select_all" on public.arena_seasons;
create policy "arena_seasons_select_all"
  on public.arena_seasons for select to authenticated using (true);
