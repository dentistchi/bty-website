-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- =============================================================================
-- Foundry Guided Arena Builder — V1 · Slice 3.0A (Arena Scenario Draft)
--
-- PRODUCTION-EFFECTIVE: a single shared Supabase project backs all workers; this
-- lands on live data once applied. This file is WRITTEN only — apply is a
-- separate Commander-authorized step (snapshot before/after; verify against
-- information_schema). Idempotent + replay-safe (create ... if not exists;
-- drop ... if exists in rollback).
--
-- Scope (additive only — touches NOTHING in the existing Arena runtime, the
-- Foundry event/participant/progress/XP spine, or the module builder tables):
--   1. foundry_arena_scenario_drafts — a Foundry host's WORKING draft of an Arena
--      practice scenario derived from ONE exact published module version. This is
--      NOT a live/playable Arena scenario: the Arena runtime reads static content
--      (src/data/scenario, public.scenarios) and is untouched here. A draft only
--      holds the two guided answers + the generated/edited three-phase scenario
--      structure (learner-facing text + choices). It NEVER becomes published
--      Arena content in this slice (no publish/QR/run/re-exposure path exists).
--
-- Exact-version binding (the non-negotiable "never point at latest"):
--   Every draft pins its source to the IMMUTABLE published module snapshot:
--     source_event_id       -> foundry_events (id)            [the training]
--     source_module_version -> the frozen module version int  [exact version]
--     source_draft_id       -> foundry_module_drafts (id)     [exact version id]
--   These are copied at creation from foundry_event_module (event_id,
--   module_version, source_draft_id) — the frozen snapshot — so a later module
--   revision (version 2) never mutates a draft's source. source_draft_id has NO
--   cascade delete: a published module's source draft is already undeletable, so
--   the lineage reference is stable.
--
-- Authorization convention (preserved from the existing Foundry tables):
--   CLIENT-DENY. RLS enabled with NO client policy and NO grant to
--   anon/authenticated -> fully default-deny for every client role. Only the
--   service-role client (which bypasses RLS) touches it, always after the
--   requireManager gate + an explicit owner_user_id-scoped query AND an
--   owner-scoped check that the caller owns the source foundry_events row.
--
-- Notes:
--   * No XP, league, season, weekly, or leaderboard column is introduced. Core XP
--     vs Weekly XP separation is unaffected (this migration touches neither).
--   * status is exactly 'draft' in V1 — 'ready'/'published' are deliberately
--     DEFERRED (generated content must never silently become published content).
--
-- Rollback:
--   DROP TABLE IF EXISTS public.foundry_arena_scenario_drafts;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. foundry_arena_scenario_drafts — host's Arena practice draft, one per source
--    module version worked on (a host may hold several drafts for one event).
-- ---------------------------------------------------------------------------
create table if not exists public.foundry_arena_scenario_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  -- Exact immutable source module version (from the frozen foundry_event_module).
  source_event_id uuid not null references public.foundry_events (id) on delete cascade,
  source_module_version int not null,
  -- The exact source module VERSION identity. No cascade: a published module's
  -- source draft is undeletable, so this reference can never dangle.
  source_draft_id uuid not null references public.foundry_module_drafts (id),
  -- Lifecycle: 'draft' only in V1. A draft never auto-publishes to Arena content.
  status text not null default 'draft',
  -- The two guided answers ({ hardestWhen, avoidancePressure }). Persisted FIRST,
  -- independently of generation, so a provider failure never loses host input.
  guided_answers jsonb not null default '{}'::jsonb,
  -- The generated + host-edited three-phase scenario (opening + primary/tradeoff/
  -- action_decision, each with stable-id choices). Null until first generation.
  scenario_draft jsonb,
  -- How the CURRENT scenario_draft was produced: 'ai' (provider), 'template'
  -- (deterministic fallback), or 'edited' (host changed it). Advisory/observability.
  generation_source text,
  -- Monotonic save counter (0 = created, bumps on every successful save).
  revision int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint foundry_arena_scenario_drafts_status_check
    check (status in ('draft')),
  constraint foundry_arena_scenario_drafts_source_version_check
    check (source_module_version >= 1),
  constraint foundry_arena_scenario_drafts_revision_check
    check (revision >= 0),
  constraint foundry_arena_scenario_drafts_generation_source_check
    check (generation_source is null or generation_source in ('ai', 'template', 'edited'))
);

-- Hot paths: owner's most-recent drafts, and all drafts for a given source event.
create index if not exists foundry_arena_scenario_drafts_owner_updated_idx
  on public.foundry_arena_scenario_drafts (owner_user_id, updated_at desc);
create index if not exists foundry_arena_scenario_drafts_owner_event_idx
  on public.foundry_arena_scenario_drafts (owner_user_id, source_event_id);

-- Client-deny: RLS on, no policy, no anon/authenticated grant -> service-role only.
revoke all on public.foundry_arena_scenario_drafts from anon, public, authenticated;
alter table public.foundry_arena_scenario_drafts enable row level security;
