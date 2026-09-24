-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- =============================================================================
-- Practice generation — SYSTEM-BLOCK RECOVERY AUTHORITY. V1
--
-- PRODUCTION-EFFECTIVE. Idempotent, replay-safe, ADDITIVE ONLY: one new table,
-- one new helper, one new RPC, and two governance functions replaced in place.
-- No historical row is updated, deleted or backfilled.
--
-- WHY THIS EXISTS, AND WHO ASKED FOR IT. `20260805050000` deliberately made the
-- system block DRAFT-scoped rather than deploy-scoped, and said so in its own
-- header: "It therefore does NOT auto-clear on deploy; the reviewer-repair slice
-- must clear it explicitly, and that is the safe direction to be wrong in."
-- This is that slice. It does not weaken the block; it gives the repair a way to
-- be acknowledged by a named operator at a named time.
--
-- THE FAILED ATTEMPT IS EVIDENCE, AND EVIDENCE IS NOT EDITED. No `cleared` flag
-- is written onto the attempt. Recovery is a SEPARATE append-only assertion, so
-- the record that generation failed under a particular deploy survives intact and
-- remains auditable forever.
--
-- ONE RECOVERY PER FAILURE, BY CONSTRUCTION. The admission clause is keyed on the
-- attempt id, so recovering attempt A says nothing about a later attempt B. There
-- is no "this draft is recovered" state that could outlive the failure it names.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.recover_foundry_practice_generation_system_block_v1(uuid, uuid, uuid, text, text, text, text);
--   DROP FUNCTION IF EXISTS public.foundry_practice_generation_active_system_block_v1(uuid);
--   DROP TABLE IF EXISTS public.foundry_practice_generation_system_block_recoveries;
--   -- and re-apply the function bodies from 20260805050000 / 20260806000000.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. THE RECOVERY RECORD. Append-only; there is no product path that updates or
--    deletes one.
-- ---------------------------------------------------------------------------
create table if not exists public.foundry_practice_generation_system_block_recoveries (
  id uuid primary key default gen_random_uuid(),

  -- The ONE failure this authorization names. Unique, so an operator pressing twice
  -- makes one recovery and the FIRST granter stays authoritative.
  blocked_attempt_id uuid not null
    references public.foundry_practice_generation_attempts (id) on delete cascade,

  -- Denormalised for the operator projection. The attempt is still the authority on
  -- which draft it belonged to; the RPC proves the two agree before inserting.
  draft_id uuid not null
    references public.foundry_arena_scenario_drafts (id) on delete cascade,

  granted_by_user_id uuid not null,
  granted_at timestamptz not null default now(),

  recovery_reason_code text not null,

  /*
    THE OPERATOR'S ASSERTION, NOT A PROOF. This records which runtime the operator
    believes carries the repair. The RPC checks only that the runtime CHANGED since
    the failure — it cannot and must not claim the fix is verified.
  */
  fixed_in_deploy_sha text not null,
  support_reference text null,
  recovery_contract_version integer not null,

  constraint foundry_practice_gen_recovery_unique_attempt unique (blocked_attempt_id),
  constraint foundry_practice_gen_recovery_deploy_sha_chk
    check (fixed_in_deploy_sha ~ '^[0-9a-f]{40}$'),
  -- Same shape the attempt's own `support_reference` uses, so an operator can paste
  -- the one the Host was shown.
  constraint foundry_practice_gen_recovery_support_ref_chk
    check (support_reference is null or support_reference ~ '^[0-9a-f]{12}$'),
  constraint foundry_practice_gen_recovery_reason_code_chk
    check (char_length(btrim(recovery_reason_code)) between 1 and 80),
  constraint foundry_practice_gen_recovery_contract_version_chk
    check (recovery_contract_version = 1)
);

comment on table public.foundry_practice_generation_system_block_recoveries is
  'A platform admin acknowledged that ONE system-block attempt was caused by a defect since repaired, so that attempt no longer blocks its draft. Append-only: the failed attempt is never modified, and this table is its own audit — there is exactly one write per attempt and no revocation, so there is no state transition a separate audit log could record.';

create index if not exists foundry_practice_gen_recovery_draft_idx
  on public.foundry_practice_generation_system_block_recoveries (draft_id, granted_at desc);

-- SERVER ONLY, matching the attempts table this governs.
revoke all on public.foundry_practice_generation_system_block_recoveries from anon, public, authenticated;
alter table public.foundry_practice_generation_system_block_recoveries enable row level security;

