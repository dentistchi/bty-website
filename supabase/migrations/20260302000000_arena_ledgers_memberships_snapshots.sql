-- =============================================================================
-- BTY Arena: Immutable ledgers, league_memberships, optional snapshots & season_state
-- DATA ENGINEER design. Core XP history separate from Weekly XP history.
-- Weekly reset must not destroy Core XP. No season reset logic as DB triggers.
-- =============================================================================
--
-- 1) ASSUMPTIONS
-- --------------
-- - arena_profiles, arena_leagues, arena_seasons, weekly_xp already exist.
-- - weekly_xp: one row per (user_id, league_id) with league_id NULL = global pool; xp_total = current balance.
-- - auth.users(id) is the canonical user reference.
-- - Reset boundary: weekly (e.g. Sunday 00:00 UTC); app computes boundary; snapshots store week_end_at.
-- - XP source identifiers (e.g. run_id, quest_claim_id) are used for idempotency; same source_id never applied twice.
-- - League membership is created when app inserts first weekly_xp row for (user_id, league_id); this migration adds explicit league_memberships table for joins and joined_at.
--
-- 2) ERD-ISH SCHEMA (tables + columns)
-- ------------------------------------
-- arena_profiles (existing)
--   - user_id PK, core_xp_total, core_xp_buffer, tier, code_index, sub_name, stage, code_name, league_id (display only), lifetime_xp, weekly_xp (denorm), ...
--
-- arena_leagues (existing)
--   - league_id PK, season_id FK, name, min_lifetime_xp, start_at, end_at, status, created_at
--
-- arena_seasons (existing)
--   - season_id PK, season_number, start_at, end_at, status, created_at
--
-- weekly_xp (existing)
--   - id, user_id, league_id (nullable), xp_total, updated_at, created_at
--
-- league_memberships (NEW)
--   - user_id, league_id, joined_at — PK (user_id, league_id). One row per user per league.
--
-- core_xp_ledger (NEW) — immutable Core XP events only
--   - id bigserial PK, user_id FK, delta_xp int, source_type text, source_id text null, created_at
--   - UNIQUE (source_type, source_id) WHERE source_id IS NOT NULL to prevent double-apply
--
-- weekly_xp_ledger (NEW) — immutable Weekly XP events only
--   - id bigserial PK, user_id FK, league_id uuid null, delta_xp int, source_type text, source_id text null, created_at
--   - UNIQUE (user_id, league_id, source_type, source_id) WHERE source_id IS NOT NULL (per user/league idempotency)
--
-- weekly_leaderboard_snapshots (OPTIONAL)
--   - id bigserial PK, league_id FK, user_id FK, rank int, xp_total int, week_end_at timestamptz, created_at
--   - UNIQUE (league_id, user_id, week_end_at) — one snapshot row per user per league per week boundary
--
-- arena_season_state (OPTIONAL) — per-user per-season state
--   - user_id FK, season_id FK, meta jsonb null, created_at, updated_at
--   - UNIQUE (user_id, season_id)
--
-- 3) MIGRATION SQL
-- =============================================================================

-- -----------------------------------------------------------------------------
-- core_xp_ledger — immutable Core XP history (never reset by weekly/season)
-- -----------------------------------------------------------------------------
create table if not exists public.core_xp_ledger (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta_xp int not null,
  source_type text not null,
  source_id text null,
  created_at timestamptz not null default now()
);

comment on table public.core_xp_ledger is 'Immutable log of Core XP changes. Do not use for Weekly XP. Weekly reset must not touch this table.';
comment on column public.core_xp_ledger.delta_xp is 'Signed XP change (positive = grant).';
comment on column public.core_xp_ledger.source_type is 'e.g. arena_run, quest_claim, carryover, admin_grant.';
comment on column public.core_xp_ledger.source_id is 'Idempotency key: same (source_type, source_id) must not be inserted twice.';

-- Prevent duplicate apply of same source event (idempotency)
create unique index if not exists core_xp_ledger_source_idempotent_uq
  on public.core_xp_ledger(source_type, source_id)
  where source_id is not null;

