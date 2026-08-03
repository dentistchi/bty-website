-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- Slice 3.2I-R5B2-R5A — durable Practice generation ATTEMPT observability V1.
-- ============================================================================
-- WHY
-- 3.2K-R4 forensically traced one real staging generation failure and could not
-- name its mechanism. The request waited at least ~79 s and returned
-- `generation_failed` — a code that three materially different provider outcomes
-- (abort at the deadline, transport error, empty body) all collapse into. The only
-- record was `console.info`, and this Worker has no observability block, no logpush
-- and no tail consumer, so nothing survived the request.
--
-- The product decision that follows is fail-BEFORE-spend: a Practice generation may
-- not begin unless the application can first create a durable attempt row. A
-- generation must never consume provider resources while becoming unobservable.
--
-- SCOPE — one narrowly scoped table. No existing structure owns this lifecycle:
-- `loop_health_log` records admin/CI check results, and the R4 probe confirmed no
-- generation-attempt table exists under any of the candidate names.
--
-- PRIVACY — this table stores SHAPE and OUTCOME, never content. No prompt text, no
-- provider response text, no scenario text, no boundary statements, no training
-- prose, no credentials, no stack traces, no provider error bodies. Every free-text
-- column is constrained to a closed vocabulary, except `provider_error_category`,
-- which is a short sanitized label, and the response digest, which is a hash.
--
-- ADDITIVE + IDEMPOTENT: create-if-not-exists only. No existing row is read or
-- rewritten, there is no backfill, and no trigger touches any other table.
-- ============================================================================

create table if not exists public.foundry_practice_generation_attempts (
  id uuid primary key default gen_random_uuid(),

  -- ---- identity -----------------------------------------------------------
  -- The draft is the subject. ON DELETE CASCADE matches the draft's own lifetime:
  -- an attempt has no meaning once the draft it describes is gone.
  draft_id uuid not null
    references public.foundry_arena_scenario_drafts (id) on delete cascade,
  -- Revision AT ATTEMPT START. R4 proved the value of this: the captured draft sat
  -- at revision 1 after its boundary save and was never written again, which is how
  -- persistence was excluded without any provider evidence at all.
  draft_revision integer not null,
  source_event_id uuid null
    references public.foundry_events (id) on delete set null,
  -- The owner, for scoping and support lookup. Never an email or a name.
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  -- Correlates client, route and this row. Generated server-side per submission.
  correlation_id uuid not null,
  -- Which build produced the attempt, where the runtime exposes it.
  deploy_version text null,

  -- ---- timing -------------------------------------------------------------
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  duration_ms integer null check (duration_ms is null or duration_ms >= 0),
  -- The deadline that was IN FORCE for this attempt, so a later tuning slice can
  -- compare outcomes across configurations instead of guessing which was active.
  provider_timeout_ms integer not null check (provider_timeout_ms > 0),

  -- ---- request shape, never prose -----------------------------------------
  model text not null,
  structured_output_mode text not null
    check (structured_output_mode in ('json_schema_strict', 'none')),
  max_tokens integer not null check (max_tokens > 0),
  boundary_mode text null
    check (boundary_mode is null or boundary_mode in ('knowledge_check', 'judgment', 'judgment_with_constraints')),
  boundary_constraint_count integer not null default 0 check (boundary_constraint_count >= 0),
  -- Which generation attempt inside one submission this row is. The service allows
  -- at most two, and only for a correctable rejection.
  attempt_number integer not null default 1 check (attempt_number between 1 and 2),
  locale text not null check (locale in ('en', 'ko')),

  -- ---- outcome ------------------------------------------------------------
  lifecycle_state text not null default 'started'
    check (lifecycle_state in ('started', 'completed')),
  -- NULL only while `started`. The whole point of the slice is that these are
  -- distinguishable; `generation_failed` is deliberately NOT a member.
  outcome text null check (outcome is null or outcome in (
    'success',
    'provider_timeout',
    'provider_transport_error',
    'provider_http_error',
    'provider_empty_output',
    'provider_malformed_output',
    'provider_schema_invalid',
    'scenario_quality_rejected',
    'boundary_review_rejected',
    'scenario_persistence_failed',
    'internal_failure'
  )),
  provider_http_status integer null
    check (provider_http_status is null or provider_http_status between 100 and 599),
  -- A SHORT sanitized label from a closed set — never a provider message.
  provider_error_category text null check (
    provider_error_category is null
    or provider_error_category in ('rate_limited', 'unauthorized', 'bad_request', 'server_error', 'network', 'aborted', 'unknown')
  ),
  response_bytes integer null check (response_bytes is null or response_bytes >= 0),
  -- SHA-256 of the raw response. A digest identifies a body across runs without
  -- retaining one character of it.
  response_sha256 text null check (response_sha256 is null or response_sha256 ~ '^[0-9a-f]{64}$'),
  finish_reason text null check (finish_reason is null or length(finish_reason) <= 40),
  prompt_tokens integer null check (prompt_tokens is null or prompt_tokens >= 0),
  completion_tokens integer null check (completion_tokens is null or completion_tokens >= 0),
  scenario_persisted boolean not null default false,

  -- A completed row must carry an outcome and a finish time; a started row must not
  -- pretend to have either. This is what makes "still running" and "we lost the
  -- answer" different states rather than the same NULL.
  constraint foundry_practice_gen_attempt_lifecycle_consistent check (
    (lifecycle_state = 'started' and outcome is null and finished_at is null)
    or (lifecycle_state = 'completed' and outcome is not null and finished_at is not null)
  ),
  -- Only a success may claim a persisted scenario.
  constraint foundry_practice_gen_attempt_persisted_consistent check (
    scenario_persisted = false or outcome = 'success'
  )
);