-- ---------------------------------------------------------------------------
-- 2. THE SHARED TEST. One helper, called by BOTH governance functions.
--
--    `20260805050000` established this pattern for `is_system_block_v1` so "the
--    vocabulary cannot fork". The recovery clause needs the same protection and for
--    a sharper reason: the two governance functions' LATEST definitions live in
--    DIFFERENT migrations, so a clause duplicated by hand can disagree while both
--    files still read correctly on their own.
-- ---------------------------------------------------------------------------
create or replace function public.foundry_practice_generation_active_system_block_v1(
  p_draft_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
      from public.foundry_practice_generation_attempts a
     where a.draft_id = p_draft_id
       and a.lifecycle_state = 'completed'
       and public.foundry_practice_generation_is_system_block_v1(a.outcome, a.terminal_reason_code)
       and not exists (
         select 1
           from public.foundry_practice_generation_system_block_recoveries r
          where r.blocked_attempt_id = a.id
       )
  );
$$;

comment on function public.foundry_practice_generation_active_system_block_v1(uuid) is
  'Does this draft carry a system-block attempt that has NOT been recovered? DRAFT-scoped and epoch- and locale-independent, exactly as before: an evaluator does not become healthy because the Host asked in another language. Recovery is keyed on the attempt id, so acknowledging one failure can never acknowledge a later one.';

-- ---------------------------------------------------------------------------
-- 3. THE READ-ONLY GOVERNANCE, replaced.
--
--    Body copied from its LATEST definition (20260805050000). The ONLY change is
--    that `v_system_blocked` now asks the shared helper. Precedence is byte-identical:
--    in_progress -> system_blocked -> revision_required -> confirm_second_attempt -> ready.
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
  -- because the Host asked in another language or edited a sentence. A RECOVERED block
  -- no longer counts; every unrecovered one still does.
  v_system_blocked := public.foundry_practice_generation_active_system_block_v1(p_draft_id);

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
-- 4. THE ADMITTING FUNCTION, replaced.
--
--    ⚠️ Body copied from its LATEST definition (20260806000000), NOT from
--    20260805050000. Everything that migration added is preserved verbatim:
--    idempotency-first on submission intent, the stale-epoch branch, the
--    no-default 16th parameter, and the unique_violation handler. The ONLY change
--    is the `v_system_blocked` assignment.
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
  -- NO DEFAULT — deliberately, and the reason was measured in production. A trailing
  -- default makes this 16-argument function ALSO answer a 15-argument call, which made
  -- PostgREST refuse to choose between this and the legacy overload (PGRST203) and broke
  -- live admission. Direct SQL never reproduced it, because positional calls resolve
  -- unambiguously; only the application transport showed it. Carried forward unchanged.
  p_submission_intent_id uuid
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

  -- A RECOVERED block no longer counts; every unrecovered one still does. Same helper the
  -- read-only governance uses, so the Host can never be told `ready` by one path while the
  -- other still refuses to admit.
  v_system_blocked := public.foundry_practice_generation_active_system_block_v1(p_draft_id);

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
-- 5. THE RECOVERY WRITE. Exactly once per blocked attempt.
--
--    EVERY ELIGIBILITY RULE LIVES HERE, not in the caller. The route is a
--    transport; if the checks lived above it, a second caller could be written
--    that skipped them and nothing in the database would object.
--
--    THE AUTHORITY IS NOT CHECKED HERE, DELIBERATELY. Platform-admin authority is a
--    session fact the database cannot see, so it is enforced by `requirePlatformAdmin`
--    before this is called, and `p_granted_by_user_id` is the server-derived id it
--    resolved. This function is service-role only and reachable no other way.
-- ---------------------------------------------------------------------------
create or replace function public.recover_foundry_practice_generation_system_block_v1(
  p_draft_id uuid,
  p_blocked_attempt_id uuid,
  p_granted_by_user_id uuid,
  p_recovery_reason_code text,
  p_fixed_in_deploy_sha text,
  p_current_deploy_sha text,
  p_support_reference text default null
) returns table (
  /*
    OUT PARAMETER NAMES ARE DELIBERATELY NOT COLUMN NAMES. A SECURITY DEFINER plpgsql
    function whose OUT params shadow columns it also references raises 42702 "column
    reference is ambiguous" at RUNTIME only — mocked-RPC tests never see it. Measured
    once already in this codebase; renamed here rather than relying on
    `#variable_conflict`.
  */
  recovery_id uuid,
  recovered_attempt_id uuid,
  recovered_draft_id uuid,
  recovered_at timestamptz,
  already_recovered boolean
)
language plpgsql
volatile
security definer
set search_path = public, pg_catalog
as $$
declare
  v_attempt public.foundry_practice_generation_attempts%rowtype;
  v_row public.foundry_practice_generation_system_block_recoveries%rowtype;
  -- ROW_COUNT is an integer; assigning it straight to a boolean is a type error.
  v_inserted_rows integer := 0;
