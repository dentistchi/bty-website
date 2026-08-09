-- SLICE 3.2M-4 — independent observation of a Guided behaviour.
--
-- BTY can already say a learner REPORTED applying something (3.2M-3). It cannot say anyone
-- SAW it. Measured before writing this file:
--
--   * `le_verification_log` has verifier columns and, across 72 live rows, `verifier_id` is
--     NULL in every one and `verifier_role` is 'system' in every one. It is Arena-scoped
--     (activation/contract) and carries no training, progress or behaviour lineage.
--   * `bty_action_contracts` has no event_id or progress_id column at all, and its Host review
--     attests to a submitted PLAN, not to seeing a behaviour.
--   * Reality Event participation records attendance, which is not observation.
--
-- So no existing table can answer "who observed which learner, for which training, against
-- which immutable standard, and what did they report?". This one can, and nothing else changes.
--
-- The PARENT is the follow-up obligation, because it already binds progress_id, event_id and
-- user_id_snapshot to the published training — the lineage 3.2M-3 proved.
create table if not exists public.foundry_behavior_observations (
  id uuid primary key default gen_random_uuid(),

  -- Canonical parent. Its FKs already prove learner + event + published training.
  followup_id uuid not null references public.foundry_participant_followups (id) on delete cascade,

  -- WHO observed. The whole point of this table: an identity that actually exists.
  observer_user_id uuid not null,
  -- WHO was observed, snapshotted so a later membership change cannot rewrite history.
  learner_user_id_snapshot uuid not null,
  -- Which authority edge permitted it, for provenance. Null only if the edge is later deleted.
  authority_edge_id uuid,
  organization_id_snapshot uuid,

  -- WHAT they were asked to watch for: the frozen observable_standard, copied at submission so
  -- the attestation cannot drift from the sentence the observer actually read.
  observed_standard_snapshot text not null,

  -- What they personally saw or heard. NOT a judgement of the person.
  outcome text not null,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint foundry_observation_outcome_check
    check (outcome in ('OBSERVED', 'NOT_OBSERVED', 'UNABLE_TO_TELL')),
  -- Nobody confirms their own behaviour. Enforced in the service by the non-self edge
  -- authority, and again here so no future writer can bypass it.
  constraint foundry_observation_not_self_check
    check (observer_user_id <> learner_user_id_snapshot)
);

comment on table public.foundry_behavior_observations is
  'Slice 3.2M-4 — append-only. One row per submitted observation of a Guided behaviour by a '
  'distinct authorized person. Never updated: a later report is a new row, so disagreement '
  'between observers, and an observer changing their mind, both remain visible.';
comment on column public.foundry_behavior_observations.outcome is
  'OBSERVED = they personally saw or heard it. NOT_OBSERVED = they did not see it, which is '
  'NOT a claim that it did not happen. UNABLE_TO_TELL = they could not judge. Only OBSERVED '
  'establishes the OBSERVED evidence rung.';

create index if not exists foundry_observations_followup_idx
  on public.foundry_behavior_observations (followup_id, submitted_at desc);
create index if not exists foundry_observations_observer_idx
  on public.foundry_behavior_observations (observer_user_id, submitted_at desc);

-- Client-deny, service-role only — the same posture as the follow-up tables it hangs from.
revoke all on public.foundry_behavior_observations from anon, public, authenticated;
alter table public.foundry_behavior_observations enable row level security;
