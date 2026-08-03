-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- Slice 3.2I-R5B2-R5C-4A2 — atomic SAME-INPUT generation governance.
-- ============================================================================
-- WHY
-- The same unchanged setup was submitted twice, roughly five seconds apart, and both
-- submissions spent provider calls and produced nothing. Nothing prevented a third.
-- The client kept the action available because retriability was unknown to it, which
-- is exactly why the decision cannot live in the client.
--
-- THE SAME-INPUT KEY (measured, not assumed):
--
--     draft_id + generation_input_revision + locale
--
-- `revision` is deliberately absent: R5C-4A measured it as the optimistic-concurrency
-- row token, which bumps on writes that leave the generation input identical.
--
-- LOCALE REUSES THE EXISTING COLUMN. `foundry_practice_generation_attempts.locale`
-- already exists as `text not null check (locale in ('en','ko'))` and is already
-- recorded on every attempt, including both historical rows (`en`). Adding a second
-- locale column would create two fields describing one fact that could later disagree,
-- so no new locale column is defined here.
--
-- THE LEGACY MARKER IS THE EPOCH, NOT THE LOCALE. The two historical attempts have a
-- KNOWN locale and an UNKNOWN epoch (`generation_input_revision is null`, never
-- backfilled). So a NULL EPOCH is what makes an attempt baseline evidence, and while
-- the draft is still at epoch 1 it counts for EVERY requested locale — a Host cannot
-- escape two same-input refusals by switching language. Once a real input edit moves
-- the draft to epoch 2, those rows stop counting and exact epoch+locale matching takes
-- over.
--
-- ACTIVE-ATTEMPT BLOCKING IS DRAFT-GLOBAL, NOT PER-LOCALE: every locale writes to the
-- same `scenario_draft` destination, so two concurrent requests would race to overwrite
-- each other regardless of language.
--
-- ADDITIVE ONLY: three functions and one index. No row is updated, no attempt is
-- backfilled, no child row is touched, no draft content is rewritten, no refusal count
-- is stored, and no trigger is defined.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. THE ONE CLASSIFIER. Both the read path and the admission path call it, so the
--    refusal vocabulary cannot drift into two independently maintained lists.
--
--    A refusal counts only when the INPUT ITSELF failed to produce an acceptable
--    situation. Infrastructure failures do not count: repeating them can genuinely
--    succeed, and blocking a Host for a provider timeout would punish them for an
--    outage.
--
--    EXCLUDED, with source reasons:
--      *_reviewer_terminal_failure — the scenario "was never successfully judged at
--        all"; an execution failure, not a verdict about the input.
--      *_review_authority_failure  — raised BEFORE the request is constructed and
--        before any provider call, so no structured output exists and nothing was
--        spent. It fails deterministically and cheaply on its own.
-- ---------------------------------------------------------------------------
create or replace function public.foundry_practice_generation_refusal_counts_v1(
  p_outcome text,
  p_terminal_reason_code text
) returns boolean
language sql
immutable
set search_path = public, pg_catalog
as $$
  select case
    -- EXACT attribution (R5C-1 onwards) is authoritative when present.
    when p_terminal_reason_code is not null then p_terminal_reason_code in (
      'scenario_quality_rejected',
      'semantic_content_rejected',
      'boundary_content_rejected',
      -- Derived from a VALID structured reviewer response that was uncertain about this
      -- scenario against this boundary — a judgment about the input, not a fault.
      'semantic_review_inconclusive',
      'boundary_review_inconclusive'
    )
    -- LEGACY rows carry no attribution; only their broad outcome can be read.
    else coalesce(p_outcome, '') in (
      'scenario_quality_rejected',
      'boundary_review_rejected'
    )
  end;
$$;

comment on function public.foundry_practice_generation_refusal_counts_v1(text, text) is
  'THE canonical setup-sensitive refusal test (Slice R5C-4A2). Used by BOTH the read-only governance function and the atomic admission function so the vocabulary cannot fork. Infrastructure, transport, schema, persistence, authority and reviewer-terminal failures deliberately do NOT count.';

-- Same-input lookup: the exact shape both functions scan.
create index if not exists foundry_practice_gen_attempt_same_input_idx
  on public.foundry_practice_generation_attempts (draft_id, generation_input_revision, locale, lifecycle_state);

