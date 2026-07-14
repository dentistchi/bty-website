-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- =============================================================================
-- Foundry YouTube Training Rooms — V1
--
-- PRODUCTION-EFFECTIVE: single shared Supabase project backs all workers; this
-- lands on live data once applied. This file is WRITTEN only — apply is a
-- separate Commander-authorized step (snapshot before/after). Idempotent +
-- replay-safe (create ... if not exists, drop policy if exists).
--
-- Scope: the FIRST real Foundry product loop. A manager (any authenticated user)
-- turns ONE YouTube video into a shared training event: Foundry mints a signed
-- join capability (QR); employees scan and join by name WITHOUT a BTY account,
-- watch the embedded video, answer one completion question, and earn 10 Core XP
-- (awarded immediately if authenticated, or made claimable if anonymous). The
-- manager sees joined/completed counts and closes the event. Four tables:
--
--   - foundry_events: one row per event. owner = creator (auth.users).
--       status open|closed. join_version drives QR rotation (increment => old
--       QR capability tokens are rejected; token itself is stateless/signed).
--   - foundry_event_participants: one row per (event, joined device/name).
--       display_name is user-entered; ONLY the hash of the opaque participant
--       session token is stored (never the raw token). status joined|removed.
--   - foundry_event_training_content: ONE YouTube video + ONE completion prompt
--       per event. Stores the canonical 11-char video id only (never raw iframe
--       HTML / arbitrary embed URL). Owner-readable.
--   - foundry_event_training_progress: one row per (event, participant). Tracks
--       video started/completed, the private completion response, and Core XP
--       award/claim state. Response text is PRIVATE — no authenticated SELECT
--       policy; only service routes (service-role) read it for validation.
--       Core XP itself is awarded via the canonical core_xp_ledger +
--       applyDirectCoreXp path (source_type='foundry_training_completion',
--       source_id=progress.id) — NOT written here (no XP totals in Foundry).
--
-- Write path = service-role (route gate + token verification). RLS exposes only
-- owner SELECT (defense-in-depth); anon has no direct access. No XP, no league,
-- no leaderboard, no season linkage — Foundry Event Rooms is not an XP surface.
--
-- Rollback (drop in FK-dependency order):
--   DROP TABLE IF EXISTS public.foundry_event_training_progress;
--   DROP TABLE IF EXISTS public.foundry_event_training_content;
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

-- ===========================================================================
-- YouTube Training — content + progress (V1 loop).
-- ===========================================================================

-- ONE video + ONE prompt per event. Store the canonical 11-char id only; never
-- raw iframe HTML or an arbitrary embed URL. Metadata columns are nullable (no
-- YouTube Data API key in this app → filled later via keyless oEmbed if ever).
create table if not exists public.foundry_event_training_content (
  event_id uuid primary key references public.foundry_events (id) on delete cascade,
  youtube_video_id text not null,
  youtube_title text,
  youtube_channel_title text,
  youtube_thumbnail_url text,
  completion_prompt text not null,
  created_at timestamptz not null default now(),
  constraint foundry_training_content_video_id_check
    check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  constraint foundry_training_content_prompt_len_check
    check (char_length(btrim(completion_prompt)) between 1 and 300)
);

-- One progress row per (event, participant). Response text is PRIVATE. Core XP
-- is NOT stored here (canonical core_xp_ledger owns it) — only the award/claim
-- timestamps + linked user. xp requires completion; completion requires a
-- response; response requires the video to have completed (enforced in service).
create table if not exists public.foundry_event_training_progress (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.foundry_events (id) on delete cascade,
  participant_id uuid not null references public.foundry_event_participants (id) on delete cascade,
  video_started_at timestamptz,
  video_completed_at timestamptz,
  response_text text,
  completed_at timestamptz,
  linked_user_id uuid references auth.users (id) on delete set null,
  xp_awarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint foundry_training_progress_unique unique (event_id, participant_id),
  constraint foundry_training_progress_response_len_check
    check (response_text is null or char_length(btrim(response_text)) between 1 and 1000),
  constraint foundry_training_progress_completed_needs_response_check
    check (completed_at is null or response_text is not null),
  constraint foundry_training_progress_xp_needs_complete_check
    check (xp_awarded_at is null or completed_at is not null)
);

create index if not exists foundry_training_progress_event_idx
  on public.foundry_event_training_progress (event_id);
create index if not exists foundry_training_progress_participant_idx
  on public.foundry_event_training_progress (participant_id);

-- Grants: content is owner-readable; progress is service-role ONLY (no
-- authenticated grant/policy) so the private response is never client-readable
-- — the manager sees completion via the service-role roster projection, which
-- excludes response_text.
revoke all on public.foundry_event_training_content from anon, public;
revoke all on public.foundry_event_training_progress from anon, public;
grant select on public.foundry_event_training_content to authenticated;

alter table public.foundry_event_training_content enable row level security;
drop policy if exists "foundry_training_content_select_owner" on public.foundry_event_training_content;
create policy "foundry_training_content_select_owner" on public.foundry_event_training_content
  for select to authenticated using (
    event_id in (
      select id from public.foundry_events where owner_user_id = auth.uid()
    )
  );

-- Progress: RLS enabled, NO policy and NO authenticated grant => default-deny
-- for every client role. Only service-role (bypasses RLS) reads/writes it.
alter table public.foundry_event_training_progress enable row level security;
