-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — LYRICS DISPLAY V1. Admin-provided lyrics attached to a single
-- request, so the iPad Karaoke Display can show the current song's words with no
-- extra guest action, no refresh, no external page.
--
-- Strategy (V1): Admin-provided lyrics + request-level persistence. No licensed
-- full-lyrics provider is wired in this environment, and snippet-only APIs
-- (Musixmatch/Genius) forbid caching full lyrics — so V1 stores ONLY what the
-- Admin types. `lyrics_source` = 'admin' for every row V1 writes; the enum and
-- `lyrics_source_url` are kept for a future licensed-provider path (unused now).
--
-- Additive + nullable + idempotent — the exact shape of the ready_at / queued
-- signals. Plain text only (rendered as text, never HTML). No separate lyrics
-- table: one nullable text column keeps the read model a single row, so the
-- Display polls lyrics inside the SAME state as NOW SINGING (no second fetch, so
-- no stale-lyrics race is even possible).
--
-- Rollback:
--   alter table public.karaoke_requests
--     drop column if exists lyrics_text,
--     drop column if exists lyrics_source,
--     drop column if exists lyrics_source_url,
--     drop column if exists lyrics_status,
--     drop column if exists lyrics_updated_at;

alter table public.karaoke_requests
  add column if not exists lyrics_text       text,
  add column if not exists lyrics_source     text,
  add column if not exists lyrics_source_url text,
  add column if not exists lyrics_status     text not null default 'unavailable',
  add column if not exists lyrics_updated_at timestamptz;

-- Guard the small closed sets. Idempotent: only add the constraint if absent.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'karaoke_requests_lyrics_status_chk'
  ) then
    alter table public.karaoke_requests
      add constraint karaoke_requests_lyrics_status_chk
      check (lyrics_status in ('unavailable','loading','available','failed'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'karaoke_requests_lyrics_source_chk'
  ) then
    alter table public.karaoke_requests
      add constraint karaoke_requests_lyrics_source_chk
      check (lyrics_source is null or lyrics_source in ('admin','provider'));
  end if;
end $$;
