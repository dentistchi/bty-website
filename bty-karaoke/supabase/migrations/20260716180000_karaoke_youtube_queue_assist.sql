-- V8 Admin YouTube Queue Assist — mark a request as "prepared in the TV queue".
--
-- Distinct from ready_at (the GUEST said "I'm ready"): youtube_queued_at means the
-- ADMIN has added this song to the YouTube TV queue on the one connected device.
-- Both are needed for pass-turn auto-promotion (a song auto-starts in BTY only if
-- its singer is ready AND it is queued on the TV). Never guest-settable; the Admin
-- sets/clears it. Meaningful only on a still-`waiting` request; cleared when the
-- Event ends (with the waiting queue).
--
-- Additive + nullable + idempotent — the exact shape of the ready_at signal.
--
-- Rollback: alter table public.karaoke_requests drop column if exists youtube_queued_at;

alter table public.karaoke_requests
  add column if not exists youtube_queued_at timestamptz;