create index if not exists core_xp_ledger_user_created_idx
  on public.core_xp_ledger(user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- weekly_xp_ledger — immutable Weekly XP events (reset boundary does not delete; history kept)
-- -----------------------------------------------------------------------------
create table if not exists public.weekly_xp_ledger (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  league_id uuid null references public.arena_leagues(league_id) on delete set null,
  delta_xp int not null,
  source_type text not null,
  source_id text null,
  created_at timestamptz not null default now()
);

comment on table public.weekly_xp_ledger is 'Immutable log of Weekly (seasonal) XP changes. Balance lives in weekly_xp; this is audit/history. Reset clears weekly_xp.xp_total only, not this table.';
comment on column public.weekly_xp_ledger.league_id is 'NULL = global pool; matches weekly_xp semantics.';
comment on column public.weekly_xp_ledger.source_type is 'e.g. arena_run, quest_claim, season_carryover, admin_grant.';
comment on column public.weekly_xp_ledger.source_id is 'Idempotency key per (user_id, league_id): same source must not be applied twice.';

-- Idempotency: one ledger row per (user, league, source_type, source_id) when source_id present
-- Two partial indexes: NULL league vs non-NULL league (Postgres treats NULLs as distinct in unique indexes)
create unique index if not exists weekly_xp_ledger_idempotent_uq_nonnull_league
  on public.weekly_xp_ledger(user_id, league_id, source_type, source_id)
  where source_id is not null and league_id is not null;
create unique index if not exists weekly_xp_ledger_idempotent_uq_null_league
  on public.weekly_xp_ledger(user_id, source_type, source_id)
  where source_id is not null and league_id is null;

create index if not exists weekly_xp_ledger_user_league_created_idx
  on public.weekly_xp_ledger(user_id, league_id, created_at desc);

create index if not exists weekly_xp_ledger_league_created_idx
  on public.weekly_xp_ledger(league_id, created_at desc)
  where league_id is not null;

-- -----------------------------------------------------------------------------
-- league_memberships — explicit membership; one row per (user, league)
-- -----------------------------------------------------------------------------
create table if not exists public.league_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  league_id uuid not null references public.arena_leagues(league_id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (user_id, league_id)
);

comment on table public.league_memberships is 'Explicit league membership. App creates row when user gets first weekly_xp row for that league. Prevents duplicate membership.';
comment on column public.league_memberships.joined_at is 'When user first earned XP in this league (or when membership was granted).';

create index if not exists league_memberships_league_idx
  on public.league_memberships(league_id);

-- -----------------------------------------------------------------------------
-- weekly_leaderboard_snapshots (OPTIONAL) — snapshot at reset boundary for history
-- -----------------------------------------------------------------------------
create table if not exists public.weekly_leaderboard_snapshots (
  id bigserial primary key,
  league_id uuid not null references public.arena_leagues(league_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rank int not null,
  xp_total int not null,
  week_end_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (league_id, user_id, week_end_at)
);

comment on table public.weekly_leaderboard_snapshots is 'Optional: snapshot of leaderboard at weekly reset boundary. week_end_at = end of the week that was just closed.';
comment on column public.weekly_leaderboard_snapshots.week_end_at is 'Reset boundary (e.g. Sunday 00:00 UTC) for which this snapshot was taken.';

create index if not exists weekly_leaderboard_snapshots_league_week_idx
  on public.weekly_leaderboard_snapshots(league_id, week_end_at desc);

create index if not exists weekly_leaderboard_snapshots_user_idx
  on public.weekly_leaderboard_snapshots(user_id, week_end_at desc);

-- -----------------------------------------------------------------------------
-- arena_season_state (OPTIONAL) — per-user per-season state (e.g. rewards, flags)
-- -----------------------------------------------------------------------------
create table if not exists public.arena_season_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  season_id uuid not null references public.arena_seasons(season_id) on delete cascade,
  meta jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, season_id)
);

comment on table public.arena_season_state is 'Optional: per-user per-season state (e.g. rewards_claimed). Not used for ranking.';
comment on column public.arena_season_state.meta is 'Flexible payload: e.g. {"rewards_claimed": ["tier_1"]}.';

create index if not exists arena_season_state_season_idx
  on public.arena_season_state(season_id);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.core_xp_ledger enable row level security;
alter table public.weekly_xp_ledger enable row level security;
alter table public.league_memberships enable row level security;
alter table public.weekly_leaderboard_snapshots enable row level security;
alter table public.arena_season_state enable row level security;

-- core_xp_ledger: users read own; insert/update only via service (or same user for insert)
drop policy if exists "core_xp_ledger_select_own" on public.core_xp_ledger;
create policy "core_xp_ledger_select_own"
  on public.core_xp_ledger for select to authenticated using (auth.uid() = user_id);
drop policy if exists "core_xp_ledger_insert_own" on public.core_xp_ledger;
create policy "core_xp_ledger_insert_own"
  on public.core_xp_ledger for insert to authenticated with check (auth.uid() = user_id);

