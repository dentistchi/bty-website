-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- =============================================================================
-- Foundry Living Thread — V1 (persist one synthesized thread per evidence set).
--
-- PRODUCTION-EFFECTIVE: single shared Supabase project backs all workers; this
-- lands on live data once applied. WRITTEN only — apply is a separate
-- Commander-authorized step. Idempotent + replay-safe.
--
-- WHY A NEW TABLE (minimal, additive): the Living Thread is a per-USER synthesis
-- across MANY completed events. No per-user Foundry aggregate store exists — the
-- reflection columns live on foundry_event_training_progress, one row per
-- (event, participant), and cannot key a cross-event thread. Idempotency +
-- concurrency-safety require a unique (user_id, evidence_fingerprint) key so the
-- same evidence + prompt version restores the SAME thread and never regenerates.
-- Nothing existing is altered; this is one additive, service-role-only table.
--
-- The stored `thread` jsonb is the validated LivingThread meaning only:
--   { thread, supportingMoments:[{eventId,excerpt}], nextQuestion }.
-- It stores NO other participant's data; supportingMoments reference the caller's
-- OWN completed event ids (re-attached to title/date at read time from the
-- caller's own history). Raw watch telemetry is never involved.
--
-- Write path = service-role only (route gate resolves the authenticated user;
-- rows are always scoped to that user_id). RLS enabled with NO policy and NO
-- authenticated grant => default-deny for every client role (identical posture to
-- foundry_event_training_progress). No XP, no league, no leaderboard linkage.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS public.foundry_living_thread;
-- =============================================================================

create table if not exists public.foundry_living_thread (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  evidence_fingerprint text not null,
  prompt_version text not null,
  thread jsonb not null,
  source_count int not null,
  evidence_span_start timestamptz,
  evidence_span_end timestamptz,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint foundry_living_thread_source_count_check
    check (source_count >= 0)
);

-- Idempotency + concurrency guard: one canonical thread per (user, evidence set).
-- A concurrent generation collides on this unique key instead of duplicating.
create unique index if not exists foundry_living_thread_user_fingerprint_unique_idx
  on public.foundry_living_thread (user_id, evidence_fingerprint);

-- Hot path: the caller's current thread (newest first).
create index if not exists foundry_living_thread_user_generated_idx
  on public.foundry_living_thread (user_id, generated_at desc);

-- Default-deny for every client role; all access is service-role (route-gated).
revoke all on public.foundry_living_thread from anon, public, authenticated;
alter table public.foundry_living_thread enable row level security;
