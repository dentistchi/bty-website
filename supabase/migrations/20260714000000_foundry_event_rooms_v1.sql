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
--   DROP FUNCTION IF EXISTS public.bty_foundry_award_daily_capped(uuid, uuid, text, int, timestamptz, timestamptz, int);
--   DROP TABLE IF EXISTS public.foundry_event_training_progress;
--   DROP TABLE IF EXISTS public.foundry_event_training_content;
--   DROP TABLE IF EXISTS public.foundry_event_participants;
--   DROP TABLE IF EXISTS public.foundry_events;
--   DROP TABLE IF EXISTS public.foundry_host_grants;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Foundry Host capability (authorization). "Foundry Host" = permission to
-- create and operate Foundry Training Events — a product capability, NOT an org
-- role (a clinical director, trainer, mentor, or doctor may all be Hosts). V1 is
-- a GLOBAL capability (no org/region scope). Client cannot read/write this table;
-- all authorization is server-side (service-role). No user is seeded here — the
-- first pilot Host is granted out-of-band after apply (scripts/manage-foundry-host).
-- ---------------------------------------------------------------------------
create table if not exists public.foundry_host_grants (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'active',
  granted_by_user_id uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint foundry_host_grants_status_check
    check (status in ('active', 'revoked')),
  constraint foundry_host_grants_revocation_check
    check (
      (status = 'active' and revoked_at is null)
      or
      (status = 'revoked' and revoked_at is not null)
    )
);

-- Hot path: "is this user an active Host?" (also the only listing the ops script needs).
create index if not exists foundry_host_grants_active_idx
  on public.foundry_host_grants (status)
  where status = 'active';

-- Default-deny for every client role; authorization is service-role only.
revoke all on public.foundry_host_grants from public, anon, authenticated;
alter table public.foundry_host_grants enable row level security;

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
    unique (participant_session_token_hash),
  -- Enables the composite FK from training progress so a progress row can only
  -- reference a participant that belongs to the SAME event (cross-event guard).
  constraint foundry_event_participants_event_id_unique
    unique (event_id, id)
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
  participant_id uuid not null,
  video_started_at timestamptz,
  video_completed_at timestamptz,
  response_text text,
  completed_at timestamptz,
  linked_user_id uuid references auth.users (id) on delete set null,
  xp_awarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint foundry_training_progress_unique unique (event_id, participant_id),
  -- Composite FK: the participant MUST belong to this event. Replaces a naive
  -- standalone participant_id FK (which allowed a progress row to pair an event
  -- with a participant from a DIFFERENT event). ON DELETE CASCADE with the
  -- participant row.
  constraint foundry_training_progress_participant_fk
    foreign key (event_id, participant_id)
    references public.foundry_event_participants (event_id, id) on delete cascade,
  constraint foundry_training_progress_response_len_check
    check (response_text is null or char_length(btrim(response_text)) between 1 and 1000),
  -- A completed training REQUIRES both the video to have completed AND a valid
  -- response — the client cannot fabricate completion without the server flags.
  constraint foundry_training_progress_completed_needs_video_and_response_check
    check (
      completed_at is null
      or (
        video_completed_at is not null
        and response_text is not null
        and char_length(btrim(response_text)) between 1 and 1000
      )
    ),
  constraint foundry_training_progress_xp_needs_complete_check
    check (xp_awarded_at is null or completed_at is not null)
);

create index if not exists foundry_training_progress_event_idx
  on public.foundry_event_training_progress (event_id);
create index if not exists foundry_training_progress_participant_idx
  on public.foundry_event_training_progress (participant_id);

-- One Core XP award per (event, user): a user cannot farm the same event's XP
-- via multiple device/browser participants. NULL linked_user_id (anonymous, not
-- yet claimed) is excluded from the constraint.
create unique index if not exists foundry_training_progress_event_user_unique_idx
  on public.foundry_event_training_progress (event_id, linked_user_id)
  where linked_user_id is not null;

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

-- ===========================================================================
-- Atomic Core-XP award gate for Foundry training (integrity hardening).
--
-- Enforces THREE integrity rules race-safely for concurrent claims, which a
-- read-count-then-insert at the service layer cannot: (1) idempotency per
-- completion (source_id = progress id), (2) one award per (user, event), and
-- (3) a per-canonical-BTY-day cap. The 05:00-local BTY-day boundary is computed
-- in TypeScript (domain/daily/userDayStartInstant) and passed in as
-- p_day_start / p_day_end — SQL never computes the domain day rule.
--
-- Serialized with pg_advisory_xact_lock(user, day) so concurrent claims cannot
-- exceed the cap. Writes ONLY the canonical core_xp_ledger (source_type=
-- 'foundry_training_completion'); the authoritative arena_profiles.core_xp_total
-- bump + avatar reprojection stay in TS (applyDirectCoreXp), called only on a
-- fresh 'awarded' result — mirroring bty_event_scan_award's SQL/TS split.
--
-- Returns: 'awarded' | 'already_awarded' | 'event_already_awarded' | 'daily_limit'.
-- Owner-exclusion is enforced in the service (needs no lock).
-- ===========================================================================
create or replace function public.bty_foundry_award_daily_capped(
  p_user_id     uuid,
  p_event_id    uuid,
  p_source_id   text,
  p_xp          int,
  p_day_start   timestamptz,
  p_day_end     timestamptz,
  p_max_per_day int default 3
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  -- Serialize this (user, BTY-day) so the count+insert below is race-safe.
  -- Single 64-bit key form: hashtextextended returns bigint, matching
  -- pg_advisory_xact_lock(bigint) (the two-arg form takes int4, int4).
  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || to_char(p_day_start at time zone 'UTC', 'YYYY-MM-DD'), 0)
  );

  -- (1) Idempotency per completion.
  if exists (
    select 1 from public.core_xp_ledger
    where source_type = 'foundry_training_completion' and source_id = p_source_id
  ) then
    return 'already_awarded';
  end if;

  -- (2) One award per (user, event) — a user cannot re-earn the same event's XP
  -- via a second participant/session.
  if exists (
    select 1
    from public.core_xp_ledger l
    join public.foundry_event_training_progress pr on pr.id::text = l.source_id
    where l.source_type = 'foundry_training_completion'
      and l.user_id = p_user_id
      and pr.event_id = p_event_id
  ) then
    return 'event_already_awarded';
  end if;

  -- (3) Per-canonical-BTY-day cap.
  select count(*) into v_count
  from public.core_xp_ledger
  where user_id = p_user_id
    and source_type = 'foundry_training_completion'
    and created_at >= p_day_start
    and created_at < p_day_end;

  if v_count >= p_max_per_day then
    return 'daily_limit';
  end if;

  insert into public.core_xp_ledger (user_id, delta_xp, source_type, source_id)
  values (p_user_id, p_xp, 'foundry_training_completion', p_source_id);

  return 'awarded';
end;
$$;

-- Service-role only (route gate + owner/token verification precede the call).
revoke all on function public.bty_foundry_award_daily_capped(uuid, uuid, text, int, timestamptz, timestamptz, int) from public, anon, authenticated;
grant execute on function public.bty_foundry_award_daily_capped(uuid, uuid, text, int, timestamptz, timestamptz, int) to service_role;
