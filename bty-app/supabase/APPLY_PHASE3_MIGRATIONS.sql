-- =============================================================================
-- BTY Arena: Phase 3 migrations (20260301 ~ 20260307) — 한 번에 적용
-- Supabase Dashboard → SQL Editor에서 전체 선택 후 Run.
-- 이미 적용된 마이그레이션이 있으면 대부분 IF NOT EXISTS / DROP IF EXISTS 로 건너뜀.
-- Storage 정책(20260304)은 두 번째 실행 시 충돌할 수 있음 → 이미 적용됐으면 해당 블록만 건너뛰기.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 20260301000000_arena_league_season_schema.sql
-- -----------------------------------------------------------------------------
-- BTY Arena: League system, weekly (seasonal) XP, season resets, duplicate prevention

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

alter table public.arena_leagues
  add column if not exists season_id uuid references public.arena_seasons(season_id) on delete set null,
  add column if not exists status text null;

comment on column public.arena_leagues.season_id is 'League belongs to this season. NULL for legacy leagues.';
comment on column public.arena_leagues.name is 'Display name of the league.';
comment on column public.arena_leagues.min_lifetime_xp is 'Minimum Core XP (or legacy lifetime_xp) to qualify for this league.';
comment on column public.arena_leagues.status is 'active = visible for ranking; closed = season ended.';
comment on table public.arena_leagues is 'League definition per season. start_at/end_at = ranking window; status controls visibility.';

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

comment on table public.weekly_xp is 'Seasonal (competition) XP per user per league. One row per (user_id, league_id); prevents duplicate league entries. Leaderboard reads from here only.';
comment on column public.weekly_xp.user_id is 'References auth.users. One row per user when league_id IS NULL (global pool).';
comment on column public.weekly_xp.league_id is 'NULL = global/current pool; non-NULL = this league. Unique with user_id to prevent duplicate entries.';
comment on column public.weekly_xp.xp_total is 'Seasonal XP total for this user in this league. Reset/carryover at season end.';

create unique index if not exists weekly_xp_user_null_league_uq on public.weekly_xp(user_id) where league_id is null;
create unique index if not exists weekly_xp_user_league_uq on public.weekly_xp(user_id, league_id) where league_id is not null;
create index if not exists weekly_xp_league_xp_desc_idx on public.weekly_xp(league_id, xp_total desc) where league_id is not null;
create index if not exists weekly_xp_user_league_idx on public.weekly_xp(user_id, league_id);

comment on table public.arena_profiles is 'One per user. Core XP is permanent; league_id is display-only, not used for leaderboard.';
comment on column public.arena_profiles.league_id is 'Display/current league only. Leaderboard ranking comes from weekly_xp, not this.';

alter table public.arena_seasons enable row level security;
drop policy if exists "arena_seasons_select_all" on public.arena_seasons;
create policy "arena_seasons_select_all"
  on public.arena_seasons for select to authenticated using (true);

-- -----------------------------------------------------------------------------
-- 20260302000000_arena_ledgers_memberships_snapshots.sql
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

create unique index if not exists core_xp_ledger_source_idempotent_uq
  on public.core_xp_ledger(source_type, source_id)
  where source_id is not null;

create index if not exists core_xp_ledger_user_created_idx
  on public.core_xp_ledger(user_id, created_at desc);

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

alter table public.core_xp_ledger enable row level security;
alter table public.weekly_xp_ledger enable row level security;
alter table public.league_memberships enable row level security;
alter table public.weekly_leaderboard_snapshots enable row level security;
alter table public.arena_season_state enable row level security;

drop policy if exists "core_xp_ledger_select_own" on public.core_xp_ledger;
create policy "core_xp_ledger_select_own"
  on public.core_xp_ledger for select to authenticated using (auth.uid() = user_id);
drop policy if exists "core_xp_ledger_insert_own" on public.core_xp_ledger;
create policy "core_xp_ledger_insert_own"
  on public.core_xp_ledger for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "weekly_xp_ledger_select_own" on public.weekly_xp_ledger;
create policy "weekly_xp_ledger_select_own"
  on public.weekly_xp_ledger for select to authenticated using (auth.uid() = user_id);
drop policy if exists "weekly_xp_ledger_insert_own" on public.weekly_xp_ledger;
create policy "weekly_xp_ledger_insert_own"
  on public.weekly_xp_ledger for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "league_memberships_select_own" on public.league_memberships;
create policy "league_memberships_select_own"
  on public.league_memberships for select to authenticated using (auth.uid() = user_id);
drop policy if exists "league_memberships_insert_own" on public.league_memberships;
create policy "league_memberships_insert_own"
  on public.league_memberships for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "league_memberships_select_all" on public.league_memberships;
