-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- Foundry — did the licensed repair stay inside its envelope? (Slice 3.2P-R0.3)
--
-- HELD, NOT APPLIED. `supabase db push` does not scan this directory. Applying it is a
-- separate, deliberate Founder SQL gate.
--
-- WHY IT EXISTS. W2 — parent 9c2bf359 — produced two child calls that record the SAME
-- refusal: `scenario_without_pressure` on `elements.scenario`, twice. The licensed retry
-- definitely ran. What the ledger cannot say is which of these happened:
--
--   A  the retry edited only the two pressure fields it was licensed to edit, and the
--      validator still found no real pressure;
--   B  the retry rewrote something outside its licence, `repairFreezeViolated()` discarded
--      it, and the service replaced its validation result with call 1's ORIGINAL refusal —
--      which is exactly what the child row then stored.
--
-- Both readings write byte-identical rows, because the freeze overwrites `validated` before
-- the child is finalized. The only trace of the difference was a `console.info`, and this
-- Worker retains no logs. A paid generation ledger that cannot tell a discarded repair from
-- an honest one is the same class of gap that cost the fourth pilot window its diagnosis.
--
-- WHAT IS STORED. One nullable boolean, and deliberately nothing else:
--
--   NULL   the freeze was not evaluated for this call — the initial authorship call, a
--          non-repairable refusal, or a row created before this column existed.
--   FALSE  evaluated, and the repair stayed inside its licence.
--   TRUE   evaluated, and the repair left its licence; the candidate was discarded.
--
-- NO BACKFILL. Historical rows stay NULL, and NULL means UNKNOWN — not FALSE. The two W2
-- rows in particular are never to be reinterpreted: this column exists to make the NEXT
-- retry diagnosable, not to manufacture evidence about a run that predates it.
--
-- NO SECOND COLUMN. The repair LICENCE is already derivable from `refusal_code` via
-- `repairLicenseFor`, so storing the surface or the offending path would duplicate a fact
-- the ledger can compute. One boolean answers the one question that could not be answered.
--
-- NO CHECK CONSTRAINT. A three-valued boolean needs no vocabulary; the type is the check.
--
-- SCOPE. Additive and nullable. Child call table only. No RLS, policy, grant, index or
-- constraint on any existing column is touched, and no row is written.
--
-- DEPLOY ORDER. The write path ships DISABLED (`REPAIR_FREEZE_VERDICT_ENABLED = false`), so
-- the update payload stays byte-identical to the pre-migration one and a generation cannot
-- fail on a column that does not exist yet. After this is applied, that flag flips in a
-- separate, smaller change — the same discipline the dependency, behaviour-contract and
-- child-refusal diagnostics each followed.
-- ============================================================================

begin;

alter table public.foundry_program_generation_attempt_calls
  add column if not exists repair_freeze_violated boolean;

comment on column public.foundry_program_generation_attempt_calls.repair_freeze_violated is
  'Slice 3.2P-R0.3 — NULL: freeze not evaluated for this call (initial authorship, a '
  'non-repairable refusal, or a pre-existing row). FALSE: the licensed repair stayed inside '
  'its envelope. TRUE: it left the envelope and was discarded, while refusal_code keeps the '
  'ORIGINAL frozen refusal. NULL is never to be read as FALSE.';

commit;

-- ROLLBACK (documented, not executed):
--   begin;
--   alter table public.foundry_program_generation_attempt_calls
--     drop column if exists repair_freeze_violated;
--   commit;
