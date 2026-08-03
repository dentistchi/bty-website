-- BUILD 25 harness prereq — ADDITIVE ONLY, applied after supabase/tests/20m/00_prereq.sql.
--
-- The 20M/24 prereq builds the minimal stand-in schema those suites need, which is the METERING
-- subset. BUILD 25 is the first harness to call `end_karaoke_event`, and that function also
-- touches the pairing-session table and the queue's YouTube-handoff column — neither of which the
-- metering subset ever needed. Without them the function fails with 42P01 and the suite cannot
-- exercise the Event-end writer at all.
--
-- Kept in a SEPARATE file rather than edited into 20m/00_prereq.sql on purpose: the b24 harness
-- reads that file too, and widening a shared fixture to suit a newer suite is how one suite's
-- assumptions quietly become another's.
--
-- Shapes mirror the real migrations:
--   karaoke_sessions              20260713100000_karaoke_2c_pairing_sessions.sql
--   karaoke_requests.youtube_queued_at   the Display/queue handoff column

create table if not exists public.karaoke_sessions (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null,
  status      text not null default 'active' check (status in ('active','ended')),
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);

-- Real production constraint: at most one active session per room. Included because
-- `end_karaoke_event` closes the active session, and a harness that allowed two would not be
-- exercising the same statement production runs.
create unique index if not exists karaoke_sessions_one_active_idx
  on public.karaoke_sessions (room_id)
  where status = 'active';

alter table public.karaoke_requests
  add column if not exists youtube_queued_at timestamptz;
