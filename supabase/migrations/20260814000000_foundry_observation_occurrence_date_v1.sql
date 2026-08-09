-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- SLICE 3.2M-5 — the date the behaviour was SEEN, not the date it was filed.
-- ===========================================================================
--
-- WHY. 3.2M-4 can say a distinct authorised person saw the behaviour. It cannot say the
-- behaviour REPEATED, because the only time the table holds is `submitted_at` — when the
-- observer pressed the button. Two reports filed the same afternoon may describe two
-- different weeks; two filed a week apart may describe the same morning. A temporal claim
-- built on filing time would be a claim about the observer's admin habits.
--
-- So an observation now carries the date the observer says they actually saw or heard it,
-- and the timezone that date is to be read in. `submitted_at` is unchanged and keeps its own
-- separate meaning.
--
-- TIMEZONE AUTHORITY IS NOT THE CLIENT'S. The snapshot copied here is the CANONICAL
-- OBLIGATION's `foundry_participant_followups.timezone_snapshot` — the frame the learner's
-- own completion and due date were already resolved in. An observer's device tz never decides
-- which day "today" is, so nobody can widen their own window by changing a phone setting.
--
-- WHAT IS DELIBERATELY NOT ADDED: no `sustained` boolean, no streak, no observation count
-- cache, no current-habit state. A stored rung is one that can drift from the evidence it is
-- supposed to summarise; SUSTAINED is derived, in one pure place, from these rows.
--
-- NO BACKFILL, AND NONE IS POSSIBLE. Measured live before writing this file:
-- `foundry_behavior_observations` holds ZERO rows. There is no historical occurrence date to
-- recover and no ambiguity to resolve — `not null` with no default is therefore safe and
-- honest, rather than a default that would invent an occurrence date nobody reported.
--
-- ROLLBACK:
--   drop index if exists public.foundry_observations_followup_date_idx;
--   drop index if exists public.foundry_observation_occurrence_unique;
--   alter table public.foundry_behavior_observations drop column if exists observation_timezone_snapshot;
--   alter table public.foundry_behavior_observations drop column if exists observed_on;
-- ===========================================================================

-- 1. WHEN THEY SAW IT. Distinct from `submitted_at` (when they told us) and from
--    `created_at` (when the row was written). A date, not an instant: an observer remembers
--    a day, not a wall-clock moment, and asking for more precision than they have would
--    manufacture it.
alter table public.foundry_behavior_observations
  add column if not exists observed_on date not null;

-- 2. The frame that date is read in — copied from the canonical obligation at submission, so
--    a later profile/timezone change can never re-interpret a historical occurrence date.
alter table public.foundry_behavior_observations
  add column if not exists observation_timezone_snapshot text;

comment on column public.foundry_behavior_observations.observed_on is
  'Slice 3.2M-5 — the date the observer says they personally saw or heard the behaviour. '
  'Occurrence time, NEVER filing time: submitted_at answers a different question and both are '
  'kept. Read in observation_timezone_snapshot.';
comment on column public.foundry_behavior_observations.observation_timezone_snapshot is
  'Slice 3.2M-5 — the canonical obligation timezone (foundry_participant_followups.'
  'timezone_snapshot) at submission. Durable interpretation context for observed_on. Never the '
  'observer''s client-supplied timezone, which is not an authority.';

-- 3. ONE OCCURRENCE FACT PER (obligation, observer, day, answer).
--
--    This replaces the 3.2M-4 service rule that compared a new report only against that
--    observer's LAST answer — under which the same person answering OBSERVED again a week
--    later wrote nothing at all, making sustained consistency unrepresentable.
--
--    A PLAIN unique index, not a partial one: all four columns are NOT NULL, so there is no
--    predicate to write and a `where` clause would be decoration. Verified against the 3.2M-4
--    table definition rather than assumed.
--
--    What each case now means:
--      same day, same answer      -> a double tap or a retry. Refused here; the service
--                                    reports created:false. Not a second sighting.
--      later day, same answer     -> a genuine second sighting. Appended.
--      same day, changed answer   -> preserved as a separate row, exactly as 3.2M-4 intended:
--                                    an observer who corrects themselves is two facts, and
--                                    nothing is destructively overwritten.
create unique index if not exists foundry_observation_occurrence_unique
  on public.foundry_behavior_observations (followup_id, observer_user_id, observed_on, outcome);

-- 4. The read the temporal derivation makes: one obligation's observations in occurrence
--    order. The existing (followup_id, submitted_at desc) index answers a different question
--    and is left alone.
create index if not exists foundry_observations_followup_date_idx
  on public.foundry_behavior_observations (followup_id, observed_on);

-- ===========================================================================
-- ROLLBACK (manual, if ever needed):
--   drop index if exists public.foundry_observations_followup_date_idx;
--   drop index if exists public.foundry_observation_occurrence_unique;
--   alter table public.foundry_behavior_observations drop column if exists observation_timezone_snapshot;
--   alter table public.foundry_behavior_observations drop column if exists observed_on;
-- ===========================================================================
