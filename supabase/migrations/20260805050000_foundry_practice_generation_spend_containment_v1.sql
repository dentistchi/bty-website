-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- Slice 3.2I-R5B2-R5C-6A — repeated-spend containment and submission intent.
-- ============================================================================
-- WHY
-- The first controlled generation window authorized ONE submission. Two occurred, ~3
-- minutes apart, each spending three provider calls and ~93 seconds to reach the same
-- refusal. Reconciliation could not say why, because nothing durable identified a
-- SUBMISSION as opposed to an ATTEMPT.
--
-- Both attempts ended in `semantic_reviewer_terminal_failure`: the semantic reviewer
-- returned schema-invalid output, with distinct digests each time. That is a failure of
-- the evaluator, not a judgment about the Host's setup — and the classifier correctly
-- declined to count it as a setup refusal, which left governance `ready` and the Create
-- button live. Correct blame, unsafe outcome.
--
-- MEASURED RATE, not assumed: across every attempt to date the semantic reviewer has
-- succeeded ONCE in SEVEN calls. It is predominantly failing, not strictly deterministic,
-- so the block below is a spending guard rather than a verdict that retry is impossible.
--
-- THREE PROTECTIONS, none of which repairs the reviewer (out of scope here):
--
--   1. SYSTEM BLOCK  — a reviewer that cannot evaluate stops further spending, without
--                      telling the Host their setup is at fault.
--   2. SUBMISSION INTENT — one explicit user action owns one durable identity, so a
--                      re-delivery of the same instruction can never buy a second run.
--   3. OUTCOME CONSISTENCY — a semantic-stage failure may no longer be recorded under a
--                      boundary umbrella.
--
-- ⚠️ SCOPE DEVIATION, DELIBERATE AND REPORTED. The brief preferred scoping the system
-- block to (draft + deployed source commit), so a new deployment clears it. Applied
-- literally that is self-defeating HERE: this migration ships a new commit and does NOT
-- repair the reviewer, so a commit-scoped block would clear itself on the very deploy
-- that introduces it and re-open unlimited spending against a still-broken evaluator.
-- The brief's own acceptance criterion (the captured draft must read `system_blocked`
-- AFTER this deployment) is only satisfiable by the draft-scoped rule implemented here.
-- It therefore does NOT auto-clear on deploy; the reviewer-repair slice must clear it
-- explicitly, and that is the safe direction to be wrong in.
--
-- ADDITIVE ONLY: one column, one partial unique index, one widened outcome vocabulary,
-- and revised functions. No historical row is updated or backfilled.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. SUBMISSION INTENT — one explicit user action, one durable identity.
--
--    NULLABLE: the four existing attempts predate the contract and are never backfilled.
--    The partial UNIQUE index is the whole mechanism — a second delivery of the same
--    intent cannot insert, no matter how many requests race.
-- ---------------------------------------------------------------------------
alter table public.foundry_practice_generation_attempts
  add column if not exists submission_intent_id uuid null;

comment on column public.foundry_practice_generation_attempts.submission_intent_id is
  'One explicit Host instruction to create a practice situation (Slice R5C-6A). NULL only for attempts predating the contract. Scoped UNIQUE per owner, so a re-delivered instruction can never buy a second generation.';

create unique index if not exists foundry_practice_gen_attempt_intent_uniq
  on public.foundry_practice_generation_attempts (owner_user_id, submission_intent_id)
  where submission_intent_id is not null;

-- ---------------------------------------------------------------------------
-- 2. TERMINAL OUTCOME CONSISTENCY.
--
--    `review_execution_failed` joins the vocabulary, and a new CHECK makes the measured
--    contradiction unrepresentable for FUTURE rows: a semantic-stage terminal reviewer
--    failure can no longer be written as `boundary_review_rejected`.
--
--    The two live rows that carry that contradiction are NOT updated. They are the
--    evidence, and the constraint is written so their existing shape still validates.
-- ---------------------------------------------------------------------------
alter table public.foundry_practice_generation_attempts
  drop constraint if exists foundry_practice_generation_attempts_outcome_check;