comment on table public.foundry_practice_generation_attempts is
  'Durable Practice generation attempt lifecycle (Slice 3.2I-R5B2-R5A). Service-role writes only. Shape and outcome only — never prompt, response, scenario or boundary content.';

-- Draft history, recency sweeps, and outcome-rate queries.
create index if not exists foundry_practice_gen_attempt_draft_started_idx
  on public.foundry_practice_generation_attempts (draft_id, started_at desc);
create index if not exists foundry_practice_gen_attempt_started_idx
  on public.foundry_practice_generation_attempts (started_at desc);
create index if not exists foundry_practice_gen_attempt_outcome_idx
  on public.foundry_practice_generation_attempts (outcome, started_at desc)
  where outcome is not null;
-- Finds attempts that never reached a terminal state — the shape a lost response
-- leaves behind, and the one thing console logging could never show.
create index if not exists foundry_practice_gen_attempt_open_idx
  on public.foundry_practice_generation_attempts (started_at desc)
  where lifecycle_state = 'started';

-- ---------------------------------------------------------------------------
-- RLS + client revokes. Same posture as bty_org_action_review_authority and
-- loop_health_log: RLS on with NO permissive policy, so anon/authenticated are
-- denied outright and only the service role can read or write. A product client
-- therefore cannot enumerate anyone's attempts — including its own — and there is
-- no cross-account exposure to reason about.
-- ---------------------------------------------------------------------------
revoke all on public.foundry_practice_generation_attempts from anon, public, authenticated;
alter table public.foundry_practice_generation_attempts enable row level security;

-- ---------------------------------------------------------------------------
-- ROLLBACK (reviewed, NOT executed — recorded so a reversal is a decision, not an
-- improvisation). Dropping the table discards all attempt evidence:
--
--   drop index if exists public.foundry_practice_gen_attempt_open_idx;
--   drop index if exists public.foundry_practice_gen_attempt_outcome_idx;
--   drop index if exists public.foundry_practice_gen_attempt_started_idx;
--   drop index if exists public.foundry_practice_gen_attempt_draft_started_idx;
--   drop table if exists public.foundry_practice_generation_attempts;
-- ---------------------------------------------------------------------------
