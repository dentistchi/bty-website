-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — SINGLE ADMIN PLAYER V6. A shared Ready signal so the ONE Admin
-- Player can see which next singer is ready before starting the song on the TV.
--
-- Additive + idempotent: a nullable timestamp on the existing request row. NOT a
-- status-enum change — Ready never occupies the stage. A guest sets ready_at while
-- their request is still 'waiting'; the Admin reads it; starting the song
-- (waiting -> playing) makes it moot. Clearing ("not yet") nulls it again.
-- Rollback: alter table public.karaoke_requests drop column if exists ready_at;
alter table public.karaoke_requests
  add column if not exists ready_at timestamptz;
