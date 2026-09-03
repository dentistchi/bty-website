-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- SAVE INTENT, SEPARATED FROM SOURCE EVIDENCE.
-- ADDITIVE ONLY. One nullable column. No existing column, constraint, grant,
-- policy or index is altered, and no row is deleted.
--
-- ORDERING: 20260905, after 20260903 (host grant provenance) and 20260904
-- (platform admin grants). Both of those were applied by hand, in order, and
-- neither is recorded in the migration ledger yet -- so this file must sit
-- after them for a later `migration repair` to replay the true sequence.
-- ===========================================================================
--
-- THE DEFECT, MEASURED (2026-09-02). "Track with BTY" put the source message
-- into the person's "Saved for later" list, which they never asked for.
--
-- `trackAnnouncement` calls `ensureActionCapture` -- the SAME function Save to
-- BTY calls -- because `bty_tracked_announcements` has a foreign key to a
-- capture row. Reusing the source evidence is correct and deliberate: a message
-- already saved must not produce a second capture, and the UNIQUE
-- (user_id, source_type, external_key) guarantees it does not.
--
-- What was missing is that a capture then meant two different things, and the
-- Saved lane could not tell them apart: `listMyActionCaptures` filters
-- `status = 'captured'`, which every capture is. The columns available --
-- `status` (lifecycle), `source_metadata` (an immutable source envelope),
-- `triage_choice` (Soon/Later) -- carry no intent, so there was nothing to
-- filter on.
--
-- WHY NOT A JOIN INSTEAD OF A COLUMN. "Hide captures referenced by one of my
-- announcements" needs no schema, and is wrong: a person may explicitly Save a
-- message AND Track it, and that message must stay in their Saved list. The
-- join cannot distinguish the two, because the thing it would need to know --
-- did this person ask for this -- is not recorded anywhere. That is the missing
-- invariant, and it is what this column is.
--
-- NULLABLE, NOT `boolean not null default false`. A timestamp answers "when did
-- they save it" as well as "did they", and NULL is the honest value for a row
-- nobody chose to save. A boolean would need a second column to say the same.
--
-- THE BACKFILL IS THE SAFE READING OF AN AMBIGUOUS PAST, AND IT RUNS EXACTLY
-- ONCE. Every row that existed before this migration was created before Track
-- was a distinct intent, so which ones were explicitly saved cannot be
-- recovered. Marking those rows as saved preserves exactly what each person
-- sees today: nothing disappears from anybody list on the deploy.
--
-- ★ WHY "ONCE" IS LOAD-BEARING, NOT TIDINESS. A first draft backfilled with
-- `where saved_at is null`, which reads as a guard and is the opposite of one:
-- every Track-only row created AFTER this migration also has `saved_at is
-- null`, by design. Re-running the file -- a repair, a fresh environment, a
-- replay of the ledger -- would have stamped every one of them and put a pile
-- of messages nobody saved back into people''s Saved for later lists.
--
-- So the column existence is checked BEFORE the column is added, and the
-- backfill runs only when this is genuinely the first application. On every
-- later run the ALTER is a no-op and the UPDATE does not execute at all.
--
-- NEVER AN AUTHORITY. This column decides what appears in one personal lane. It
-- is not consulted by any permission check, and nothing about who may read,
-- track, respond or host depends on it.
--
-- ROLLBACK:
--   alter table public.bty_action_captures drop column if exists saved_at;
--
-- NOTE ON ROLLBACK + RE-APPLY: dropping the column discards which rows were
-- explicitly saved. Re-applying afterwards backfills every surviving row as
-- saved, including Track-only ones, because the distinction no longer exists to
-- read. That is a data decision, not an accident of this file.
-- ===========================================================================

do $$
declare
  v_column_existed boolean;
begin
  -- Read BEFORE the ALTER: after it, "does the column exist" is always true and
  -- can no longer distinguish a first application from a re-run.
  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'bty_action_captures'
       and column_name = 'saved_at'
  ) into v_column_existed;

  alter table public.bty_action_captures
    add column if not exists saved_at timestamptz;

  if not v_column_existed then
    -- Only the rows that predate the distinction. No WHERE clause is needed or
    -- wanted: on a first application every row is one of them, and on any later
    -- run this statement is not reached.
    update public.bty_action_captures set saved_at = captured_at;
  end if;
end $$;

comment on column public.bty_action_captures.saved_at is
  'When the user explicitly invoked Save to BTY. NULL means the capture exists only as source evidence for another workflow. Track never sets or clears this value.';

-- NO INDEX. The Saved lane already reads one user's rows through the existing
-- user_id path, the table is small, and the lane's real order is decided in the
-- application (`compareForSavedLane`: undecided, then soon, then later) rather
-- than by `saved_at`. An index shaped to a sort this query does not perform
-- would be a guess dressed as an optimisation.
