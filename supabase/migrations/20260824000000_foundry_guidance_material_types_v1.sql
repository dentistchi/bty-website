-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- =============================================================================
-- Foundry Learning Material Completeness — V1  (Slice R4-R2G)
--
-- PRODUCTION-EFFECTIVE: single shared Supabase project backs all workers; this
-- lands on live data once applied. Idempotent + replay-safe.
--
-- WHAT THIS ADDS. The BTY Learning OS product architecture approves FOUR V1
-- learning-material types. Two shipped (YouTube, PDF). This migration makes the
-- other two — Written guidance and Live discussion — representable, and does so
-- WITHOUT a new content table: their participant-facing content rides the
-- existing immutable `foundry_event_module.module_snapshot` as one namespaced
-- versioned contract (`publishedGuidanceV1`), exactly as the approved Journey
-- already does in that same jsonb.
--
--   1. foundry_events.content_type CHECK — widened from ('youtube','document')
--      to include 'written_guidance' and 'live_discussion'. A WIDENING: every
--      one of the 46 existing rows (19 youtube / 27 document, measured live)
--      already satisfies the new form. No backfill. No row is reinterpreted.
--
--   2. foundry_event_training_progress — TWO new nullable exposure stamps.
--      Both additive; every existing progress row is unaffected.
--
--        written_guidance_read_at     — the learner explicitly acknowledged
--                                       having read the guidance, AFTER it was
--                                       rendered. This is EXPOSURE/READ evidence
--                                       and nothing more. It is not, and must
--                                       never be reported as, understanding.
--
--        discussion_self_reported_at  — the learner stated that they took part
--                                       in the discussion. PARTICIPANT-REPORTED
--                                       ONLY. It is NOT attendance, NOT verified,
--                                       NOT observed, and no Host, facilitator or
--                                       device contributes to it. The column is
--                                       deliberately named for the act of
--                                       self-reporting rather than for the
--                                       discussion, so that no later reader — and
--                                       no later query — can mistake this row for
--                                       a record that the discussion happened.
--
--      There is NO attendance table, NO roster of who attended, NO scheduling
--      and NO transcript in this migration, and the product decision behind it
--      is that BTY does not possess that evidence and will not imply it.
--
--   3. Relaxed completion CHECK — completion now requires a response AND ANY ONE
--      of the four exposure stamps. The YouTube and PDF paths are preserved
--      EXACTLY: a video progress row still needs video_completed_at, a document
--      row still needs document_read_completed_at, and every already-completed
--      row satisfies the new form unchanged (it is a strict widening of the
--      disjunction).
--
-- WHAT THIS DOES NOT DO: no new table, no dropped column, no type change, no
-- backfill, no data rewrite, no XP/league/leaderboard linkage, no change to any
-- RLS policy or grant. Core XP is unchanged and is still awarded only by the
-- canonical completion path, never by an exposure stamp on its own.
--
-- Rollback (reverse order; safe only while no row uses the new values/stamps):
--   ALTER TABLE public.foundry_event_training_progress
--     DROP CONSTRAINT IF EXISTS foundry_training_progress_completed_needs_evidence_and_response_check;
--   ALTER TABLE public.foundry_event_training_progress
--     ADD CONSTRAINT foundry_training_progress_completed_needs_evidence_and_response_check
--     CHECK (completed_at is null or (response_text is not null
--            and char_length(btrim(response_text)) between 1 and 1000
--            and (video_completed_at is not null or document_read_completed_at is not null)));
--   ALTER TABLE public.foundry_event_training_progress
--     DROP COLUMN IF EXISTS written_guidance_read_at,
--     DROP COLUMN IF EXISTS discussion_self_reported_at;
--   ALTER TABLE public.foundry_events DROP CONSTRAINT IF EXISTS foundry_events_content_type_check;
--   ALTER TABLE public.foundry_events ADD CONSTRAINT foundry_events_content_type_check
--     CHECK (content_type in ('youtube','document'));
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Widen the content-type discriminator. DROP-then-ADD inside the migration's
--    transaction, so the table is never observably unconstrained. The old
--    constraint was created conditionally, so DROP IF EXISTS is the replay-safe
--    form: re-running this file re-asserts the same widened check.
-- ---------------------------------------------------------------------------
alter table public.foundry_events
  drop constraint if exists foundry_events_content_type_check;

alter table public.foundry_events
  add constraint foundry_events_content_type_check
  check (content_type in ('youtube', 'document', 'written_guidance', 'live_discussion'));

-- ---------------------------------------------------------------------------
-- 2. The two new exposure stamps. Nullable and defaultless: absent means the
--    learner has not done the thing, which is the truthful reading for every
--    existing row and for every future row of the other two content types.
-- ---------------------------------------------------------------------------
alter table public.foundry_event_training_progress
  add column if not exists written_guidance_read_at timestamptz,
  add column if not exists discussion_self_reported_at timestamptz;

comment on column public.foundry_event_training_progress.written_guidance_read_at is
  'R4-R2G. Learner explicitly acknowledged reading the written guidance after it was rendered. EXPOSURE/READ evidence only — never understanding.';

comment on column public.foundry_event_training_progress.discussion_self_reported_at is
  'R4-R2G. Learner self-reported taking part in the live discussion. PARTICIPANT-REPORTED ONLY — never attendance, never verified, never observed. No host or device input contributes to this value.';

-- ---------------------------------------------------------------------------
-- 3. Accept any of the four exposure shapes. The response remains mandatory and
--    its bounds are unchanged; only the "did the participant engage the content"
--    disjunction grows. Strictly wider than the constraint it replaces, so no
--    existing completed row can be invalidated by it.
-- ---------------------------------------------------------------------------
alter table public.foundry_event_training_progress
  drop constraint if exists foundry_training_progress_completed_needs_video_and_response_check;
alter table public.foundry_event_training_progress
  drop constraint if exists foundry_training_progress_completed_needs_evidence_and_response_check;
alter table public.foundry_event_training_progress
  add constraint foundry_training_progress_completed_needs_evidence_and_response_check
  check (
    completed_at is null
    or (
      response_text is not null
      and char_length(btrim(response_text)) between 1 and 1000
      and (
        video_completed_at is not null
        or document_read_completed_at is not null
        or written_guidance_read_at is not null
        or discussion_self_reported_at is not null
      )
    )
  );
