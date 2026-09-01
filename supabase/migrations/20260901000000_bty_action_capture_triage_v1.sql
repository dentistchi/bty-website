-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- SLICE T2 — SAVED-FOR-LATER TRIAGE V1 (bty_action_captures.triage_choice).
-- ADDITIVE ONLY. Two nullable columns and one CHECK on the NEW columns.
-- No existing column, constraint, index, grant, policy or row is altered, and
-- there is no backfill: every existing capture stays untriaged, which is the
-- truthful state (nobody has decided anything about them yet).
-- ===========================================================================
--
-- WHAT THIS IS. The user saved something because they did not want to lose it.
-- This records the ONE decision they can now make about it: deal with it soon,
-- or keep it for later. That is the whole object.
--
-- WHY NEW COLUMNS RATHER THAN A NEW `status` VALUE. `status` already carries a
-- three-value contract (captured | promoted | dismissed) whose comment states
-- "three states, no fourth", and whose `promoted` value is bound by two CHECKs
-- to a real `bty_action_contracts` row. Widening that CHECK would mean dropping
-- and re-adding a live constraint, and overloading a column that answers
-- "what happened to this capture" with an answer to "when does the user want to
-- deal with it" -- two different questions. They are kept apart.
--
-- SOURCE TRUTH IS NOT TOUCHED. `source_type`, `external_key`, `preview_text`,
-- `source_url`, `source_metadata`, `captured_at` and `user_id` remain the
-- immutable evidence of what arrived from Teams. Triage is DERIVED user state
-- stored alongside that evidence, never written over it. A repeat save of the
-- same message still returns the existing row untouched -- the producer's
-- select -> insert -> 23505 re-read remains the only authority, and it writes
-- neither of these columns.
--
-- TRIAGE IS NOT A PROMISE, AND `soon` IS NOT A PROMOTION. Nothing here creates
-- an Action Contract, a deadline, a reminder, a verification obligation or an
-- XP event. `soon` is a POSITION in the user's own saved list and nothing more.
-- This matters concretely and was measured: `fetchBlockingArenaContractForSession`
-- selects open contracts by `deadline_at > now()` with NO `action_type` filter,
-- so a capture turned into a contract would block Arena progression. It is not
-- turned into one. There is deliberately no trigger in this file.
--
-- THE PAIR IS BICONDITIONAL, mirroring the `promoted_at` precedent already in
-- this table: a decision and the moment it was made are one fact, so a row can
-- never claim a choice without a time or a time without a choice.
--
-- V1 HAS NO UNDO. Nothing here forbids a later re-triage -- the columns are
-- plain UPDATEs -- but the application does not offer one in this slice, so no
-- history table is created for a history nobody is recording yet.
--
-- NO INDEX. Measured before writing: the table holds 7 rows on production, and
-- the existing `bty_action_captures_user_status_captured_idx` already serves
-- the one owner-scoped read. An index for a 7-row table would be a decoration.
--
-- ROLLBACK:
--   alter table public.bty_action_captures
--     drop constraint if exists bty_action_captures_triage_pair_check,
--     drop column if exists triaged_at,
--     drop column if exists triage_choice;
-- ===========================================================================

alter table public.bty_action_captures
  -- The decision. NULL = untriaged, which is the state every capture starts in
  -- and the state all existing rows keep after this migration.
  add column if not exists triage_choice text,
  -- WHEN the decision was made. Never a due date, never a reminder time.
  add column if not exists triaged_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bty_action_captures_triage_pair_check'
      and conrelid = 'public.bty_action_captures'::regclass
  ) then
    alter table public.bty_action_captures
      add constraint bty_action_captures_triage_pair_check
      check (
        (triage_choice is null and triaged_at is null)
        or (triage_choice in ('soon', 'later') and triaged_at is not null)
      );
  end if;
end
$$;

comment on column public.bty_action_captures.triage_choice is
  'soon | later, or NULL for untriaged. The user''s own decision about WHEN they want to deal with a saved item — a position in their saved list, never a deadline, a reminder, a promotion or an Action Contract. Derived user state; it is never written by the capture producer and never overwritten by a repeat save.';

comment on column public.bty_action_captures.triaged_at is
  'The moment triage_choice was chosen. Biconditional with triage_choice (see bty_action_captures_triage_pair_check), mirroring the promoted_at precedent: a decision and when it was made are one fact. NOT a due date — this table has no due dates.';
