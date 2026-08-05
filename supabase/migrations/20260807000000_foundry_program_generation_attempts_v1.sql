-- Copy-friendly (LF, no trailing spaces). Select all to copy.
--
-- GUIDED PROGRAM AUTHORSHIP — DURABLE GENERATION OBSERVABILITY (Slice 3.2L).
--
-- Whole-program authorship may not ship with console-only observability. The Builder's
-- two existing Copilots log outcomes to `console.info` and nothing else, so a refusal
-- can be seen once in a tail and never again; that is not enough for a surface that
-- spends real provider budget on the Founder's behalf.
--
-- WHY NEW TABLES, and not the practice ones. `foundry_practice_generation_attempts` is
-- bound to a practice scenario draft (`draft_id` references
-- `foundry_arena_scenario_drafts`) and carries practice-specific columns —
-- `boundary_mode`, `boundary_constraint_count`, `generation_input_revision`. Program
-- authorship generates from a MODULE draft and has no boundary concept at all. Recording
-- it there would require either a fake object type or nullable practice columns that lie
-- about what the row is. The vocabulary, the terminal-reason set and the RLS posture are
-- deliberately mirrored so the two arcs stay reconcilable, but the identity is separate
-- because the objects are separate.
--
-- Additive only. Nothing in the practice arc is read, altered or dropped.
--
-- WHAT IS NEVER STORED: no prompt, no model response text, no participant or Host prose,
-- no credential. Shape, outcome and cost only. The proposal itself is transient — it
-- lives in the Host's review UI and reaches the database only if the Host applies it,
-- and then as draft answers, never here.

begin;

