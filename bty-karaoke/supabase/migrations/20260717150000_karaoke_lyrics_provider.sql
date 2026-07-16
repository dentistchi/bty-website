-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — AUTOMATIC LYRICS RESOLVER V1.1. Lyrics are now fetched
-- automatically (LRCLIB, server-side) when a song is playing; Admin text is only
-- an override. This migration is ADDITIVE on top of the V1 lyrics columns.
--
--   lyrics_synced      — LRCLIB syncedLyrics (LRC), stored for a future timed
--                        view. V1.1 renders plainLyrics; this is kept, not shown.
--   lyrics_resolved_at — when the AUTO resolver last attempted this row. NULL =
--                        never auto-attempted (the display resolver claims it
--                        once). Drives the retry policy; distinct from
--                        lyrics_updated_at (which also moves on a manual edit).
--
-- The source CHECK is widened to allow 'lrclib' (the first provider). 'admin'
-- still wins: the resolver never touches a row whose lyrics_source = 'admin'.
--
-- Rollback:
--   alter table public.karaoke_requests
--     drop column if exists lyrics_synced,
--     drop column if exists lyrics_resolved_at;
--   alter table public.karaoke_requests drop constraint if exists karaoke_requests_lyrics_source_chk;
--   alter table public.karaoke_requests add constraint karaoke_requests_lyrics_source_chk
--     check (lyrics_source is null or lyrics_source in ('admin','provider'));

alter table public.karaoke_requests
  add column if not exists lyrics_synced      text,
  add column if not exists lyrics_resolved_at timestamptz;

-- Widen the source set to include the LRCLIB provider. Idempotent: drop the V1
-- constraint (if present) and (re)create the V1.1 one only when absent.
alter table public.karaoke_requests
  drop constraint if exists karaoke_requests_lyrics_source_chk;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'karaoke_requests_lyrics_source_chk'
  ) then
    alter table public.karaoke_requests
      add constraint karaoke_requests_lyrics_source_chk
      check (lyrics_source is null or lyrics_source in ('admin','provider','lrclib'));
  end if;
end $$;