-- Active-attempt lookup is draft-global, so it deliberately omits locale and epoch.
create index if not exists foundry_practice_gen_attempt_active_idx
  on public.foundry_practice_generation_attempts (draft_id)
  where lifecycle_state = 'started';

-- ---------------------------------------------------------------------------
-- 2. READ-ONLY GOVERNANCE. No INSERT, UPDATE or DELETE anywhere in the body.
--
--    `refusal_count` is CAPPED AT 2. The exact number beyond two is an internal
--    detail with no product meaning, and an unbounded count leaving the server would
--    be an invitation to render it.
--
--    A draft that is missing OR owned by someone else produces the SAME result, so a
--    caller cannot probe for the existence of another Host's draft.
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
begin
  if p_locale is null or p_locale not in ('en', 'ko') then
    raise exception 'invalid_generation_locale' using errcode = '22023';
  end if;

  select d.generation_input_revision into v_epoch
    from public.foundry_arena_scenario_drafts d
   where d.id = p_draft_id
     and d.owner_user_id = p_owner_user_id;

  if v_epoch is null then
    -- Not found, or not theirs. Indistinguishable on purpose.
    raise exception 'draft_not_accessible' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.foundry_practice_generation_attempts a
     where a.draft_id = p_draft_id
       and a.lifecycle_state = 'started'
  ) into v_active;

  select least(2, count(*))::integer into v_count
    from public.foundry_practice_generation_attempts a
   where a.draft_id = p_draft_id
     and a.lifecycle_state = 'completed'
     and public.foundry_practice_generation_refusal_counts_v1(a.outcome, a.terminal_reason_code)
     and (
       -- Exact same-input match.
       (a.generation_input_revision = v_epoch and a.locale = p_locale)
       -- BASELINE WILDCARD: an attempt whose epoch was never recorded, while the draft
       -- is still at the baseline epoch. Locale-independent by design, so switching
       -- language cannot bypass historical evidence.
       or (v_epoch = 1 and a.generation_input_revision is null)
     );

  return query select
    v_epoch,
    p_locale,
    v_count,
    case
      when v_active then 'in_progress'
      when v_count >= 2 then 'revision_required'
      when v_count = 1 then 'confirm_second_attempt'
      else 'ready'
    end::text,
    (not v_active and v_count = 0),
    (not v_active and v_count = 1),
    (not v_active and v_count >= 1);
end;
$$;

comment on function public.get_foundry_practice_generation_governance_v1(uuid, uuid, text) is
  'READ-ONLY same-input governance (Slice R5C-4A2). Writes nothing. Returns a bounded structure only: no attempt id, no provider data, no prose. A missing draft and another owner''s draft are indistinguishable.';

-- ---------------------------------------------------------------------------
-- 3. ATOMIC ADMISSION.
--
--    A service-side `SELECT governance` followed by `INSERT attempt` is NOT sufficient:
--    two concurrent requests can both read one refusal, both see acknowledgement, and
--    both insert. The decision and the insertion must be one indivisible step.
--
--    The draft row is locked FOR UPDATE — ONE row, never a global lock, so an unrelated
--    draft is unaffected. Every governance read below happens while that lock is held,
--    which is what makes the second concurrent request observe the first one's attempt.
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
  p_attempt_number integer
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
  v_state text;
  v_id uuid;
