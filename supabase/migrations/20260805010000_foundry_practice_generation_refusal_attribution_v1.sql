-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- Slice 3.2I-R5B2-R5C-1 — exact Practice generation REFUSAL ATTRIBUTION V1.
-- ============================================================================
-- WHY
-- R5A made a submission's terminal outcome durable. R5B then read two real device
-- attempts and still could not say what refused them, for two measured reasons:
--
--   1. a startsWith("boundary_review") umbrella folded EIGHT distinct service reasons
--      into one outcome, including `reviewer_terminal_failure`, which belongs to the
--      SEMANTIC reviewer. An infrastructure failure was recorded as a content
--      rejection.
--
--   2. worse, a genuine boundary CONTENT rejection never carries a boundary reason at
--      all: it exhausts its retry and returns plain `generation_rejected`, exactly
--      like a quality-gate refusal. The reason alone cannot separate them; only the
--      refusing GATE can, and it was computed and thrown away.
--
-- These columns record the stage, the canonical reason, the gate and the evaluator's
-- own ranked finding codes, so the next attempt names itself.
--
-- ADDITIVE ONLY. ALTER of the existing table; no new table, no child table, no
-- trigger, no backfill, no UPDATE of any existing row. The two historical attempts
-- keep NULL detail and remain valid — the migration does not guess what happened in
-- them, and their original umbrella outcomes remain historical truth.
--
-- PRIVACY. Every added column is a member of a closed vocabulary, a bounded array of
-- identifier-shaped codes, or a small integer. No prompt, response, scenario,
-- reviewer or boundary prose, and no error text, can be stored here.
-- ============================================================================

alter table public.foundry_practice_generation_attempts
  -- NULL = a historical (R5A) record. 1 = the R5C-1 recorder contract.
  add column if not exists attribution_version integer null,
  add column if not exists terminal_stage text null,
  add column if not exists terminal_reason_code text null,
  add column if not exists refusal_gate text null,
  add column if not exists primary_finding_code text null,
  add column if not exists finding_codes text[] null,
  add column if not exists finding_count integer null;

-- ---------------------------------------------------------------------------
-- Closed vocabularies. Semantic review and boundary review are deliberately
-- SEPARATE stages: merging them is the defect this slice exists to remove.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'foundry_practice_gen_attempt_attribution_version_chk') then
    alter table public.foundry_practice_generation_attempts
      add constraint foundry_practice_gen_attempt_attribution_version_chk
      check (attribution_version is null or attribution_version >= 1);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'foundry_practice_gen_attempt_terminal_stage_chk') then
    alter table public.foundry_practice_generation_attempts
      add constraint foundry_practice_gen_attempt_terminal_stage_chk
      check (terminal_stage is null or terminal_stage in (
        'observability_gate',
        'generation_eligibility',
        'generation_provider',
        'generation_parse',
        'generation_schema',
        'scenario_quality',
        'semantic_review',
        'boundary_review',
        'persistence',
        'internal'
      ));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'foundry_practice_gen_attempt_terminal_reason_chk') then
    alter table public.foundry_practice_generation_attempts
      add constraint foundry_practice_gen_attempt_terminal_reason_chk
      check (terminal_reason_code is null or terminal_reason_code in (
        'generation_observability_unavailable',
        'generation_not_eligible',
        'provider_timeout',
        'provider_transport_error',
        'provider_http_error',
        'provider_empty_output',
        'provider_malformed_output',
        'provider_schema_invalid',
        'scenario_quality_rejected',
        'semantic_content_rejected',
        'semantic_review_authority_failure',
        'semantic_review_inconclusive',
        'semantic_reviewer_terminal_failure',
        'semantic_reviewer_transport_failure',
        'semantic_reviewer_schema_failure',
        'boundary_content_rejected',
        'boundary_review_authority_failure',
        'boundary_review_inconclusive',
        'boundary_reviewer_terminal_failure',
        'boundary_reviewer_transport_failure',
        'boundary_reviewer_schema_failure',
        'scenario_persistence_failed',
        'internal_unclassified_failure'
      ));
  end if;

  -- The gate vocabulary is the service's own `RejectionOutcome.primaryGate`, measured
  -- from source rather than invented.
  if not exists (select 1 from pg_constraint where conname = 'foundry_practice_gen_attempt_refusal_gate_chk') then
    alter table public.foundry_practice_generation_attempts
      add constraint foundry_practice_gen_attempt_refusal_gate_chk
      check (refusal_gate is null or refusal_gate in (
        'provider_dto',
        'canonical_validator',
        'semantic_review',
        'branch_review',
        'phase_choice_review',
        'primary_choice_review',
        'urgency_review',
        'boundary_review',
        'narrow_boundary_review'
      ));
  end if;

  -- Finding codes are IDENTIFIERS. The pattern is what makes prose, excerpts and
  -- reviewer explanations unstorable rather than merely discouraged.
  if not exists (select 1 from pg_constraint where conname = 'foundry_practice_gen_attempt_primary_finding_chk') then
    alter table public.foundry_practice_generation_attempts
      add constraint foundry_practice_gen_attempt_primary_finding_chk
      check (primary_finding_code is null or primary_finding_code ~ '^[a-z][a-z0-9_]{2,63}$');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'foundry_practice_gen_attempt_finding_codes_chk') then
    alter table public.foundry_practice_generation_attempts
      add constraint foundry_practice_gen_attempt_finding_codes_chk
      check (
        finding_codes is null
        or (
          array_length(finding_codes, 1) is null
          or (
            array_length(finding_codes, 1) <= 8
            and finding_codes <@ (
              select array_agg(c) from unnest(finding_codes) c where c ~ '^[a-z][a-z0-9_]{2,63}$'
            )
          )
        )
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'foundry_practice_gen_attempt_finding_count_chk') then
    alter table public.foundry_practice_generation_attempts
      add constraint foundry_practice_gen_attempt_finding_count_chk
      check (
        finding_count is null
        or (
          finding_count >= 0
          and finding_count <= 8
          and (finding_codes is null or finding_count = coalesce(array_length(finding_codes, 1), 0))
        )
      );
  end if;

  -- A record written under the new contract must name BOTH the stage and the reason.
  -- Historical rows are exempt because their attribution_version is NULL.
  if not exists (select 1 from pg_constraint where conname = 'foundry_practice_gen_attempt_attribution_complete_chk') then
    alter table public.foundry_practice_generation_attempts
      add constraint foundry_practice_gen_attempt_attribution_complete_chk
      check (
        attribution_version is null
        or lifecycle_state <> 'completed'
        or (terminal_stage is not null and terminal_reason_code is not null)
      );
  end if;

  -- Impossible pairings: a stage may not claim another stage's reason.
  if not exists (select 1 from pg_constraint where conname = 'foundry_practice_gen_attempt_stage_reason_chk') then
    alter table public.foundry_practice_generation_attempts
      add constraint foundry_practice_gen_attempt_stage_reason_chk
      check (
        terminal_stage is null
        or terminal_reason_code is null
        or (terminal_stage = 'persistence') = (terminal_reason_code = 'scenario_persistence_failed')
        or terminal_reason_code = 'internal_unclassified_failure'
      );
  end if;
