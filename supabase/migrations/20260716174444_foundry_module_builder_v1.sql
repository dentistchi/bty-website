-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- =============================================================================
-- Foundry Guided Module Builder — V1 · Slice 1 (Domain / Schema / Authorization)
--
-- PRODUCTION-EFFECTIVE: a single shared Supabase project backs all workers; this
-- lands on live data once applied. This file is WRITTEN only — apply is a
-- separate Commander-authorized step (snapshot before/after; verify against
-- information_schema). Idempotent + replay-safe (create ... if not exists;
-- add-constraint guarded by pg_constraint existence checks; drop ... if exists
-- in rollback).
--
-- Scope (additive only — touches NOTHING in the existing event/participant/
-- progress/XP spine):
--   1. foundry_module_drafts  — MUTABLE builder working-state + approval +
--      version lineage. Lifecycle: draft -> approved -> published. PATCH/delete
--      are allowed ONLY while status = 'draft' (enforced in the service layer;
--      the CHECK below only pins the stamp/lifecycle consistency). A revision is
--      a NEW draft row (parent_module_id lineage), never a mutation of an
--      approved/published row.
--   2. foundry_event_module   — IMMUTABLE published module snapshot, 1:1 with a
--      foundry_events row (event_id PK/FK, mirroring foundry_event_training_content
--      / foundry_event_document_content). source_draft_id is NOT NULL + UNIQUE:
--      this is the authoritative FUTURE publish-idempotency boundary — one draft
--      version may create at most one Foundry event; a concurrent duplicate
--      publish fails at this uniqueness, the loser is compensating-deleted, and
--      the winner is resolved by source_draft_id. Publish is NOT implemented in
--      this slice; only the schema seam + a service lookup are.
--
-- Authorization convention (preserved from the existing Foundry tables):
--   Both tables are CLIENT-DENY. RLS is enabled with NO client policy and NO
--   grant to anon/authenticated -> fully default-deny for every client role.
--   Only the service-role client (which bypasses RLS) touches them, always after
--   the requireManager gate + an explicit owner_user_id-scoped query. No direct
--   owner SELECT policy is added: Slice-1 source has no direct authenticated-
--   client read of these tables, so none is warranted (matches foundry_host_grants
--   / foundry_event_training_progress / foundry_living_thread — the strictest tier).
--
-- Notes:
--   * document_asset_ref is an OPTIONAL, OPAQUE reference reserved for the future
--     content/publish slice. It is NOT a client-exposable storage path and NOT an
--     expiring 30-minute staging ticket to be treated as durable/cold-restorable
--     content. Durable draft-asset lifecycle is DEFERRED. Bounded here to reject
--     an absolute URL/path being parked in it.
--   * No XP, league, season, weekly, or leaderboard column is introduced. Core XP
--     vs Weekly XP separation is unaffected (this migration touches neither).
--
-- Rollback (drop in dependency order — event_module references drafts):
--   DROP TABLE IF EXISTS public.foundry_event_module;
--   DROP TABLE IF EXISTS public.foundry_module_drafts;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. foundry_module_drafts — mutable builder state, approval, version lineage.
-- ---------------------------------------------------------------------------
create table if not exists public.foundry_module_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  -- Lifecycle: draft -> approved -> published. 'published' is terminal in V1.
  status text not null default 'draft',
  -- Guided Module Builder has 8 questions; current_step drives resume.
  current_step int not null default 1,
  -- The full builder answer set (problem, capability, target roles, observable
  -- behavior, success evidence, evidence type, learning type, reflection prompt,
  -- action-decision prompt, arena recommendation, follow-up). Progressive: a
  -- draft may hold a partial object; approval-readiness is validated in domain.
  answers jsonb not null default '{}'::jsonb,
  module_version int not null default 1,
  -- A revision points back at the draft it descends from (nullable = original).
  parent_module_id uuid references public.foundry_module_drafts (id) on delete set null,
  -- OPAQUE, OPTIONAL. Reserved for the future content/publish slice; never a raw
  -- storage path exposed to the client, never an expiring staging ticket.
  document_asset_ref text,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint foundry_module_drafts_status_check
    check (status in ('draft', 'approved', 'published')),
  constraint foundry_module_drafts_current_step_check
    check (current_step between 1 and 8),
  constraint foundry_module_drafts_module_version_check
    check (module_version >= 1),
  -- Lifecycle-stamp consistency: approved implies approved_at; published implies
  -- BOTH stamps. A draft carries neither. (State transitions themselves are
  -- enforced in the service layer + domain; this pins stamp honesty at rest.)
  constraint foundry_module_drafts_lifecycle_stamp_check
    check (
      (status = 'draft' and approved_at is null and published_at is null)
      or (status = 'approved' and approved_at is not null and published_at is null)
      or (status = 'published' and approved_at is not null and published_at is not null)
    ),
  -- Defense in depth: keep an opaque ref opaque and bounded (reject a pasted URL).
  constraint foundry_module_drafts_document_asset_ref_len_check
    check (document_asset_ref is null or char_length(btrim(document_asset_ref)) between 1 and 200)
);

-- Hot paths: owner's most-recent drafts (resume list) + owner+status filtering.
create index if not exists foundry_module_drafts_owner_updated_idx
  on public.foundry_module_drafts (owner_user_id, updated_at desc);
create index if not exists foundry_module_drafts_owner_status_idx
  on public.foundry_module_drafts (owner_user_id, status);

-- Client-deny: RLS on, no policy, no anon/authenticated grant -> service-role only.
revoke all on public.foundry_module_drafts from anon, public, authenticated;
alter table public.foundry_module_drafts enable row level security;

-- ---------------------------------------------------------------------------
-- 2. foundry_event_module — immutable published snapshot, 1:1 with the event.
--    source_draft_id UNIQUE = the authoritative publish-idempotency boundary.
-- ---------------------------------------------------------------------------
create table if not exists public.foundry_event_module (
  event_id uuid primary key references public.foundry_events (id) on delete cascade,
  -- NOT NULL + UNIQUE: at most one event per draft version. The FK has NO cascade
  -- delete on the draft side (default NO ACTION) so a published module's source
  -- draft can never be deleted out from under it.
  source_draft_id uuid not null references public.foundry_module_drafts (id),
  -- Frozen copy of the approved answers at publish time. Immutable: no update
  -- path exists (mirrors the existing content tables), so a later draft revision
  -- (module_version 2) never mutates an already-published Session's snapshot.
  module_snapshot jsonb not null,
  module_version int not null,
  created_at timestamptz not null default now(),
  constraint foundry_event_module_module_version_check
    check (module_version >= 1),
  constraint foundry_event_module_source_draft_unique unique (source_draft_id)
);

-- Client-deny: RLS on, no policy, no anon/authenticated grant -> service-role only.
revoke all on public.foundry_event_module from anon, public, authenticated;
alter table public.foundry_event_module enable row level security;
