-- SLICE 3.2M-1 — the learner's own decision.
--
-- A published Guided Authorship program can contain an `action_decision` section: BTY's
-- proposal for what a person might commit to. Until now the learner READ it and completed,
-- and the durable record supported exposure and reflection only. Reading someone else's
-- sentence is not a decision, so nothing could honestly establish DECIDED.
--
-- Deliberately NOT reusing an existing column. `response_text` is the PRIVATE reflection and
-- is never Host-visible; `shared_understanding_response` answers a Host-configured question.
-- Both already mean something else, and overloading either would make the evidence ledger
-- ambiguous exactly where it must not be.
--
-- Two nullable columns, the same shape the Shared Understanding pair already uses. Idempotent.
alter table public.foundry_event_training_progress
  add column if not exists decision_response_text text,
  add column if not exists decision_submitted_at timestamptz;

comment on column public.foundry_event_training_progress.decision_response_text is
  'Slice 3.2M-1 — what the LEARNER decided to do, in their own words. Host-visible. Never the '
  'private reflection (response_text) and never the Shared Understanding answer. Required at '
  'completion only when the published journey contains a grounded action_decision element.';
comment on column public.foundry_event_training_progress.decision_submitted_at is
  'Slice 3.2M-1 — when the learner submitted their decision. Set together with '
  'decision_response_text, in the same completion write.';

-- Both together or neither: a timestamp without a decision would claim evidence that does not
-- exist, and a decision without one could not be placed in time.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'foundry_progress_decision_pair_chk'
      and conrelid = 'public.foundry_event_training_progress'::regclass
  ) then
    alter table public.foundry_event_training_progress
      add constraint foundry_progress_decision_pair_chk
      check ((decision_response_text is null) = (decision_submitted_at is null));
  end if;
end $$;
