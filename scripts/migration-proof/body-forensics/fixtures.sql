-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- Deterministic fixtures for the FUNCTION BODY FORENSICS harness (Slice 3.2I-R2.7).
-- ===========================================================================
-- Re-runnable: truncates and re-seeds the exact same rows so every body variant
-- is measured against an IDENTICAL starting state. No application content — all
-- values are synthetic technical fixtures.
--
-- Identities (stable across runs):
--   OWNER_A  11111111-…  owns EVENT_A
--   OWNER_B  22222222-…  owns EVENT_B (foreign-owner probe)
--   PART_1   c1111111-…  has a SUBMITTED shared response on EVENT_A
--   PART_2   c2222222-…  has a progress row with NO shared response
--   PART_3   c3333333-…  has NO progress row at all
--   USER_1   d1111111-…  owns the PENDING + RESPONDED follow-ups
--   USER_2   d2222222-…  foreign learner (never owns anything here)
-- ===========================================================================

truncate table public.foundry_shared_review_audit;
truncate table public.foundry_participant_followup_audit;
delete from public.foundry_participant_followups;
delete from public.foundry_event_training_progress;
delete from public.foundry_events;

-- Actor identities. foundry_shared_review_audit.reviewed_by is a real FK to
-- auth.users, so every actor uuid used below must exist or the audit INSERT
-- fails with 23503 and would be misread as a body defect.
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('d1111111-1111-1111-1111-111111111111'),
  ('d2222222-2222-2222-2222-222222222222')
on conflict (id) do nothing;

insert into public.foundry_events (id, owner_user_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222');

-- PROG_1 — reviewable: a submitted shared response, not yet reviewed.
insert into public.foundry_event_training_progress
  (id, event_id, participant_id, shared_understanding_response, shared_response_submitted_at, updated_at)
values
  ('e1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'c1111111-1111-1111-1111-111111111111', 'fixture shared answer', '2026-07-01T00:00:00Z', '2026-07-01T00:00:00Z');

-- PROG_2 — same event, NO shared response (the no_shared_response probe).
insert into public.foundry_event_training_progress
  (id, event_id, participant_id, shared_understanding_response, shared_response_submitted_at, updated_at)
values
  ('e2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'c2222222-2222-2222-2222-222222222222', null, null, '2026-07-01T00:00:00Z');

-- PROG_B — an EVENT_B row, used to prove no cross-account mutation.
insert into public.foundry_event_training_progress
  (id, event_id, participant_id, shared_understanding_response, shared_response_submitted_at, updated_at)
values
  ('e3333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'c1111111-1111-1111-1111-111111111111', 'other owner shared answer', '2026-07-01T00:00:00Z', '2026-07-01T00:00:00Z');

-- FU_PENDING — the normal submit target, owned by USER_1.
insert into public.foundry_participant_followups
  (id, event_id, progress_id, user_id_snapshot, source_training_title, follow_up_days,
   completed_at, timezone_snapshot, completion_bty_day, due_bty_day, due_at, status)
values
  ('f1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'e1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111',
   'fixture module', 7, '2026-07-01T00:00:00Z', 'Asia/Seoul', '2026-07-01', '2026-07-08',
   '2026-07-08T00:00:00Z', 'PENDING');

-- FU_RESPONDED — already answered NOT_YET (idempotency + conflict probes).
insert into public.foundry_participant_followups
  (id, event_id, progress_id, user_id_snapshot, source_training_title, follow_up_days,
   completed_at, timezone_snapshot, completion_bty_day, due_bty_day, due_at,
   status, outcome, responded_at)
values
  ('f2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'e2222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111',
   'fixture module', 30, '2026-07-01T00:00:00Z', 'Asia/Seoul', '2026-07-01', '2026-07-31',
   '2026-07-31T00:00:00Z', 'RESPONDED', 'NOT_YET', '2026-07-02T00:00:00Z');
