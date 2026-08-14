-- SLICE 3.2R-R8B — the learner's own reflection.
--
-- A published Guided Authorship program contains a `reflection` element: a question that asks
-- the learner to examine what ALREADY happens. Canonical v3 asks "What usually happens when an
-- action needs an owner after a huddle?". Since 3.2R-R8A that question is delivered and visible
-- on the learner's screen — and there is nowhere to answer it.
--
-- The answer the learner actually gives at completion is the answer to `completion_check`
-- ("What exactly will you say when you state the owner, action, and deadline?"), stored in
-- `response_text` under a label that says REFLECTION. Those are different acts. Examining
-- current practice is not the same as committing to a sentence, and one column cannot honestly
-- mean both. Today REFLECTED would be established by a commitment.
--
-- DELIBERATELY NOT REUSING AN EXISTING COLUMN. Four were considered:
--   response_text                 the answer to the completion check; already the completion
--                                 requirement enforced by
--                                 foundry_training_progress_completed_needs_evidence_and_response_check.
--   shared_understanding_response answers the Host-configured shared question; Host-visible.
--   decision_response_text        Slice 3.2M-1: what the learner will DO; Host-visible.
--   reflection (jsonb)            NOT a learner answer at all — the GENERATED four-section
--                                 Living Reflection, written with reflection_version /
--                                 reflection_generated_at. 17 rows carry one today.
-- Every one of them already means something else.
--
-- NAMED `learner_reflection_*`, NOT `reflection_response_*`, precisely because of that last
-- one: a column called `reflection_response_text` would sit in a column list beside
-- `reflection`, `reflection_version` and `reflection_generated_at` and read as part of the
-- generated family. The author is the distinction that matters here, so the name states it.
--
-- PRIVATE, like response_text. This is the learner examining their own practice, and no
-- existing product authority makes that Host-visible. The Host's window stays
-- shared_understanding_response.
--
-- NO BACKFILL. A NULL here means the learner was never asked, which is true of every row that
-- exists: measured on staging, 30 rows carry a response_text and exactly one of them belongs to
-- an event whose published journey had a distinct reflection element (v1, 07c9623e, closed).
-- Manufacturing an answer from a commitment sentence would fabricate the exact evidence this
-- column exists to make honest.
--
-- Two nullable columns, the same shape 3.1B-3G and 3.2M-1 already established. Idempotent.
alter table public.foundry_event_training_progress
  add column if not exists learner_reflection_text text,
  add column if not exists learner_reflection_submitted_at timestamptz;

comment on column public.foundry_event_training_progress.learner_reflection_text is
  'Slice 3.2R-R8B — the LEARNER''s answer to the published journey''s reflection element: what '
  'already happens, in their own words. PRIVATE — never Host-visible, the same rule as '
  'response_text. Never the completion-check answer (response_text), never the Shared '
  'Understanding answer, never the decision (decision_response_text), and never the GENERATED '
  'Living Reflection (the reflection jsonb column). Required at completion only when the '
  'published journey contains a grounded reflection element. This column, and only this '
  'column, establishes REFLECTED for a row that has one.';
comment on column public.foundry_event_training_progress.learner_reflection_submitted_at is
  'Slice 3.2R-R8B — when the learner submitted their reflection. Set together with '
  'learner_reflection_text, in the same completion write.';

-- Both together or neither: a timestamp without a reflection would claim evidence that does not
-- exist, and a reflection without one could not be placed in time. Same pairing rule as
-- foundry_progress_decision_pair_chk.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'foundry_progress_learner_reflection_pair_chk'
      and conrelid = 'public.foundry_event_training_progress'::regclass
  ) then
    alter table public.foundry_event_training_progress
      add constraint foundry_progress_learner_reflection_pair_chk
      check ((learner_reflection_text is null) = (learner_reflection_submitted_at is null));
  end if;
end $$;

-- The same length bound every other learner-authored answer already has.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'foundry_progress_learner_reflection_len_chk'
      and conrelid = 'public.foundry_event_training_progress'::regclass
  ) then
    alter table public.foundry_event_training_progress
      add constraint foundry_progress_learner_reflection_len_chk
      check (learner_reflection_text is null
             or char_length(btrim(learner_reflection_text)) between 1 and 1000);
  end if;
end $$;

-- DELIBERATELY NOT ALTERED: foundry_training_progress_completed_needs_evidence_and_response_check
-- still requires response_text at completion. A legacy event with no journey reflection keeps
-- its exact old completion contract, and the new requirement is enforced in the service against
-- the FROZEN published journey — never by a constraint that cannot see which question was asked.
