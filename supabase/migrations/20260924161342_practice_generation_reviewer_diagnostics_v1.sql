-- Durable, non-content diagnostics for an existing reviewer-terminal outcome.
-- Additive only: historical attempts remain valid and are not backfilled.

alter table public.foundry_practice_generation_attempts
  add column if not exists terminal_diagnostic_code text null,
  add column if not exists terminal_diagnostic_stage text null,
  add column if not exists terminal_diagnostic_contract_version integer null,
  add column if not exists support_reference text null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'foundry_practice_gen_attempt_terminal_diagnostic_chk'
  ) then
    alter table public.foundry_practice_generation_attempts
      add constraint foundry_practice_gen_attempt_terminal_diagnostic_chk
      check (
        (
          terminal_diagnostic_code is null
          and terminal_diagnostic_stage is null
          and terminal_diagnostic_contract_version is null
        )
        or (
          terminal_diagnostic_code in (
            'boundary_review_parse_failed',
            'boundary_review_validation_failed',
            'boundary_repair_dependency_unavailable',
            'boundary_repair_parse_failed',
            'boundary_repair_validation_failed',
            'boundary_repair_normalization_failed',
            'boundary_review_budget_exhausted'
          )
          and terminal_diagnostic_stage in ('boundary_review', 'boundary_repair')
          and terminal_diagnostic_contract_version = 1
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'foundry_practice_gen_attempt_support_reference_chk'
  ) then
    alter table public.foundry_practice_generation_attempts
      add constraint foundry_practice_gen_attempt_support_reference_chk
      check (support_reference is null or support_reference ~ '^[0-9a-f]{12}$');
  end if;
end
$$;

create index if not exists foundry_practice_gen_attempt_terminal_diagnostic_idx
  on public.foundry_practice_generation_attempts
    (terminal_diagnostic_code, terminal_diagnostic_stage, started_at desc)
  where terminal_diagnostic_code is not null;

comment on column public.foundry_practice_generation_attempts.terminal_diagnostic_code is
  'Non-content cause of a reviewer terminal failure. It explains the existing terminal reason; it never changes governance.';
comment on column public.foundry_practice_generation_attempts.terminal_diagnostic_stage is
  'Boundary execution seam that emitted terminal_diagnostic_code: boundary_review or boundary_repair.';
comment on column public.foundry_practice_generation_attempts.terminal_diagnostic_contract_version is
  'Closed diagnostic vocabulary contract version. NULL for attempts predating durable reviewer diagnostics.';
comment on column public.foundry_practice_generation_attempts.support_reference is
  'Deterministic 12-hex FNV-derived support token from the attempt UUID. It carries no prompt, response, scenario, or user content.';

-- Existing RLS and client privilege posture are intentionally unchanged.