begin
  if p_granted_by_user_id is null then
    raise exception 'missing_granter' using errcode = '22023';
  end if;
  if p_recovery_reason_code is null or char_length(btrim(p_recovery_reason_code)) = 0 then
    raise exception 'missing_recovery_reason_code' using errcode = '22023';
  end if;

  /*
    SOURCE IDENTITY, FAIL CLOSED. An absent or malformed runtime identity means we cannot
    tell whether anything changed since the failure, and "we do not know" must never be
    treated as "it is fine".
  */
  if p_current_deploy_sha is null or p_current_deploy_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'unknown_source_identity' using errcode = '22023';
  end if;
  if p_fixed_in_deploy_sha is null or p_fixed_in_deploy_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'invalid_fixed_deploy_sha' using errcode = '22023';
  end if;
  /*
    The operator must name the runtime they are actually recovering ON. Accepting any other
    value would let a recovery be authorized against a build nobody is running.
  */
  if p_fixed_in_deploy_sha <> p_current_deploy_sha then
    raise exception 'fixed_deploy_sha_not_current' using errcode = '22023';
  end if;

  -- ---- the attempt, locked so a concurrent recovery cannot race the checks ----
  select * into v_attempt
    from public.foundry_practice_generation_attempts a
   where a.id = p_blocked_attempt_id
   for update;

  if not found then
    raise exception 'blocked_attempt_not_found' using errcode = '42501';
  end if;
  -- Belonging is PROVEN, never inferred from the caller's pairing of the two ids.
  if v_attempt.draft_id is distinct from p_draft_id then
    raise exception 'attempt_draft_mismatch' using errcode = '42501';
  end if;
  if v_attempt.lifecycle_state is distinct from 'completed' then
    raise exception 'attempt_not_completed' using errcode = '22023';
  end if;

  -- THE CANONICAL PREDICATE. Never re-enumerated here: a content refusal, an inconclusive
  -- verdict, a transient provider fault and a persistence failure are all excluded by it,
  -- and they must stay excluded by the SAME definition governance uses.
  if not public.foundry_practice_generation_is_system_block_v1(v_attempt.outcome, v_attempt.terminal_reason_code) then
    raise exception 'attempt_not_system_block' using errcode = '22023';
  end if;

  /*
    THE RUNTIME MUST HAVE CHANGED. This proves only that: it is not evidence the defect is
    repaired, and it is not treated as any. It refuses exactly one thing — recovering a
    failure while running the very build that produced it.
  */
  if v_attempt.deploy_version is not null and v_attempt.deploy_version = p_current_deploy_sha then
    raise exception 'source_identity_unchanged' using errcode = '22023';
  end if;

  /*
    If BOTH the attempt and the operator name a support reference, they must be the same
    failure. A mismatch means the operator is recovering something other than what they
    are looking at. An attempt without one constrains nothing.
  */
  if p_support_reference is not null
     and v_attempt.support_reference is not null
     and p_support_reference is distinct from v_attempt.support_reference then
    raise exception 'support_reference_mismatch' using errcode = '22023';
  end if;

  insert into public.foundry_practice_generation_system_block_recoveries (
    blocked_attempt_id, draft_id, granted_by_user_id, recovery_reason_code,
    fixed_in_deploy_sha, support_reference, recovery_contract_version
  ) values (
    p_blocked_attempt_id, v_attempt.draft_id, p_granted_by_user_id, btrim(p_recovery_reason_code),
    p_fixed_in_deploy_sha, p_support_reference, 1
  )
  on conflict (blocked_attempt_id) do nothing;

  get diagnostics v_inserted_rows = row_count;

  -- The FIRST granter and timestamp stay authoritative; a repeated call reports the
  -- recovery that already exists rather than layering a second one on top.
  select * into v_row
    from public.foundry_practice_generation_system_block_recoveries r
   where r.blocked_attempt_id = p_blocked_attempt_id;

  return query select v_row.id, v_row.blocked_attempt_id, v_row.draft_id, v_row.granted_at, (v_inserted_rows = 0);
end;
$$;

comment on function public.recover_foundry_practice_generation_system_block_v1(uuid, uuid, uuid, text, text, text, text) is
  'Acknowledge that ONE completed system-block attempt was caused by a defect since repaired. Idempotent per attempt. Never modifies the attempt, never clears a refusal, and can never authorize a later failure — the admission clause is keyed on this attempt id alone.';

revoke all on function public.recover_foundry_practice_generation_system_block_v1(uuid, uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.foundry_practice_generation_active_system_block_v1(uuid) from public, anon, authenticated;