-- ---------------------------------------------------------------------------
-- 1. PARENT — one Host instruction to author a program.
-- ---------------------------------------------------------------------------
create table if not exists public.foundry_program_generation_attempts (
  id uuid primary key default gen_random_uuid(),

  draft_id uuid not null
    references public.foundry_module_drafts (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,

  -- One explicit Host action. The partial unique index below is the whole mechanism:
  -- a re-delivered instruction cannot buy a second generation, however many requests race.
  submission_intent_id uuid not null,

  -- Stale-context protection. The fingerprint of the Builder answers the proposal was
  -- authored from; a proposal whose fingerprint no longer matches may not be applied.
  context_fingerprint text not null,
  proposal_version text not null,

  locale text not null check (locale in ('en', 'ko')),
  deploy_version text not null check (deploy_version ~ '^[0-9a-f]{40}$'),
  correlation_id uuid not null,

  lifecycle_state text not null default 'started'
    check (lifecycle_state in ('started', 'completed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),

  -- The normalized terminal vocabulary. Every distinction the slice must be able to
  -- reconcile has its own value; none collapses into another.
  outcome text check (outcome is null or outcome in (
    'success',
    'provider_unavailable',
    'provider_timeout',
    'provider_transport_error',
    'provider_http_error',
    'provider_empty_output',
    'provider_malformed_output',
    'validation_refused',
    'stale_context',
    'user_cancelled',
    'internal_failure'
  )),
  -- The validator's stable reject code when outcome = 'validation_refused'.
  refusal_code text check (refusal_code is null or length(refusal_code) <= 60),
  -- Which participant-facing element the refusal was attributed to, when applicable.
  refusal_kind text check (refusal_kind is null or length(refusal_kind) <= 40),

  -- Shape of the accepted proposal. Counts only — never content.
  element_count integer check (element_count is null or element_count >= 0),
  required_kind_count integer check (required_kind_count is null or required_kind_count >= 0),

  -- Did the Host apply it? Authorship and adoption are different questions.
  applied_at timestamptz,

  constraint foundry_program_gen_attempt_lifecycle_consistent check (
    (lifecycle_state = 'started' and outcome is null and finished_at is null)
    or (lifecycle_state = 'completed' and outcome is not null and finished_at is not null)
  ),
  constraint foundry_program_gen_attempt_refusal_consistent check (
    refusal_code is null or outcome = 'validation_refused'
  )
);

comment on table public.foundry_program_generation_attempts is
  'Durable whole-program authorship attempt lifecycle (Slice 3.2L). Service-role writes only. Shape, outcome and cost only — never prompt, response, or participant content.';

create unique index if not exists foundry_program_gen_attempt_intent_uniq
  on public.foundry_program_generation_attempts (owner_user_id, submission_intent_id);

create index if not exists foundry_program_gen_attempt_draft_idx
  on public.foundry_program_generation_attempts (draft_id, started_at desc);

create index if not exists foundry_program_gen_attempt_outcome_idx
  on public.foundry_program_generation_attempts (outcome, started_at desc);

-- ---------------------------------------------------------------------------
-- 2. CHILD — one provider call. A parent may make more than one (bounded retry),
--    and each is accounted separately so cost is attributable.
-- ---------------------------------------------------------------------------
create table if not exists public.foundry_program_generation_attempt_calls (
  id uuid primary key default gen_random_uuid(),

  attempt_id uuid not null
    references public.foundry_program_generation_attempts (id) on delete cascade,

  -- Why this call was made. `authorship` is the first attempt; `authorship_retry` is the
  -- single bounded retry after a present-but-invalid response.
  call_kind text not null check (call_kind in ('authorship', 'authorship_retry')),
  call_sequence integer not null check (call_sequence >= 1 and call_sequence <= 2),

  model text not null,
  provider_timeout_ms integer not null check (provider_timeout_ms > 0),
  structured_output_mode text not null check (structured_output_mode in ('json_object', 'json_schema_strict', 'none')),
  max_tokens integer check (max_tokens is null or max_tokens > 0),

  lifecycle_state text not null default 'prepared'
    check (lifecycle_state in ('prepared', 'in_flight', 'completed')),
  started_at timestamptz not null default now(),
  provider_invoked_at timestamptz,
  finished_at timestamptz,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),

  outcome text check (outcome is null or outcome in (
    'success', 'timeout', 'transport_error', 'http_error',
    'empty_output', 'malformed_output', 'schema_invalid', 'internal_failure'
  )),
  provider_http_status integer check (provider_http_status is null or (provider_http_status between 100 and 599)),
  provider_error_category text check (provider_error_category is null or provider_error_category in (
    'rate_limited', 'unauthorized', 'bad_request', 'server_error', 'network', 'aborted', 'unknown'
  )),
  finish_reason text check (finish_reason is null or length(finish_reason) <= 40),

  -- Cost accounting when the provider reports it.
  prompt_tokens integer check (prompt_tokens is null or prompt_tokens >= 0),
  completion_tokens integer check (completion_tokens is null or completion_tokens >= 0),
  total_tokens integer check (total_tokens is null or total_tokens >= 0),

  -- A DIGEST of the response, never the response. Lets two runs be compared without
  -- storing a single participant-facing sentence.
  response_bytes integer check (response_bytes is null or response_bytes >= 0),
  response_sha256 text check (response_sha256 is null or response_sha256 ~ '^[0-9a-f]{64}$'),

  constraint foundry_program_gen_call_lifecycle_consistent check (
    (lifecycle_state = 'prepared' and provider_invoked_at is null and finished_at is null and outcome is null)
    or (lifecycle_state = 'in_flight' and provider_invoked_at is not null and finished_at is null and outcome is null)
    or (lifecycle_state = 'completed' and provider_invoked_at is not null and finished_at is not null and outcome is not null)
  )
);

comment on table public.foundry_program_generation_attempt_calls is
  'One provider call inside a program authorship attempt (Slice 3.2L). Digest + cost only; never response text.';

create unique index if not exists foundry_program_gen_call_seq_uniq
  on public.foundry_program_generation_attempt_calls (attempt_id, call_sequence);

create index if not exists foundry_program_gen_call_attempt_idx
  on public.foundry_program_generation_attempt_calls (attempt_id, started_at);

-- ---------------------------------------------------------------------------
-- 3. RLS — same posture as every table in this arc: denied outright to clients.
--    Only the service role reads or writes; the product reaches it through
--    owner-scoped server code, never directly.
-- ---------------------------------------------------------------------------
alter table public.foundry_program_generation_attempts enable row level security;
alter table public.foundry_program_generation_attempt_calls enable row level security;

revoke all on public.foundry_program_generation_attempts from public, anon, authenticated;
revoke all on public.foundry_program_generation_attempt_calls from public, anon, authenticated;

grant select, insert, update on public.foundry_program_generation_attempts to service_role;
grant select, insert, update on public.foundry_program_generation_attempt_calls to service_role;

commit;

-- ---------------------------------------------------------------------------
-- ROLLBACK (reviewed, NOT executed):
--   begin;
--   drop table if exists public.foundry_program_generation_attempt_calls;
--   drop table if exists public.foundry_program_generation_attempts;
--   commit;
-- Additive only — dropping these removes observability and nothing else. No practice
-- table, no module draft and no published module is touched by this migration.
-- ---------------------------------------------------------------------------