create policy "league_memberships_select_all"
  on public.league_memberships for select to authenticated using (true);

drop policy if exists "weekly_leaderboard_snapshots_select_all" on public.weekly_leaderboard_snapshots;
create policy "weekly_leaderboard_snapshots_select_all"
  on public.weekly_leaderboard_snapshots for select to authenticated using (true);

drop policy if exists "arena_season_state_select_own" on public.arena_season_state;
create policy "arena_season_state_select_own"
  on public.arena_season_state for select to authenticated using (auth.uid() = user_id);
drop policy if exists "arena_season_state_insert_own" on public.arena_season_state;
create policy "arena_season_state_insert_own"
  on public.arena_season_state for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "arena_season_state_update_own" on public.arena_season_state;
create policy "arena_season_state_update_own"
  on public.arena_season_state for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 20260303000000_arena_profiles_avatar_url.sql
-- -----------------------------------------------------------------------------
alter table public.arena_profiles
  add column if not exists avatar_url text null;

comment on column public.arena_profiles.avatar_url is 'User avatar image URL (e.g. Ready Player Me 2D render). Null = use fallback (initials or default icon).';

-- -----------------------------------------------------------------------------
-- 20260304000000_arena_storage_avatars_bucket.sql
-- -----------------------------------------------------------------------------
-- 이미 적용된 경우 정책 이름 충돌 가능 → 필요 시 아래 세 개 drop 후 다시 실행
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Arena avatars: authenticated insert own folder" on storage.objects;
create policy "Arena avatars: authenticated insert own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Arena avatars: authenticated update own folder" on storage.objects;
create policy "Arena avatars: authenticated update own folder"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Arena avatars: authenticated delete own folder" on storage.objects;
create policy "Arena avatars: authenticated delete own folder"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Arena avatars: public read" on storage.objects;
create policy "Arena avatars: public read"
on storage.objects for select to public
using (bucket_id = 'avatars');

-- -----------------------------------------------------------------------------
-- 20260305000000_arena_membership_requests.sql
-- -----------------------------------------------------------------------------
create table if not exists public.arena_membership_requests (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_function text not null,
  joined_at date not null,
  leader_started_at date null,
  status text not null default 'pending' check (status in ('pending', 'approved')),
  approved_at timestamptz null,
  approved_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

comment on table public.arena_membership_requests is 'Arena 멤버십 가입 요청. 승인 시 joined_at/leader_started_at이 tenure 계산에 사용됨.';
comment on column public.arena_membership_requests.job_function is '직군 (staff / leader 등).';
comment on column public.arena_membership_requests.joined_at is '입사일 (승인 시 확정).';
comment on column public.arena_membership_requests.leader_started_at is '리더 시작일 (리더 직군인 경우, nullable).';
comment on column public.arena_membership_requests.status is 'pending: 대기, approved: 승인됨.';
comment on column public.arena_membership_requests.approved_at is '승인 시각 (Admin 승인 시에만 설정).';
comment on column public.arena_membership_requests.approved_by is '승인한 Admin 식별자 (이메일 또는 user_id).';

create index if not exists arena_membership_requests_user_id_idx
  on public.arena_membership_requests(user_id);
create index if not exists arena_membership_requests_status_idx
  on public.arena_membership_requests(status)
  where status = 'pending';

alter table public.arena_membership_requests enable row level security;

drop policy if exists "arena_membership_requests_select_own" on public.arena_membership_requests;
create policy "arena_membership_requests_select_own"
  on public.arena_membership_requests for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "arena_membership_requests_insert_own" on public.arena_membership_requests;
create policy "arena_membership_requests_insert_own"
  on public.arena_membership_requests for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "arena_membership_requests_update_own_pending" on public.arena_membership_requests;
create policy "arena_membership_requests_update_own_pending"
  on public.arena_membership_requests for update to authenticated
  using (auth.uid() = user_id and status = 'pending')
  with check (auth.uid() = user_id and status = 'pending');

-- -----------------------------------------------------------------------------
-- 20260306000000_arena_profiles_avatar_character_id.sql
-- -----------------------------------------------------------------------------
alter table public.arena_profiles
  add column if not exists avatar_character_id text null;

comment on column public.arena_profiles.avatar_character_id is '선택한 캐릭터 id (게임 스타일). null이면 캐릭터 미선택.';

-- -----------------------------------------------------------------------------
-- 20260307000000_arena_profiles_avatar_outfit_theme.sql
-- -----------------------------------------------------------------------------
alter table public.arena_profiles
  add column if not exists avatar_outfit_theme text null;

comment on column public.arena_profiles.avatar_outfit_theme is 'Outfit theme for level-based avatar skin: professional | fantasy. Null = default (professional).';
