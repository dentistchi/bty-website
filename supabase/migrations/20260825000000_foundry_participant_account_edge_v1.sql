-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- =============================================================================
-- Foundry PARTICIPANT ↔ ACCOUNT EDGE — V1  (Slice R4-R5C3A1, PHASE 1)
--
-- PRODUCTION-EFFECTIVE: a single shared Supabase project backs all workers, so
-- this lands on live data once applied. Additive, nullable, idempotent, and a
-- complete no-op for every existing row and every existing query.
--
-- WHY THIS COLUMN EXISTS
-- ----------------------
-- R4-R5C2 measured that BTY cannot tell, before completion, that an unfinished
-- participant belongs to the signed-in learner. Every relation that reaches an
-- account is written for the FIRST time at completion:
--
--   foundry_event_training_progress.linked_user_id  -> written by linkLearnerIdentity,
--                                                      called only from complete*/claim*
--   foundry_event_assignments.participant_id        -> written only by
--                                                      bty_foundry_claim_assignment
--
-- and `foundry_event_participants` has carried no account edge at all. Measured on
-- live data at the time of writing: 9 unfinished progress rows, every one holding a
-- real in-progress marker, and 0 of them reachable from the account that produced
-- them. The truth existed and was unreachable.
--
-- R4-R5C3 evaluated every alternative relation (session hash, linked_user_id,
-- assignment.participant_id, org memberships, arena_profiles, auth.users, reading the
-- participant cookie at the Learn API) and returned verdict A: a nullable account edge
-- ON THE PARTICIPANT ROW is the minimum correct relation. This is that column.
--
-- WHAT THIS MIGRATION DELIBERATELY DOES NOT DO
-- --------------------------------------------
--   * NO BACKFILL. The 9 unfinished rows this slice exists for have no provable
--     identity anywhere; inventing one would be the exact failure this series keeps
--     correcting. Historical anonymous and incomplete rows stay NULL and behave
--     exactly as they do today. (A completed-row backfill via linked_user_id is
--     possible and was measured as safe — 14 rows, 0 duplicate pairs — but it buys
--     nothing for the goal, so it is not performed.)
--   * NO unique (event_id, user_id). Canonicality policy is MULTIPLE PARTICIPANTS /
--     ONE ACCOUNT (R4-R5C3 §5): a learner opening the same training on a second
--     device legitimately creates a second participant, and a unique constraint would
--     start rejecting that the first time it happened. It holds on today's data by
--     accident, not by design, and encoding it would silently adopt the rejected
--     one-participant-per-account policy.
--   * NO new status, NO account-level progress table, NO canonical participant id,
--     NO participant-sessions table, NO display-name change, NO assignment change.
--
-- CONVENTION
-- ----------
-- `references auth.users (id) on delete set null` follows this repository's existing
-- Foundry convention, not a novel one: `foundry_event_training_progress.linked_user_id`
-- (20260714000000) and `foundry_event_assignments.user_id` (20260721000000) are both
-- declared in exactly this form. `set null` — never cascade — so deleting an account
-- can never erase a Host's roster row or an event's completion history.
--
-- PRIVACY
-- -------
-- This makes the participant row identifying where it deliberately was not. R4-R5C3 §8
-- audited all 13 reads of this table: every one uses an explicit column allow-list,
-- there is not a single `select("*")`, and no DTO spreads a participant row — so no
-- existing projection can leak this field. A repository guard test asserts that this
-- stays true (see participantAccountEdge tests). The column is written by the server
-- from a verified session only, and is never accepted from a request payload.
--
-- INDEX
-- -----
-- Partial on (event_id, user_id) WHERE user_id IS NOT NULL: the only planned probe is
-- "does this account have an unfinished participant on this event", most rows will be
-- NULL, and a partial index keeps the anonymous path free of index maintenance.
--
-- ROLLBACK: drop the index, then the column. Nothing else references it; no data is
-- changed by this migration, so a rollback loses nothing that existed before it.
-- =============================================================================

alter table if exists public.foundry_event_participants
  add column if not exists user_id uuid null references auth.users (id) on delete set null;

comment on column public.foundry_event_participants.user_id is
  'R4-R5C3A1: nullable account edge. Written ONLY at participant creation, ONLY from a '
  'server-derived authenticated session; never from a request payload, never from the join '
  'token, never re-bound. NULL for anonymous participants and for every row created before '
  'this migration. Not unique per (event_id, user_id): multiple devices for one account each '
  'create their own participant. Never included in any Host-, learner- or public-facing '
  'projection.';

create index if not exists foundry_event_participants_event_user_idx
  on public.foundry_event_participants (event_id, user_id)
  where user_id is not null;
