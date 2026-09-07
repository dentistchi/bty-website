-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- SAVED FOR LATER -- "REMOVE FROM MY QUEUE", SEPARATED FROM "I SAVED THIS".
-- ADDITIVE ONLY. One nullable column. No existing column, constraint, grant,
-- policy, index or ROW is altered, and nothing is deleted.
--
-- ORDERING: 20260916, after 20260915 (Host Track history retention).
-- ===========================================================================
--
-- ★ WHY A NEW COLUMN AND NOT `saved_at = NULL`.
--
-- Clearing `saved_at` would have worked with no schema at all: the lane filters
-- `saved_at is not null`, so a NULL leaves the queue, and `ensureActionCapture`
-- would re-stamp it on the next Save because its guard is `!row.saved_at`.
-- Free resurfacing, no migration.
--
-- It is wrong for two measured reasons.
--
--   1. `saved_at` is documented as WHEN THE PERSON EXPLICITLY SAVED THIS, and
--      20260905 exists precisely because that fact could not be recovered once
--      lost -- its backfill is described there as "the safe reading of an
--      ambiguous past". Clearing it destroys the same fact again, on purpose.
--
--   2. `ensureActionCapture` states an invariant in words: "a row already
--      stamped is not re-stamped, so a later Track can never move a save's
--      timestamp, and neither can a second Save." Reusing NULL as "removed"
--      makes a second Save move the timestamp -- the invariant would hold only
--      because nothing had exercised it yet.
--
-- A removed row would also become indistinguishable from a TRACK-ONLY row
-- (`saved_at is null` is exactly what Track produces), so "they saved this once
-- and cleared it" and "nobody ever saved this" would read the same.
--
-- ★ WHY NOT `status = 'dismissed'`. The enum already has the value and the lane
-- already filters `status = 'captured'`, so it looks free. It is not: the
-- constraint `(status = 'promoted') = (promoted_at is not null)` makes a
-- PROMOTED capture impossible to remove from the queue, and "dismissed" already
-- means the person let the ACTION go -- a different fact from clearing a
-- reading list. (The value is dormant: 0 rows, and no writer anywhere.)
--
-- ★ WHY NOT A SECOND TABLE. A capture is SINGLE-OWNER -- `user_id` is on the row
-- itself. `bty_today_dismissals` needs its own table because one announcement is
-- read by many people and each has their own opinion of it; here there is no
-- second person to have one. A table would duplicate ownership that already
-- exists, and add a join to answer a question the row can answer alone.
--
-- ★ NO PHYSICAL DELETE, AND NO CHANGE TO WHO MAY DELETE. 20260915 removed
-- ambient DELETE on this table from `service_role` on purpose. This file does
-- not restore it, does not need it, and touches no privilege at all.
--
-- ROLLBACK:
--   alter table public.bty_action_captures drop column if exists saved_removed_at;
-- ===========================================================================

alter table public.bty_action_captures
  add column if not exists saved_removed_at timestamptz;

comment on column public.bty_action_captures.saved_at is
  'FIRST explicit Save to BTY, and historical truth: it is written once and never rewritten -- not by a later Track, not by a second Save, and not by removing the item from the queue. NULL means the capture exists only as source evidence for another workflow. It answers "did this person ask for this", never "is it in their list right now" -- see saved_removed_at.';

comment on column public.bty_action_captures.saved_removed_at is
  'When this person cleared the item from their own Saved for later queue. Personal queue state, not deletion: the capture, its source, its permalink and any Track that references it are untouched. Current membership is status = ''captured'' AND saved_at IS NOT NULL AND saved_removed_at IS NULL. Set once by Remove and cleared by an explicit re-Save; a repeat Remove does not move it, because the moment they let it go already happened.';

-- ---------------------------------------------------------------------------
-- NO INDEX, DELIBERATELY. The lane reads ONE user's rows through the existing
-- `user_id` path and then filters in the same scan; production holds 23 capture
-- rows in total (measured 2026-09-07). An index here would be a second
-- structure to maintain on every write, to answer a question a sequential read
-- of a handful of rows already answers. Add one when a measured plan asks for
-- it, not before.
--
-- NO CONSTRAINT PAIRING. `triage_choice`/`triaged_at` are a biconditional
-- because a decision and its moment are one fact. A removal has no partner
-- field: `saved_removed_at` alone says everything there is to say.
-- ---------------------------------------------------------------------------