end
$$;

comment on column public.foundry_practice_generation_attempts.terminal_stage is
  'Exact owning stage of the terminal result (Slice R5C-1). Semantic review and boundary review are separate stages by contract.';
comment on column public.foundry_practice_generation_attempts.refusal_gate is
  'The gate that refused, from RejectionOutcome.primaryGate. A boundary CONTENT rejection returns generation_rejected, so only this separates it from a quality refusal.';

-- Outcome-rate and attribution sweeps.
create index if not exists foundry_practice_gen_attempt_stage_reason_idx
  on public.foundry_practice_generation_attempts (terminal_stage, terminal_reason_code, started_at desc)
  where terminal_stage is not null;

-- RLS posture is UNCHANGED: RLS stays enabled, client grants stay revoked, and no
-- permissive policy is added. Re-asserted idempotently so an ALTER can never widen it.
revoke all on public.foundry_practice_generation_attempts from anon, public, authenticated;

-- ---------------------------------------------------------------------------
-- ROLLBACK (reviewed, NOT executed):
--
--   drop index if exists public.foundry_practice_gen_attempt_stage_reason_idx;
--   alter table public.foundry_practice_generation_attempts
--     drop constraint if exists foundry_practice_gen_attempt_stage_reason_chk,
--     drop constraint if exists foundry_practice_gen_attempt_attribution_complete_chk,
--     drop constraint if exists foundry_practice_gen_attempt_finding_count_chk,
--     drop constraint if exists foundry_practice_gen_attempt_finding_codes_chk,
--     drop constraint if exists foundry_practice_gen_attempt_primary_finding_chk,
--     drop constraint if exists foundry_practice_gen_attempt_refusal_gate_chk,
--     drop constraint if exists foundry_practice_gen_attempt_terminal_reason_chk,
--     drop constraint if exists foundry_practice_gen_attempt_terminal_stage_chk,
--     drop constraint if exists foundry_practice_gen_attempt_attribution_version_chk,
--     drop column if exists finding_count,
--     drop column if exists finding_codes,
--     drop column if exists primary_finding_code,
--     drop column if exists refusal_gate,
--     drop column if exists terminal_reason_code,
--     drop column if exists terminal_stage,
--     drop column if exists attribution_version;
-- ---------------------------------------------------------------------------