alter table public.foundry_practice_generation_attempts
  add constraint foundry_practice_generation_attempts_outcome_check
  check (outcome is null or outcome in (
    'success',
    'provider_timeout',
    'provider_transport_error',
    'provider_http_error',
    'provider_empty_output',
    'provider_malformed_output',
    'provider_schema_invalid',
    'scenario_quality_rejected',
    'boundary_review_rejected',
    'review_execution_failed',
    'scenario_persistence_failed',
    'internal_failure'
  ));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.foundry_practice_generation_attempts'::regclass
      and conname = 'foundry_practice_gen_attempt_review_exec_chk'
  ) then
    alter table public.foundry_practice_generation_attempts
      add constraint foundry_practice_gen_attempt_review_exec_chk
      -- NOT VALID: the two live rows recorded under the old mapping stay exactly as they
      -- are, while every future write is checked. Validating would require mutating
      -- historical evidence, which no slice in this arc is permitted to do.
      check (
        terminal_reason_code is null
        or terminal_reason_code not in ('reviewer_terminal_failure', 'semantic_reviewer_terminal_failure', 'boundary_reviewer_terminal_failure')
        or outcome = 'review_execution_failed'
      ) not valid;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. THE SYSTEM-BLOCK TEST. One helper, called by both governance functions.
--
--    Source-proven membership only: a reviewer that exhausted its budget without ever
--    returning a usable verdict. A content refusal, an inconclusive verdict, a transient
--    provider fault and a persistence failure are all deliberately excluded — none of
--    them means the evaluator is broken.
-- ---------------------------------------------------------------------------
create or replace function public.foundry_practice_generation_is_system_block_v1(
  p_outcome text,
  p_terminal_reason_code text
) returns boolean
language sql
immutable
set search_path = public, pg_catalog
as $$
  select coalesce(p_terminal_reason_code, '') in (
    'semantic_reviewer_terminal_failure',
    'boundary_reviewer_terminal_failure'
  )
  or coalesce(p_outcome, '') = 'review_execution_failed';
$$;

comment on function public.foundry_practice_generation_is_system_block_v1(text, text) is
  'Did the review SYSTEM fail to evaluate (Slice R5C-6A)? Never a setup refusal: the Host is not at fault and reviewing their setup will not clear it. Used by BOTH governance functions so the vocabulary cannot fork.';

create index if not exists foundry_practice_gen_attempt_sysblock_idx
  on public.foundry_practice_generation_attempts (draft_id)
  where lifecycle_state = 'completed';

-- ---------------------------------------------------------------------------
-- 4. READ-ONLY GOVERNANCE, revised.
--
--    PRECEDENCE: in_progress → system_blocked → revision_required →
--    confirm_second_attempt → ready. The system block outranks the setup states because
--    a Host cannot fix an evaluator by editing their answers, and it is DRAFT-scoped —
--    neither a locale switch nor a cosmetic setup save nor a new epoch clears it.
-- ---------------------------------------------------------------------------
create or replace function public.get_foundry_practice_generation_governance_v1(
  p_draft_id uuid,
  p_owner_user_id uuid,
  p_locale text
) returns table (
  generation_input_revision integer,
  generation_locale text,
  refusal_count integer,
  state text,
  can_start_generation boolean,
  requires_explicit_confirmation boolean,
  review_setup_recommended boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_epoch integer;
  v_active boolean;
  v_count integer;
  v_system_blocked boolean;
begin
  if p_locale is null or p_locale not in ('en', 'ko') then
    raise exception 'invalid_generation_locale' using errcode = '22023';
  end if;

  select d.generation_input_revision into v_epoch
    from public.foundry_arena_scenario_drafts d
   where d.id = p_draft_id and d.owner_user_id = p_owner_user_id;

  if v_epoch is null then
    raise exception 'draft_not_accessible' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.foundry_practice_generation_attempts a
     where a.draft_id = p_draft_id and a.lifecycle_state = 'started'
  ) into v_active;

  -- DRAFT-scoped, locale- and epoch-independent: the evaluator does not become healthy
  -- because the Host asked in another language or edited a sentence.
  select exists (
    select 1 from public.foundry_practice_generation_attempts a
     where a.draft_id = p_draft_id
       and a.lifecycle_state = 'completed'
       and public.foundry_practice_generation_is_system_block_v1(a.outcome, a.terminal_reason_code)
  ) into v_system_blocked;

  select least(2, count(*))::integer into v_count
    from public.foundry_practice_generation_attempts a
   where a.draft_id = p_draft_id
     and a.lifecycle_state = 'completed'
     and public.foundry_practice_generation_refusal_counts_v1(a.outcome, a.terminal_reason_code)
     and (
       (a.generation_input_revision = v_epoch and a.locale = p_locale)
       or (v_epoch = 1 and a.generation_input_revision is null)
     );

  return query select
    v_epoch,
    p_locale,
    v_count,
    case
      when v_active then 'in_progress'
      when v_system_blocked then 'system_blocked'
      when v_count >= 2 then 'revision_required'
      when v_count = 1 then 'confirm_second_attempt'
      else 'ready'
    end::text,
    (not v_active and not v_system_blocked and v_count = 0),
    (not v_active and not v_system_blocked and v_count = 1),
    -- NOT recommended under a system block: reviewing the setup will not clear it, and
    -- saying otherwise would send a Host to rewrite answers that were never the problem.
    (not v_active and not v_system_blocked and v_count >= 1);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. ATOMIC ADMISSION, revised: submission-intent dedup FIRST, then governance.
