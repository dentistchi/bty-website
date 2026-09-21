-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- =============================================================================
-- Quick Training Quiz Authoring — V1
--
-- PRODUCTION-EFFECTIVE: a single shared Supabase project backs all workers; this
-- lands on live data once applied. Idempotent + replay-safe. Purely RELAXING:
-- no table is created, no column is dropped, no type is changed, no row is
-- rewritten, no grant or RLS policy is touched, and nothing is backfilled.
--
-- WHAT WAS MEASURED, AND WHY THIS EXISTS.
--
-- Quick Training stores the learner's completion check in three different places,
-- one per material type:
--
--   youtube          foundry_event_training_content.completion_prompt
--                    text NOT NULL, CHECK char_length(btrim(...)) BETWEEN 1 AND 300
--
--   document (PDF)   foundry_event_document_content.completion_prompt
--                    text NOT NULL, CHECK char_length(btrim(...)) BETWEEN 1 AND 300
--
--   written_guidance foundry_event_module.module_snapshot -> 'publishedGuidanceV1'
--                    ->> 'completionPrompt'; `buildPublishedGuidance` refuses to
--                    freeze a contract without it and `readPublishedGuidance`
--                    reads such a snapshot as unavailable.
--
-- So, as measured, a Quick Training could not exist without a completion question
-- in ANY of the three. A quiz-backed training has no completion question: the
-- learner's immutable, server-scored attempt IS the completion evidence, and the
-- progress-row constraint added by 20260923000000 already accepts a quiz attempt
-- in place of `response_text`. The remaining obstacle was this NOT NULL.
--
-- The two ways to keep the column non-null were both rejected as untruthful:
-- storing a placeholder question no Host wrote and no learner is ever shown, or
-- asking the learner to answer a written question AND take a quiz to prove the
-- same thing once. So the column becomes nullable and the length bound is kept
-- for every value that is present.
--
-- NULL IS NOT "NO CHECK". It means "the check is the quiz". The service layer is
-- what pins that: `planCompletionEvidence` requires a completion question unless a
-- validated quiz is attached in the same request, `attachReviewedQuiz` is the only
-- writer of `foundry_event_quizzes`, and a failed quiz insert compensates by
-- deleting the event. A legacy NON-QUIZ training therefore still requires its
-- completion question, exactly as it always has, and this migration does not and
-- cannot relax that.
--
-- WHY THE DATABASE DOES NOT ENFORCE "NULL ⇒ QUIZ" ITSELF. It would need to read
-- `foundry_event_quizzes` from a constraint on the content table. A row-level
-- trigger fires before the quiz row exists (the event must exist first, so the
-- quiz cannot be written before the content), and a DEFERRABLE constraint trigger
-- only helps inside one transaction — which these writes, made as separate
-- PostgREST calls, are not. A trigger that could not be satisfied would be worse
-- than none, so the rule lives where it can actually be applied.
--
--   3. foundry_event_module.source_draft_id — NOT NULL dropped.
--
--      TEXT Quick Training reuses the `written_guidance` runtime exactly, which
--      means its frozen content rides `foundry_event_module.module_snapshot` like
--      every other guidance event. That table was built as the output of a Guided
--      builder draft and `source_draft_id` carried the publish-idempotency
--      boundary. A Quick Training has no draft. Minting a placeholder draft row to
--      fill the column would put a training the Host never authored into the
--      Builder's draft list and offer to "create a new version" of a design that
--      does not exist, so the honest value — NULL — is stored instead.
--
--      UNIQUE is unaffected: PostgreSQL treats NULLs as distinct, so any number of
--      draft-less modules coexist while at most one module per draft remains.
--      `resolveSource` already reads a missing `source_draft_id` as
--      `not_guided_program`, which is precisely what a Quick Training is.
--
-- Rollback (safe only while no row relies on the relaxation):
--   ALTER TABLE public.foundry_event_module ALTER COLUMN source_draft_id SET NOT NULL;
--   ALTER TABLE public.foundry_event_document_content
--     DROP CONSTRAINT IF EXISTS foundry_document_content_prompt_len_check;
--   ALTER TABLE public.foundry_event_document_content
--     ADD CONSTRAINT foundry_document_content_prompt_len_check
--     CHECK (char_length(btrim(completion_prompt)) between 1 and 300);
--   ALTER TABLE public.foundry_event_document_content ALTER COLUMN completion_prompt SET NOT NULL;
--   ALTER TABLE public.foundry_event_training_content
--     DROP CONSTRAINT IF EXISTS foundry_training_content_prompt_len_check;
--   ALTER TABLE public.foundry_event_training_content
--     ADD CONSTRAINT foundry_training_content_prompt_len_check
--     CHECK (char_length(btrim(completion_prompt)) between 1 and 300);
--   ALTER TABLE public.foundry_event_training_content ALTER COLUMN completion_prompt SET NOT NULL;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. YouTube training content. The bound survives for every present value; only
--    absence becomes legal, and only for a quiz-backed training.
-- ---------------------------------------------------------------------------
alter table public.foundry_event_training_content
  alter column completion_prompt drop not null;

alter table public.foundry_event_training_content
  drop constraint if exists foundry_training_content_prompt_len_check;
alter table public.foundry_event_training_content
  add constraint foundry_training_content_prompt_len_check
  check (
    completion_prompt is null
    or char_length(btrim(completion_prompt)) between 1 and 300
  );

comment on column public.foundry_event_training_content.completion_prompt is
  'The written completion check the learner answers. NULL means this training is completed by its attached quiz (foundry_event_quizzes) and no completion question is asked. Never a placeholder.';

-- ---------------------------------------------------------------------------
-- 2. PDF document content. Same relaxation, same bound, same meaning.
-- ---------------------------------------------------------------------------
alter table public.foundry_event_document_content
  alter column completion_prompt drop not null;

alter table public.foundry_event_document_content
  drop constraint if exists foundry_document_content_prompt_len_check;
alter table public.foundry_event_document_content
  add constraint foundry_document_content_prompt_len_check
  check (
    completion_prompt is null
    or char_length(btrim(completion_prompt)) between 1 and 300
  );

comment on column public.foundry_event_document_content.completion_prompt is
  'The written completion check the learner answers. NULL means this training is completed by its attached quiz (foundry_event_quizzes) and no completion question is asked. Never a placeholder.';

-- ---------------------------------------------------------------------------
-- 3. A frozen module snapshot may have no source draft (TEXT Quick Training).
-- ---------------------------------------------------------------------------
alter table public.foundry_event_module
  alter column source_draft_id drop not null;

comment on column public.foundry_event_module.source_draft_id is
  'The Guided builder draft this immutable snapshot was published from. NULL for a Quick Training, which has no draft; UNIQUE still admits at most one module per draft because NULLs are distinct.';
