-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- =============================================================================
-- Foundry Guided Arena Builder — V1 · Slice 3.0B (Publish + Playable practice)
--
-- PRODUCTION-EFFECTIVE: a single shared Supabase project backs all workers; this
-- lands on live data once applied. WRITTEN only — apply is a separate
-- Commander-authorized step (snapshot before/after; verify via information_schema).
-- Idempotent + replay-safe (create ... if not exists; drop ... if exists rollback).
--
-- Scope (additive only — DELIBERATELY ISOLATED from the canonical Arena runtime):
--   1. foundry_published_arena_practices — an IMMUTABLE published version of a
--      Foundry Arena scenario draft (Slice 3.0A). Frozen three-phase snapshot +
--      full source lineage. This is NOT a canonical Arena scenario: it is NOT in
--      public.scenarios, NOT in the static src/data/scenario registry, and is
--      NEVER selected by rotation (user_scenario_history is untouched). A new draft
--      revision publishes a NEW row; past versions are never overwritten.
--   2. foundry_arena_practice_runs — a learner's start/completion record for a
--      published practice. INTENTIONALLY SEPARATE from public.arena_runs so a
--      practice never enters the Core/Weekly XP, pattern, leadership, level, or
--      complete_verified machinery. THERE ARE NO XP COLUMNS HERE — a practice
--      earns exactly zero XP by construction, and existing Arena runs are unchanged.
--
-- Idempotency / duplicate-publish protection:
--   UNIQUE (source_draft_id, source_draft_revision): publishing the same draft
--   revision twice resolves to the same row (the service does on-conflict-return),
--   so duplicate taps never create duplicate published versions.
--
-- Authorization convention (preserved): CLIENT-DENY. RLS enabled, NO client policy,
-- NO anon/authenticated grant. Only the service-role client touches these, always
-- after a server-side gate (host publish; approved-member play) + an owner/user
-- scoped query.
--
-- No XP/league/season/weekly/leaderboard column is introduced anywhere.
--
-- Rollback (drop in dependency order — practice_runs references practices):
--   DROP TABLE IF EXISTS public.foundry_arena_practice_runs;
--   DROP TABLE IF EXISTS public.foundry_published_arena_practices;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. foundry_published_arena_practices — immutable published practice version.
-- ---------------------------------------------------------------------------
create table if not exists public.foundry_published_arena_practices (
  id uuid primary key default gen_random_uuid(),
  -- The exact source draft + the exact draft revision that was published.
  source_draft_id uuid not null references public.foundry_arena_scenario_drafts (id) on delete cascade,
  source_draft_revision int not null,
  -- Source Foundry event/module version lineage, copied from the draft at publish.
  source_event_id uuid not null references public.foundry_events (id) on delete cascade,
  source_module_version int not null,
  published_by uuid not null references auth.users (id) on delete cascade,
  -- Learner-facing labels (frozen).
  practice_title text not null,
  source_training_title text not null,
  -- The frozen three-phase scenario (same shape as the 3.0A draft: opening +
  -- primary/tradeoff/action_decision with stable-id choices). IMMUTABLE: there is
  -- no update path, so a later draft revision never mutates a published version.
  scenario_snapshot jsonb not null,
  status text not null default 'published',
  -- V1 availability model is intentionally narrow: any approved Arena member may
  -- play a published practice. Broader targeting/assignment is deferred.
  availability text not null default 'all_members',
  published_at timestamptz not null default now(),
  retired_at timestamptz,
  constraint foundry_pub_practice_status_check
    check (status in ('published', 'retired')),
  constraint foundry_pub_practice_availability_check
    check (availability in ('all_members')),
  constraint foundry_pub_practice_source_version_check
    check (source_module_version >= 1),
  constraint foundry_pub_practice_revision_check
    check (source_draft_revision >= 0),
  constraint foundry_pub_practice_retire_stamp_check
    check ((status = 'published' and retired_at is null) or (status = 'retired' and retired_at is not null)),
  -- Idempotency boundary: at most one published version per (draft, revision).
  constraint foundry_pub_practice_draft_revision_unique unique (source_draft_id, source_draft_revision)
);

-- Hot paths: discovery (available published, newest first) + lineage lookups.
create index if not exists foundry_pub_practice_status_idx
  on public.foundry_published_arena_practices (status, published_at desc);
create index if not exists foundry_pub_practice_source_draft_idx
  on public.foundry_published_arena_practices (source_draft_id);
create index if not exists foundry_pub_practice_publisher_idx
  on public.foundry_published_arena_practices (published_by, published_at desc);

revoke all on public.foundry_published_arena_practices from anon, public, authenticated;
alter table public.foundry_published_arena_practices enable row level security;

-- ---------------------------------------------------------------------------
-- 2. foundry_arena_practice_runs — learner start/completion. NO XP columns.
--    Isolated from public.arena_runs so canonical Arena runs stay unchanged.
-- ---------------------------------------------------------------------------
create table if not exists public.foundry_arena_practice_runs (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.foundry_published_arena_practices (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'in_progress',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint foundry_practice_run_status_check
    check (status in ('in_progress', 'completed')),
  constraint foundry_practice_run_completed_stamp_check
    check ((status = 'in_progress' and completed_at is null) or (status = 'completed' and completed_at is not null))
);

-- Hot path: a user's runs for a practice (start/resume/completion state on reload).
create index if not exists foundry_practice_run_user_practice_idx
  on public.foundry_arena_practice_runs (user_id, practice_id, started_at desc);

revoke all on public.foundry_arena_practice_runs from anon, public, authenticated;
alter table public.foundry_arena_practice_runs enable row level security;