--
--    Intent is checked before anything else, because a re-delivered instruction must
--    return the original result even when governance has since changed — otherwise a
--    lost response would be answered with a refusal the Host never earned.
-- ---------------------------------------------------------------------------
create or replace function public.start_foundry_practice_generation_attempt_governed_v1(
  p_draft_id uuid,
  p_owner_user_id uuid,
  p_expected_generation_input_revision integer,
  p_locale text,
  p_confirm_same_input_retry boolean,
  p_source_event_id uuid,
  p_correlation_id uuid,
  p_deploy_version text,
  p_provider_timeout_ms integer,
  p_model text,
  p_structured_output_mode text,
  p_max_tokens integer,
  p_boundary_mode text,
  p_boundary_constraint_count integer,
  p_attempt_number integer,
  p_submission_intent_id uuid default null
) returns table (
  admitted boolean,
  attempt_id uuid,
  generation_input_revision integer,
  generation_locale text,
  refusal_count integer,
  state text,
  requires_explicit_confirmation boolean,
  review_setup_recommended boolean
)
language plpgsql
volatile
security definer
set search_path = public, pg_catalog
as $$
declare
  v_epoch integer;
  v_revision integer;
  v_active boolean;
  v_count integer;
  v_system_blocked boolean;
  v_state text;
  v_id uuid;
  v_existing public.foundry_practice_generation_attempts%rowtype;
