-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- Slice 3.2I-R5B2-R5C-2 — per-PROVIDER-CALL accounting V1.
-- ============================================================================
-- WHY
-- R5A/R5C-1 made the product SUBMISSION observable. R5C then measured that one
-- submission can execute up to FOURTEEN external model calls across four product
-- call sites, and the parent row records none of them: `attempt_number` is a
-- constant, not a count. So R5B could not say how many calls its two attempts
-- made, which one failed, or whether both received identical model content.
--
-- One row here is exactly ONE external model network call.
--
-- THE LIFECYCLE IS THE POINT. `prepared` proves a call was planned; only
-- `provider_invoked_at` proves one was actually made. The authoritative count of
-- provider invocations is therefore
--
--     count(*) where provider_invoked_at is not null
--
-- and never the row count, the parent `attempt_number`, a retry index, or the
-- number of completed rows. A row left `in_flight` is a call whose answer was
-- lost — the shape console logging could never leave behind.
--
-- A provider call that RETURNS parseable content is `success` here even when a
-- product evaluator later refuses that content. Downstream rejection is the
-- parent's attribution, not a provider-call failure. Conflating them is how a
-- reviewer refusal came to look like an infrastructure fault in R5B.
--
-- ADDITIVE ONLY: one new table. No parent row is read, updated or backfilled;
-- the two historical attempts legitimately own zero children, and their real call
-- counts remain permanently unknown.
--
-- PRIVACY: identifiers, closed vocabularies, numbers, timestamps and hashes only.
-- No prompt, response, scenario, reviewer or boundary content; no headers, no
-- error bodies, no credentials, no stack traces, and no generic JSON blob.
-- ============================================================================

create table if not exists public.foundry_practice_generation_attempt_calls (
  id uuid primary key default gen_random_uuid(),

  -- ---- relationship -------------------------------------------------------
  -- A call has no meaning without the submission it belongs to, and the parent is
  -- already CASCADE-scoped to its draft, so the same lifetime is carried down.
  attempt_id uuid not null
    references public.foundry_practice_generation_attempts (id) on delete cascade,

  -- ---- identity within the submission -------------------------------------
  call_kind text not null check (call_kind in (
    'generation',
    'boundary_review',
    -- Deliberately NOT merged with boundary_review: they are separate measured
    -- call sites and answer different forensic questions.
    'boundary_repair',
    'semantic_review'
  )),
  -- 1..N across every provider call in the submission, in real execution order.
  global_sequence integer not null check (global_sequence between 1 and 64),
  -- 1..N independently within each kind.
  kind_sequence integer not null check (kind_sequence between 1 and 64),

  -- ---- lifecycle ----------------------------------------------------------
  lifecycle_state text not null default 'prepared'
    check (lifecycle_state in ('prepared', 'in_flight', 'completed')),
  created_at timestamptz not null default now(),
  -- THE field that distinguishes a planned call from a real one.
  provider_invoked_at timestamptz null,
  finished_at timestamptz null,
  duration_ms integer null check (duration_ms is null or duration_ms >= 0),

  -- ---- request shape, never prose -----------------------------------------
  model text not null,
  provider_timeout_ms integer not null check (provider_timeout_ms > 0),
  max_tokens integer null check (max_tokens is null or max_tokens > 0),
  temperature numeric null check (temperature is null or (temperature >= 0 and temperature <= 2)),
  top_p numeric null check (top_p is null or (top_p >= 0 and top_p <= 1)),
  structured_output_mode text not null
    check (structured_output_mode in ('json_schema_strict', 'none')),
  locale text null check (locale is null or locale in ('en', 'ko')),

  -- ---- terminal outcome ---------------------------------------------------
  outcome text null check (outcome is null or outcome in (
    'success',
    'timeout',
    'transport_error',
    'http_error',
    'empty_output',
    'malformed_output',
    'schema_invalid',
    'internal_failure'
  )),
  provider_http_status integer null
    check (provider_http_status is null or provider_http_status between 100 and 599),
  provider_error_category text null check (
    provider_error_category is null
    or provider_error_category in ('rate_limited', 'unauthorized', 'bad_request', 'server_error', 'network', 'aborted', 'unknown')
  ),

  -- ---- response identity, never the response ------------------------------
  -- The digest boundary is declared, not implied, so two rows are only ever
  -- compared when they were hashed the same way.
  response_digest_scope text null
    check (response_digest_scope is null or response_digest_scope in ('model_content_utf8')),
  response_byte_count integer null check (response_byte_count is null or response_byte_count >= 0),
  response_sha256 text null check (response_sha256 is null or response_sha256 ~ '^[0-9a-f]{64}$'),
  finish_reason text null check (finish_reason is null or length(finish_reason) <= 40),
  prompt_tokens integer null check (prompt_tokens is null or prompt_tokens >= 0),
  completion_tokens integer null check (completion_tokens is null or completion_tokens >= 0),
  total_tokens integer null check (total_tokens is null or total_tokens >= 0),

  -- ---- lifecycle consistency ----------------------------------------------
  -- `prepared` has not reached the provider; `in_flight` has, and has no answer
  -- yet; `completed` has an answer and a finish time. A NULL can therefore never
  -- mean two different things.
  constraint foundry_practice_gen_call_lifecycle_chk check (
    (lifecycle_state = 'prepared' and provider_invoked_at is null and finished_at is null and outcome is null)
    or (lifecycle_state = 'in_flight' and provider_invoked_at is not null and finished_at is null and outcome is null)
    or (lifecycle_state = 'completed' and provider_invoked_at is not null and finished_at is not null and outcome is not null)
  ),
  -- Response identity travels as a unit or not at all.
  constraint foundry_practice_gen_call_digest_chk check (
    (response_sha256 is null and response_digest_scope is null and response_byte_count is null)
    or (response_sha256 is not null and response_digest_scope is not null and response_byte_count is not null)
  ),
  -- Only a real HTTP answer may carry a status.
  constraint foundry_practice_gen_call_http_chk check (
    provider_http_status is null or outcome in ('http_error', 'success')
  ),
  -- A call that never produced content cannot claim a digest.
  constraint foundry_practice_gen_call_content_chk check (
    response_sha256 is null or outcome in ('success', 'malformed_output', 'schema_invalid')
  ),

  -- Corruption of the request-owned sequence is rejected by the database.
  constraint foundry_practice_gen_call_global_seq_uniq unique (attempt_id, global_sequence),
  constraint foundry_practice_gen_call_kind_seq_uniq unique (attempt_id, call_kind, kind_sequence)
);