begin
  if p_locale is null or p_locale not in ('en', 'ko') then
    raise exception 'invalid_generation_locale' using errcode = '22023';
  end if;
  -- Identity is resolved by the trusted server before this call; a build that cannot
  -- name itself must never reach admission.
  if p_deploy_version is null or p_deploy_version !~ '^[0-9a-f]{40}$' then
    raise exception 'invalid_source_identity' using errcode = '22023';
  end if;

  -- ONE ROW LOCK. Everything below is read under it.
  select d.generation_input_revision, d.revision into v_epoch, v_revision
    from public.foundry_arena_scenario_drafts d
   where d.id = p_draft_id
     and d.owner_user_id = p_owner_user_id
   for update;

  if v_epoch is null then
    raise exception 'draft_not_accessible' using errcode = '42501';
  end if;

  -- A confirmation made for one epoch may never authorize a different one.
  if p_expected_generation_input_revision is null or p_expected_generation_input_revision <> v_epoch then
    return query select false, null::uuid, v_epoch, p_locale, 0, 'input_revision_stale'::text, false, false;
    return;
  end if;

  select exists (
    select 1 from public.foundry_practice_generation_attempts a
     where a.draft_id = p_draft_id
       and a.lifecycle_state = 'started'
  ) into v_active;

  select least(2, count(*))::integer into v_count
    from public.foundry_practice_generation_attempts a
   where a.draft_id = p_draft_id
     and a.lifecycle_state = 'completed'
     and public.foundry_practice_generation_refusal_counts_v1(a.outcome, a.terminal_reason_code)
     and (
       (a.generation_input_revision = v_epoch and a.locale = p_locale)
       or (v_epoch = 1 and a.generation_input_revision is null)
     );

  -- Rule order is the contract: activity first, then the hard block, then confirmation.
  -- Acknowledgement is consulted ONLY in the one-refusal branch, so it can never override
  -- an active attempt, a two-refusal block, a stale epoch or an ownership failure.
  v_state := case
    when v_active then 'in_progress'
    when v_count >= 2 then 'revision_required'
    when v_count = 1 and coalesce(p_confirm_same_input_retry, false) is not true then 'confirm_second_attempt'
    else 'admitted'
  end;

  if v_state <> 'admitted' then
    return query select false, null::uuid, v_epoch, p_locale, v_count, v_state,
                        (v_state = 'confirm_second_attempt'), (v_count >= 1);
    return;
  end if;

  insert into public.foundry_practice_generation_attempts (
    draft_id, draft_revision, generation_input_revision, source_event_id, owner_user_id,
    correlation_id, deploy_version, provider_timeout_ms, model, structured_output_mode,
    max_tokens, boundary_mode, boundary_constraint_count, attempt_number, locale, lifecycle_state
  ) values (
    p_draft_id, v_revision, v_epoch, p_source_event_id, p_owner_user_id,
    p_correlation_id, p_deploy_version, p_provider_timeout_ms, p_model, p_structured_output_mode,
    p_max_tokens, p_boundary_mode, p_boundary_constraint_count, p_attempt_number, p_locale, 'started'
  )
  returning id into v_id;

  return query select true, v_id, v_epoch, p_locale, v_count, 'admitted'::text, false, (v_count >= 1);
end;
$$;

comment on function public.start_foundry_practice_generation_attempt_governed_v1 is
  'ATOMIC governed admission (Slice R5C-4A2). Locks ONE draft row FOR UPDATE, then decides and inserts in the same indivisible step — a service-side read-then-insert would let two concurrent confirmed requests both admit. Acknowledgement is consulted only in the one-refusal branch and can never override an active attempt, a two-refusal block, a stale epoch or an ownership failure.';

-- ---------------------------------------------------------------------------
-- Same posture as every table in this arc: NO client may execute these. The service
-- role is the only caller, exactly as it is the only writer of the underlying rows.
-- ---------------------------------------------------------------------------
revoke all on function public.foundry_practice_generation_refusal_counts_v1(text, text) from public, anon, authenticated;
revoke all on function public.get_foundry_practice_generation_governance_v1(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.start_foundry_practice_generation_attempt_governed_v1(
  uuid, uuid, integer, text, boolean, uuid, uuid, text, integer, text, text, integer, text, integer, integer
) from public, anon, authenticated;

grant execute on function public.foundry_practice_generation_refusal_counts_v1(text, text) to service_role;
grant execute on function public.get_foundry_practice_generation_governance_v1(uuid, uuid, text) to service_role;
grant execute on function public.start_foundry_practice_generation_attempt_governed_v1(
  uuid, uuid, integer, text, boolean, uuid, uuid, text, integer, text, text, integer, text, integer, integer
) to service_role;

-- ---------------------------------------------------------------------------
-- ROLLBACK (reviewed, NOT executed). Dropping these returns admission to the
-- non-atomic read-then-insert that two concurrent requests can both pass:
--
--   drop function if exists public.start_foundry_practice_generation_attempt_governed_v1(
--     uuid, uuid, integer, text, boolean, uuid, uuid, text, integer, text, text, integer, text, integer, integer);
--   drop function if exists public.get_foundry_practice_generation_governance_v1(uuid, uuid, text);
--   drop function if exists public.foundry_practice_generation_refusal_counts_v1(text, text);
--   drop index if exists public.foundry_practice_gen_attempt_active_idx;
--   drop index if exists public.foundry_practice_gen_attempt_same_input_idx;
-- ---------------------------------------------------------------------------
