-- Weekly XP reset: snapshot final balances before zeroing `weekly_xp.xp_total` (global pool).
-- Core XP is never touched; `weekly_xp_ledger` is immutable (not cleared here).

create table if not exists public.weekly_xp_history (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  season_id uuid references public.arena_seasons (season_id) on delete set null,
  final_xp integer not null,
  snapshot_at timestamptz not null default now(),
  ended_week_monday date not null
);

comment on table public.weekly_xp_history is
  'Point-in-time snapshot of weekly (ranking) XP before reset. One row per user per ended week; ties to Monday UTC of the week window that closed.';

create unique index if not exists weekly_xp_history_user_week_uq
  on public.weekly_xp_history (user_id, ended_week_monday);

create index if not exists weekly_xp_history_season_snapshot_idx
  on public.weekly_xp_history (season_id, snapshot_at desc);

alter table public.weekly_xp_history enable row level security;

-- Cron / service role uses service key (bypasses RLS). No anon policies.

create table if not exists public.weekly_reset_log (
  id bigserial primary key,
  ended_week_monday date not null unique,
  season_id uuid references public.arena_seasons (season_id) on delete set null,
  snapshot_at timestamptz not null default now()
);

comment on table public.weekly_reset_log is
  'One row per completed weekly reset (Monday 00:00 UTC trigger). Prevents duplicate processing for the same ended week.';

alter table public.weekly_reset_log enable row level security;