-- weekly_xp_ledger: same
drop policy if exists "weekly_xp_ledger_select_own" on public.weekly_xp_ledger;
create policy "weekly_xp_ledger_select_own"
  on public.weekly_xp_ledger for select to authenticated using (auth.uid() = user_id);
drop policy if exists "weekly_xp_ledger_insert_own" on public.weekly_xp_ledger;
create policy "weekly_xp_ledger_insert_own"
  on public.weekly_xp_ledger for insert to authenticated with check (auth.uid() = user_id);

-- league_memberships: users read own; insert own (service usually does it)
drop policy if exists "league_memberships_select_own" on public.league_memberships;
create policy "league_memberships_select_own"
  on public.league_memberships for select to authenticated using (auth.uid() = user_id);
drop policy if exists "league_memberships_insert_own" on public.league_memberships;
create policy "league_memberships_insert_own"
  on public.league_memberships for insert to authenticated with check (auth.uid() = user_id);

-- Leaderboard: allow reading all memberships for a league (for ranking display)
drop policy if exists "league_memberships_select_all" on public.league_memberships;
create policy "league_memberships_select_all"
  on public.league_memberships for select to authenticated using (true);

-- weekly_leaderboard_snapshots: read-all for authenticated (historical leaderboards)
drop policy if exists "weekly_leaderboard_snapshots_select_all" on public.weekly_leaderboard_snapshots;
create policy "weekly_leaderboard_snapshots_select_all"
  on public.weekly_leaderboard_snapshots for select to authenticated using (true);

-- arena_season_state: users read/upsert own
drop policy if exists "arena_season_state_select_own" on public.arena_season_state;
create policy "arena_season_state_select_own"
  on public.arena_season_state for select to authenticated using (auth.uid() = user_id);
drop policy if exists "arena_season_state_insert_own" on public.arena_season_state;
create policy "arena_season_state_insert_own"
  on public.arena_season_state for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "arena_season_state_update_own" on public.arena_season_state;
create policy "arena_season_state_update_own"
  on public.arena_season_state for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- 4) INDEX / CONSTRAINT RATIONALE
-- =============================================================================
--
-- core_xp_ledger:
--   - core_xp_ledger_source_idempotent_uq: Prevents same (source_type, source_id) being applied twice.
--   - core_xp_ledger_user_created_idx: User history ordered by time for audit and balance recompute.
--
-- weekly_xp_ledger:
--   - weekly_xp_ledger_idempotent_uq_nonnull_league / _null_league: Per (user, league, source_type, source_id) idempotency; two partial indexes so NULL league_id is one bucket without sentinel.
--   - weekly_xp_ledger_user_league_created_idx: Per-user per-league event order.
--   - weekly_xp_ledger_league_created_idx: Per-league event stream for debugging/analytics.
--
-- league_memberships:
--   - PK (user_id, league_id): One membership per user per league; prevents duplicates.
--   - league_memberships_league_idx: List members of a league.
--
-- weekly_leaderboard_snapshots:
--   - UNIQUE (league_id, user_id, week_end_at): One snapshot per user per league per reset boundary.
--   - weekly_leaderboard_snapshots_league_week_idx: Query "last N weeks" for a league.
--   - weekly_leaderboard_snapshots_user_idx: User's history across weeks.
--
-- arena_season_state:
--   - PK (user_id, season_id): One state row per user per season.
--   - arena_season_state_season_idx: List users in a season for admin/reports.
--
-- =============================================================================
-- 5) NEXT STEPS
-- =============================================================================
--
-- [ ] Ensure weekly_xp table exists (e.g. from 001_weekly_xp or ONE_BLOCK); this migration does not create it.
-- [ ] App: when granting Weekly XP, insert into weekly_xp_ledger first (with source_type, source_id), then update weekly_xp.xp_total; use source_id for idempotency.
-- [ ] App: when granting Core XP, insert into core_xp_ledger first, then update arena_profiles.core_xp_total.
-- [ ] App: when creating first weekly_xp row for (user_id, league_id), insert into league_memberships (user_id, league_id, joined_at).
-- [ ] Optional: at weekly reset boundary, backfill weekly_leaderboard_snapshots from current weekly_xp (then run reset of weekly_xp per product rules).
-- [ ] Optional: use arena_season_state.meta for rewards_claimed or other per-user season flags.
-- [ ] Add TypeScript types in src/db or bty-app/src/lib for new tables if needed.
-- [ ] Do not add DB triggers that reset Core XP on season/weekly boundary; keep reset logic in app/cron only.
--
