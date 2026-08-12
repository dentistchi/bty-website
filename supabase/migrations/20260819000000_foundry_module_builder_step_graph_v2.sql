-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- Foundry — the Builder gained a step: widen current_step to 1..9 (Slice 3.2P-R3.6-R1)
--
-- HELD, NOT APPLIED. `supabase db push` does not scan this directory. Applying it is a
-- separate, deliberate Founder SQL gate.
--
-- WHY IT EXISTS. `20260716174444` bounded `current_step` to 1..8 when the Builder had eight
-- screens: seven questions and Review. R3.6-R1 inserted "When does this usually happen?" at
-- position 3 — the host's own recurring moment, which the model used to re-author from prose
-- and which cost the W5 window a paid refusal. Every later step moved once, so Review is 9.
--
-- MEASURED, NOT ASSUMED. A live probe on staging (write, read back, restore) confirms the
-- bound is exactly 1..8: 8 is accepted, 9 and 10 are refused by
-- `foundry_module_drafts_current_step_check`. Without this the host can reach Review and not
-- save from it.
--
-- DEPLOY ORDER. The application is already fail-safe for the interval before this runs:
-- `persistableStep` clamps what is WRITTEN to `LIVE_STEP_CEILING`, so a host at Review persists
-- the highest legal value instead of failing a save. That constant moves to 9 in the SAME edit
-- that this migration is applied — the pattern every diagnostic column here has followed.
--
-- SCOPE. One CHECK constraint replaced on one column. No column added or dropped, no RLS,
-- policy, grant or index touched, no row written, no backfill. Every existing row holds a value
-- in 1..8, so the widened constraint accepts all of them.
-- ============================================================================

begin;

alter table public.foundry_module_drafts
  drop constraint if exists foundry_module_drafts_current_step_check;

alter table public.foundry_module_drafts
  add constraint foundry_module_drafts_current_step_check
    check (current_step between 1 and 9);

comment on column public.foundry_module_drafts.current_step is
  'Slice 2, widened 3.2P-R3.6-R1. Which Builder screen the host left off on: 1-8 are the '
  'questions, 9 is Review. A resume bookmark only — no readiness or authority is derived '
  'from it.';

commit;

-- ROLLBACK (documented, not executed) — restores the eight-step bound. Safe only while no row
-- sits on the new Review step; check first:
--   select count(*) from public.foundry_module_drafts where current_step = 9;
