-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- Foundry — the subtype behind an umbrella refusal (Slice 3.2P-A5-R2)
--
-- HELD, NOT APPLIED. `supabase db push` does not scan this directory. Applying it is a
-- separate, deliberate Founder SQL gate.
--
-- WHY IT EXISTS. Twice a forensic slice has been unable to answer its own central question
-- because the server computed a deterministic classification and dropped it one line later:
--
--   A5  d8be3e40  scenario_without_pressure. FIVE distinct defect reasons collapse into that
--                 one code — missing, too_long, generic, restates_action, no_pressure — and
--                 only the last is the pressure floor. Whether the floor failed to recognise
--                 real difficulty, or the model genuinely wrote none, is not recoverable from
--                 the ledger. The whole classification of that refusal turned on a fact that
--                 existed for one statement and was discarded.
--
--   A1  6f93f7f4  evidence_overclaim. `assertsOverclaimByPolicy` returns the exact policy rule
--   A4  8a7f2f6a  and `assertsOverclaim` reduced it to a boolean, so which of twelve rules
--                 refused either window is permanently unknown.
--
-- WHAT THESE COLUMNS HOLD, AND WHAT THEY CANNOT.
--
--   scenario_contract_reason   one id from `SCENARIO_DEFECT_REASONS`
--   evidence_policy_rule       one id from `EVIDENCE_POLICY`
--
-- Both are BTY's OWN classifications, chosen from closed vocabularies fixed in source before
-- any model ran. Neither can hold a sentence: the value never derives from the text, only from
-- which server-side rule matched it. The rejected pressure phrase, the rejected title, the
-- rejected assumption and the rejected warning remain unstored, exactly as before.
--
-- R7 IS UNCHANGED: unapplied AI proposal prose is not durably stored. The maximum a reader can
-- learn from either column is which BTY rule fired — the same class of fact `refusal_code`,
-- `behavior_contract_reason` and the three dependency columns already record.
--
-- NULL MEANS UNKNOWN. Not "no subtype" and never "the default one". All 45 existing child rows
-- keep NULL, including A1's, A4's and A5's, whose true subtype nobody can recover. Historical
-- uncertainty is part of the record and is not being guessed away — no backfill, no inference
-- from UI copy, from corpora, or from the refusal code.
--
-- DEPLOY ORDER, the same one every diagnostic column here has followed. The code that computes
-- both subtypes ships FIRST with persistence gated off, so the update payload stays
-- byte-identical to today's while the columns do not exist. Then this runs. Then
-- `SEMANTIC_REASON_DIAGNOSTICS_ENABLED` flips to true. `storableScenarioReason` and
-- `storableEvidenceRule` write NULL for any value the live CHECK would refuse, so no insert
-- can fail on a vocabulary the schema has not learned yet.
--
-- ACCEPTANCE IS UNAFFECTED. No proposal becomes valid or invalid because of this file; it adds
-- observability to refusals that already happen exactly as they do today.
--
-- SCOPE. Two nullable columns and two CHECK constraints on one table. No column dropped or
-- altered, no RLS, policy, grant, trigger or index touched, no row written, no backfill.
-- ============================================================================

begin;

alter table public.foundry_program_generation_attempt_calls
  add column if not exists scenario_contract_reason text;

alter table public.foundry_program_generation_attempt_calls
  add column if not exists evidence_policy_rule text;

-- Constraint names are looked up rather than guessed: an earlier slice found that an
-- auto-generated name had been truncated, so neither spelling may be assumed. These are new
-- columns, so the loops normally find nothing — they exist so a re-run is a no-op.
do $$
declare
  c text;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
      join pg_attribute att
        on att.attrelid = rel.oid and att.attnum = any (con.conkey)
     where ns.nspname = 'public'
       and rel.relname = 'foundry_program_generation_attempt_calls'
       and con.contype = 'c'
       and att.attname in ('scenario_contract_reason', 'evidence_policy_rule')
  loop
    execute format('alter table public.foundry_program_generation_attempt_calls drop constraint %I', c);
  end loop;
end $$;

alter table public.foundry_program_generation_attempt_calls
  add constraint foundry_program_call_scenario_contract_reason_check
    check (scenario_contract_reason is null or scenario_contract_reason in (
      'missing',
      'too_long',
      'generic',
      'restates_action',
      'no_pressure',
      'independent_moment'
    ));

alter table public.foundry_program_generation_attempt_calls
  add constraint foundry_program_call_evidence_policy_rule_check
    check (evidence_policy_rule is null or evidence_policy_rule in (
      'organisational_outcome',
      'habitual_performance',
      'proof_of_high_rung',
      'readiness_claim',
      'competence_claim',
      'mastery_claim',
      'permanence_claim',
      'verification_claim',
      'relationship_repair_claim',
      'dependency_removed_claim',
      'guarantee_claim',
      'improvement_claim'
    ));

comment on column public.foundry_program_generation_attempt_calls.scenario_contract_reason is
  'Slice 3.2P-A5-R2. Which scenario-contract rule the proposal failed, behind the umbrella '
  'refusal_code. Fixed vocabulary; never the rejected pressure phrase. NULL = unknown.';

comment on column public.foundry_program_generation_attempt_calls.evidence_policy_rule is
  'Slice 3.2P-A5-R2. Which EVIDENCE_POLICY rule refused the text, behind evidence_overclaim. '
  'Fixed vocabulary; never the rejected sentence. NULL = unknown.';

commit;

-- ROLLBACK (documented, not executed) — drops both columns and their constraints. Safe at any
-- time: nothing reads these columns for runtime behaviour, and no historical row depends on
-- them. Count what would be lost first:
--   select count(*) filter (where scenario_contract_reason is not null) as scenario,
--          count(*) filter (where evidence_policy_rule is not null)     as evidence
--     from public.foundry_program_generation_attempt_calls;
--
--   alter table public.foundry_program_generation_attempt_calls
--     drop constraint if exists foundry_program_call_scenario_contract_reason_check,
--     drop constraint if exists foundry_program_call_evidence_policy_rule_check,
--     drop column if exists scenario_contract_reason,
--     drop column if exists evidence_policy_rule;