comment on table public.foundry_practice_generation_attempt_calls is
  'One row per EXTERNAL MODEL CALL under a Practice generation attempt (Slice R5C-2). Service-role writes only. The authoritative provider-invocation count is count(*) where provider_invoked_at is not null — never the row count.';
comment on column public.foundry_practice_generation_attempt_calls.provider_invoked_at is
  'Set immediately BEFORE the network call. Its presence is the only proof a provider call actually happened.';

create index if not exists foundry_practice_gen_call_attempt_idx
  on public.foundry_practice_generation_attempt_calls (attempt_id, global_sequence);
create index if not exists foundry_practice_gen_call_kind_idx
  on public.foundry_practice_generation_attempt_calls (call_kind, created_at desc);
create index if not exists foundry_practice_gen_call_invoked_idx
  on public.foundry_practice_generation_attempt_calls (provider_invoked_at desc)
  where provider_invoked_at is not null;
-- Orphans: a call that reached the provider and never came back.
create index if not exists foundry_practice_gen_call_inflight_idx
  on public.foundry_practice_generation_attempt_calls (created_at desc)
  where lifecycle_state = 'in_flight';

-- ---------------------------------------------------------------------------
-- Same posture as the parent: RLS on, every client grant revoked, NO permissive
-- policy. A product client cannot enumerate calls — including its own.
-- ---------------------------------------------------------------------------
revoke all on public.foundry_practice_generation_attempt_calls from anon, public, authenticated;
alter table public.foundry_practice_generation_attempt_calls enable row level security;

-- ---------------------------------------------------------------------------
-- ROLLBACK (reviewed, NOT executed). Dropping the table discards all per-call
-- evidence and leaves the parent attempts intact:
--
--   drop index if exists public.foundry_practice_gen_call_inflight_idx;
--   drop index if exists public.foundry_practice_gen_call_invoked_idx;
--   drop index if exists public.foundry_practice_gen_call_kind_idx;
--   drop index if exists public.foundry_practice_gen_call_attempt_idx;
--   drop table if exists public.foundry_practice_generation_attempt_calls;
-- ---------------------------------------------------------------------------
