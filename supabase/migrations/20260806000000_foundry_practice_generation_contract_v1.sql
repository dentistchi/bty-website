-- Copy-friendly (LF, no trailing spaces). Select all to copy.
--
-- CONTRACT step of the expand/deploy/contract rollout (Slice 3.2L Part 0C).
--
-- ORDERING PRECONDITION — MUST NOT run before a 16-argument caller is live at 100%.
-- Worker f295a857-7f70-4e4b-ad1d-39bd546dc9c3 (source adb9c7cd) satisfies this: its only
-- admission caller passes p_submission_intent_id explicitly.
--
-- ---------------------------------------------------------------------------
-- WHY THE FIRST CONTRACT ATTEMPT WAS NOT ENOUGH
-- ---------------------------------------------------------------------------
-- The first version of this migration dropped the legacy 15-argument overload and added
-- the contradiction constraint. That is insufficient. The 16-argument function was
-- created with `p_submission_intent_id uuid default null`, and a trailing default makes
-- it answer to a 15-argument call as well. Dropping the legacy overload would therefore
-- have left a function that still admits a caller who omits the submission intent
-- entirely — the exact boundary this arc exists to enforce.
--
-- The same default caused the live incident: while BOTH overloads existed, a 15-key
-- PostgREST request matched both and PostgREST returned PGRST203 rather than choosing.
-- Catalog inspection (pg_proc) and direct SQL execution both looked correct, because
-- PostgreSQL resolves positional calls unambiguously. Only the PostgREST transport —
-- which dispatches on the JSON argument-NAME set — exposes it.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS MIGRATION DOES
-- ---------------------------------------------------------------------------
-- 1. Drops the deployed 16-argument function (whose 16th parameter carries the default).
-- 2. Recreates it byte-identically EXCEPT that p_submission_intent_id has NO default.
-- 3. Drops the legacy explicit 15-argument overload.
-- 4. Adds the NOT VALID contradiction constraint.
--
-- PostgreSQL cannot remove an existing parameter default through CREATE OR REPLACE, so
-- the drop/recreate pattern is required. No CASCADE: a plain DROP FAILS LOUDLY if any
-- view, trigger, function, policy or other object depends on it, which is exactly the
-- proof we want. Nothing in this schema depends on it — the only caller is application
-- code reaching it over PostgREST.
--
-- ATOMICITY. The deployed Worker requires the 16-argument function, so it must never be
-- externally absent. The whole file runs inside ONE explicit transaction, following the
-- established repository convention (20260730000000 and 20260731000000 both ship
-- `begin;` / `commit;` and were applied live this way). DDL is transactional in
-- PostgreSQL, so concurrent callers see either the old function or the new one, never a
-- gap.
--
-- HISTORICAL EVIDENCE IS PRESERVED. Three live rows carry the old mapping (2026-08-03
-- x2, 2026-08-04 x1). The constraint is NOT VALID exactly so they stay as they are. The
-- table column stays NULLABLE — those rows legitimately hold NULL. No UPDATE, no DELETE,
-- no backfill appears in this file.

begin;

-- ---------------------------------------------------------------------------
-- 1. Retire the defaulted 16-argument function. Argument TYPES identify it; the
--    default is not part of its identity, so this drops the deployed definition.
--    No CASCADE — if anything depended on it, this statement would fail and the
--    whole transaction would roll back.
-- ---------------------------------------------------------------------------
drop function if exists public.start_foundry_practice_generation_attempt_governed_v1(
  uuid, uuid, integer, text, boolean, uuid, uuid, text, integer, text, text, integer, text, integer, integer, uuid
);

-- ---------------------------------------------------------------------------
-- 2. Recreate it with the submission intent REQUIRED at the signature boundary.
--    Same name, argument names, types, return type, body, language, volatility,
--    SECURITY DEFINER and search_path as the deployed definition.
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
  -- NO DEFAULT — deliberately, and the reason was measured in production.
  --
  -- This parameter originally read `uuid default null`. A trailing default makes the
  -- 16-argument function ALSO answer to a 15-argument call. While the legacy
  -- 15-argument overload still existed, a 15-key PostgREST request matched BOTH and
  -- PostgREST refused to choose: PGRST203, "could not choose the best candidate
  -- function". Live practice-generation admission broke for the previously deployed
  -- Worker even though both functions were present and healthy.
  --
  -- What did NOT catch it, and why:
  --   * pg_proc presence checks — both functions existed, so the catalog looked correct;
  --   * direct SQL execution (psql, `select * from fn(...)`) — PostgreSQL resolves
  --     positional calls unambiguously, so the ambiguity never appeared;
  --   * neither exercises PostgREST, which dispatches on the JSON argument-NAME set and
  --     treats a defaulted trailing parameter as a callable omission.
  -- The application transport must be tested, not the catalog.
  --
  -- Without the default, the two overloads are unambiguous by arity: a 15-key request
  -- matches only the legacy function, a 16-key request only this one. A caller can no
  -- longer omit the submission intent and reach admission.
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
-- 3. Restore the exact grant posture: service role only.
-- ---------------------------------------------------------------------------
revoke all on function public.start_foundry_practice_generation_attempt_governed_v1(
  uuid, uuid, integer, text, boolean, uuid, uuid, text, integer, text, text, integer, text, integer, integer, uuid
) from public, anon, authenticated;

grant execute on function public.start_foundry_practice_generation_attempt_governed_v1(
  uuid, uuid, integer, text, boolean, uuid, uuid, text, integer, text, text, integer, text, integer, integer, uuid
) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Drop the legacy explicit 15-argument overload. With the default removed above,
--    this leaves exactly ONE admission path, requiring all sixteen arguments.
-- ---------------------------------------------------------------------------
drop function if exists public.start_foundry_practice_generation_attempt_governed_v1(
  uuid, uuid, integer, text, boolean, uuid, uuid, text, integer, text, text, integer, text, integer, integer
);

-- ---------------------------------------------------------------------------
-- 5. FUTURE rows cannot repeat the contradiction. NOT VALID: the historical rows
--    recorded under the old mapping are the evidence and are never mutated.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.foundry_practice_generation_attempts'::regclass
      and conname = 'foundry_practice_gen_attempt_review_exec_chk'
  ) then
    alter table public.foundry_practice_generation_attempts
      add constraint foundry_practice_gen_attempt_review_exec_chk
      check (
        terminal_reason_code is null
        or terminal_reason_code not in ('reviewer_terminal_failure', 'semantic_reviewer_terminal_failure', 'boundary_reviewer_terminal_failure')
        or outcome = 'review_execution_failed'
      ) not valid;
  end if;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- ROLLBACK (reviewed, NOT executed). Restores the state the deployed Worker needs:
--   begin;
--   -- 1. release future writes from the contradiction check
--   alter table public.foundry_practice_generation_attempts
--     drop constraint if exists foundry_practice_gen_attempt_review_exec_chk;
--   -- 2. re-run the 16-argument function definition from
--   --    20260805050000_foundry_practice_generation_spend_containment_v1.sql. That file
--   --    now declares the parameter WITHOUT a default, so the recreated function is the
--   --    same one this migration installs and the deployed Worker keeps working.
--   -- 3. only if the PREVIOUS 15-argument Worker must also be restored, re-run the
--   --    function definition from
--   --    20260805040000_foundry_practice_generation_retry_governance_v1.sql. With no
--   --    default on the 16-argument overload the two coexist unambiguously.
--   commit;
-- No data is written or removed by this migration, so rollback loses nothing.
-- ---------------------------------------------------------------------------
