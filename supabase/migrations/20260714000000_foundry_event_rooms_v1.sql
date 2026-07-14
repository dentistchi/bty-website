-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- =============================================================================
-- Foundry Event Rooms — V1
--
-- PRODUCTION-EFFECTIVE: single shared Supabase project backs all workers; this
-- lands on live data once applied. This file is WRITTEN only — apply is a
-- separate Commander-authorized step (snapshot before/after). Idempotent +
-- replay-safe (create ... if not exists, drop policy if exists).
--
-- Scope: the FIRST real Foundry product feature. A manager (any authenticated
-- user) creates an Event; Foundry mints a signed join capability (QR); employees
-- scan and join by name WITHOUT a BTY account; the manager sees the roster and
-- closes the Event. Two tables only, no training-module tables (deferred).
--
--   - foundry_events: one row per event. owner = creator (auth.users).
--       status open|closed. join_version drives QR rotation (increment => old
--       QR capability tokens are rejected; token itself is stateless/signed).
--   - foundry_event_participants: one row per (event, joined device/name).
--       display_name is user-entered; ONLY the hash of the opaque participant
--       session token is stored (never the raw token). status joined|removed.
--
-- Write path = service-role (route gate + token verification). RLS exposes only
-- owner SELECT (defense-in-depth); anon has no direct access. No XP, no league,
-- no leaderboard, no season linkage — Foundry Event Rooms is not an XP surface.
--
-- Rollback:
--   DROP TABLE IF EXISTS public.foundry_event_participants;
--   DROP TABLE IF EXISTS public.foundry_events;
-- =============================================================================

create table if not exists public.foundry_events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  status text not null default 'open',
  join_version int not null default 1,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint foundry_events_title_len_check
    check (char_length(btrim(title)) between 1 and 80),
  constraint foundry_events_status_check
    check (status in ('open', 'closed')),
  constraint foundry_events_join_version_check
    check (join_version >= 1)
);

create table if not exists public.foundry_event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.foundry_events (id) on delete cascade,
  display_name text not null,
  participant_session_token_hash text not null,
  status text not null default 'joined',
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  removed_at timestamptz,
  constraint foundry_event_participants_display_name_len_check
    check (char_length(btrim(display_name)) between 1 and 60),
  constraint foundry_event_participants_status_check
    check (status in ('joined', 'removed')),
  constraint foundry_event_participants_session_hash_unique
    unique (participant_session_token_hash)
);

-- Hot paths: owner's event list (newest first), status scans, and roster read
-- (joined order). Session-hash uniqueness index is created by the constraint.
create index if not exists foundry_events_owner_created_idx
  on public.foundry_events (owner_user_id, created_at desc);
create index if not exists foundry_events_status_idx
  on public.foundry_events (status);
create index if not exists foundry_event_participants_event_joined_idx
  on public.foundry_event_participants (event_id, joined_at asc);

-- ---------------------------------------------------------------------------
-- Layer 1 — grants: default-deny for anon; authenticated may SELECT (RLS below
-- still restricts rows to the owner). No client INSERT/UPDATE/DELETE: every
-- write goes through a service-role server route that verifies ownership or a
-- signed join token first.
-- ---------------------------------------------------------------------------
revoke all on public.foundry_events from anon, public;
revoke all on public.foundry_event_participants from anon, public;
grant select on public.foundry_events to authenticated;
grant select on public.foundry_event_participants to authenticated;

-- ---------------------------------------------------------------------------
-- Layer 2 — RLS (owner-scoped SELECT only; writes are service-role).
-- ---------------------------------------------------------------------------
alter table public.foundry_events enable row level security;
drop policy if exists "foundry_events_select_own" on public.foundry_events;
create policy "foundry_events_select_own" on public.foundry_events
  for select to authenticated using (owner_user_id = auth.uid());

alter table public.foundry_event_participants enable row level security;
drop policy if exists "foundry_event_participants_select_owner" on public.foundry_event_participants;
create policy "foundry_event_participants_select_owner" on public.foundry_event_participants
  for select to authenticated using (
    event_id in (
      select id from public.foundry_events where owner_user_id = auth.uid()
    )
  );