begin
  if p_locale is null or p_locale not in ('en', 'ko') then
    raise exception 'invalid_generation_locale' using errcode = '22023';
  end if;
  if p_deploy_version is null or p_deploy_version !~ '^[0-9a-f]{40}$' then
    raise exception 'invalid_source_identity' using errcode = '22023';
  end if;
  if p_submission_intent_id is null then
    raise exception 'missing_submission_intent' using errcode = '22023';
  end if;

  -- ONE ROW LOCK. Everything below is decided under it.
  select d.generation_input_revision, d.revision into v_epoch, v_revision
    from public.foundry_arena_scenario_drafts d
   where d.id = p_draft_id and d.owner_user_id = p_owner_user_id
   for update;

  if v_epoch is null then
    raise exception 'draft_not_accessible' using errcode = '42501';
  end if;

  -- ---- IDEMPOTENCY FIRST -------------------------------------------------
  -- Works whether the original is still running or already finished, and spends nothing
  -- either way.
  select * into v_existing
    from public.foundry_practice_generation_attempts a
   where a.owner_user_id = p_owner_user_id
     and a.submission_intent_id = p_submission_intent_id
   limit 1;

  if found then
    return query select false, null::uuid, v_epoch, p_locale, 0,
                        'duplicate_existing_intent'::text, false, false;
    return;
  end if;

  if p_expected_generation_input_revision is null or p_expected_generation_input_revision <> v_epoch then
    return query select false, null::uuid, v_epoch, p_locale, 0, 'input_revision_stale'::text, false, false;
    return;
  end if;

  select exists (
    select 1 from public.foundry_practice_generation_attempts a
     where a.draft_id = p_draft_id and a.lifecycle_state = 'started'
  ) into v_active;

  select exists (
    select 1 from public.foundry_practice_generation_attempts a
     where a.draft_id = p_draft_id
       and a.lifecycle_state = 'completed'
       and public.foundry_practice_generation_is_system_block_v1(a.outcome, a.terminal_reason_code)
  ) into v_system_blocked;

  select least(2, count(*))::integer into v_count
    from public.foundry_practice_generation_attempts a
   where a.draft_id = p_draft_id
     and a.lifecycle_state = 'completed'
     and public.foundry_practice_generation_refusal_counts_v1(a.outcome, a.terminal_reason_code)
     and (
       (a.generation_input_revision = v_epoch and a.locale = p_locale)
       or (v_epoch = 1 and a.generation_input_revision is null)
     );

  -- Acknowledgement is consulted ONLY in the one-refusal branch, so it can never override
  -- an active attempt, a system block or a two-refusal block.
  v_state := case
    when v_active then 'in_progress'
    when v_system_blocked then 'system_blocked'
    when v_count >= 2 then 'revision_required'
    when v_count = 1 and coalesce(p_confirm_same_input_retry, false) is not true then 'confirm_second_attempt'
    else 'admitted'
  end;

  if v_state <> 'admitted' then
    return query select false, null::uuid, v_epoch, p_locale, v_count, v_state,
                        (v_state = 'confirm_second_attempt'),
                        (v_state <> 'system_blocked' and v_count >= 1);
    return;
  end if;

  insert into public.foundry_practice_generation_attempts (
    draft_id, draft_revision, generation_input_revision, source_event_id, owner_user_id,
    correlation_id, deploy_version, provider_timeout_ms, model, structured_output_mode,
    max_tokens, boundary_mode, boundary_constraint_count, attempt_number, locale,
    lifecycle_state, submission_intent_id
  ) values (
    p_draft_id, v_revision, v_epoch, p_source_event_id, p_owner_user_id,
    p_correlation_id, p_deploy_version, p_provider_timeout_ms, p_model, p_structured_output_mode,
    p_max_tokens, p_boundary_mode, p_boundary_constraint_count, p_attempt_number, p_locale,
    'started', p_submission_intent_id
  )
  returning id into v_id;

  return query select true, v_id, v_epoch, p_locale, v_count, 'admitted'::text, false, (v_count >= 1);
exception
  when unique_violation then
    -- The partial unique index caught a concurrent delivery of the SAME intent. The other
    -- transaction won; this one spends nothing and reports the duplicate.
    return query select false, null::uuid, v_epoch, p_locale, 0,
                        'duplicate_existing_intent'::text, false, false;
end;
$$;

-- ---------------------------------------------------------------------------
-- Same posture as every function in this arc: service role only.
-- ---------------------------------------------------------------------------
revoke all on function public.foundry_practice_generation_is_system_block_v1(text, text) from public, anon, authenticated;
revoke all on function public.get_foundry_practice_generation_governance_v1(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.start_foundry_practice_generation_attempt_governed_v1(
  uuid, uuid, integer, text, boolean, uuid, uuid, text, integer, text, text, integer, text, integer, integer, uuid
) from public, anon, authenticated;

grant execute on function public.foundry_practice_generation_is_system_block_v1(text, text) to service_role;
grant execute on function public.get_foundry_practice_generation_governance_v1(uuid, uuid, text) to service_role;
grant execute on function public.start_foundry_practice_generation_attempt_governed_v1(
  uuid, uuid, integer, text, boolean, uuid, uuid, text, integer, text, text, integer, text, integer, integer, uuid
) to service_role;

-- The 15-argument signature is superseded by the 16-argument one; dropping it prevents a
-- caller reaching admission WITHOUT a submission intent.
drop function if exists public.start_foundry_practice_generation_attempt_governed_v1(
  uuid, uuid, integer, text, boolean, uuid, uuid, text, integer, text, text, integer, text, integer, integer
);

-- ---------------------------------------------------------------------------
-- ROLLBACK (reviewed, NOT executed):
--   drop index if exists public.foundry_practice_gen_attempt_intent_uniq;
--   drop index if exists public.foundry_practice_gen_attempt_sysblock_idx;
--   alter table public.foundry_practice_generation_attempts
--     drop constraint if exists foundry_practice_gen_attempt_review_exec_chk,
--     drop column if exists submission_intent_id;
--   drop function if exists public.foundry_practice_generation_is_system_block_v1(text, text);
-- ---------------------------------------------------------------------------
