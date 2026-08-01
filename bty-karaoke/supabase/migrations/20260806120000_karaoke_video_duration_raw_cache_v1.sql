-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- BUILD 22 — PRE-QUEUE SONG DURATION ADMISSION V1 (additive; constraint broadening only).
--
-- WHY: karaoke_video_durations was created (20260803120000) as an ADMISSIBLE-duration cache —
--   duration_seconds int not null check (duration_seconds between 1 and 900)
-- so a positively parsed 901+ second duration could not be stored at all. The resolver caches
-- only on success, which means every single Start attempt on a 40-minute medley re-issued a
-- videos.list call against a finite daily quota, and the fact "this video is 8917 seconds long"
-- had nowhere to live. Measured in production: 6 of 224 distinct requested videoIds exceed 900s.
--
-- BUILD 22 moves the 900-second verdict to Guest request time, which multiplies that lookup
-- pressure across every search result and every submit. Caching the RAW duration is what keeps
-- that affordable: resolve once, classify forever.
--
-- WHAT CHANGES: this table becomes a RAW TRUSTED-DURATION cache. It stores what the provider
-- said; the 900-second ADMISSION POLICY is applied by readers, after the read. No row is
-- inserted, updated, deleted, or backfilled here.
--
-- WHAT DOES NOT CHANGE — verified line-by-line before writing this migration:
--   • karaoke_begin_song_v2 ALREADY re-checks the bound itself:
--         if v_dur is null or v_dur < 1 or v_dur > 900 then return 'duration_unavailable'
--     so a newly-cacheable 901 row still fails closed at Start with the SAME outcome, and the
--     BUILD 21 reason=too_long Host experience is reached exactly as it is today. Broadening
--     this constraint therefore cannot change any admission decision anywhere.
--   • resolveVideoDuration ALREADY classifies a cached out-of-bounds row as too_long without an
--     upstream call (pinned by a shipped BUILD 21 test using a cached 8917).
--   • Primary key, column set, RLS, grants, ownership, and the immutability contract are all
--     untouched. Playback-lease, usage-segment, timed-pass and Final Song Grace tables are not
--     referenced by this migration at all.
--
-- NO UNKNOWN IS EVER PERSISTED. A quota, network, timeout, or parse failure writes nothing —
-- this table only ever holds durations the provider positively stated. There is deliberately no
-- negative-verdict column: a failure is transient by nature and must be re-resolvable.
--
-- Forward-only: 20260803120000 is NOT edited in place. Rollback = restore the narrower check
-- (any already-cached 901+ rows must be deleted first, or the constraint will not validate);
-- doing so costs only re-lookups, because every reader classifies explicitly.

-- ── BROADEN THE RAW-DURATION CHECK ──
-- The original constraint was created inline and therefore carries PostgreSQL's generated name.
-- Drop it by that generated name AND by the new explicit name so this migration is idempotent
-- and safe to re-run. `if exists` on both keeps a partially-applied state recoverable.
alter table public.karaoke_video_durations
  drop constraint if exists karaoke_video_durations_duration_seconds_check;
alter table public.karaoke_video_durations
  drop constraint if exists karaoke_video_duration_seconds_positive;

-- The new bound is POSITIVE-ONLY, and deliberately carries NO upper limit.
--
-- R1 CORRECTION: an earlier draft of this migration added a 24-hour ceiling. That reintroduced
-- exactly the defect this table is being fixed for — a policy number constraining the RAW cache.
-- Any ceiling makes durations above it unstorable, so they fall back to a live lookup on every
-- single resolution: the same quota amplification, just relocated from 901s to 86401s. The cache
-- stores what the provider said; ONE place decides admissibility, and that place is
-- `classifyDurationAdmission` (1..900 allowed, 901+ too_long).
--
-- 0 and negatives remain rejected because they are not lengths — the same rule the application
-- classifier applies. Explicitly named so the deployed constraint is inspectable in pg_constraint
-- by a stable name.
alter table public.karaoke_video_durations
  add constraint karaoke_video_duration_seconds_positive
  check (duration_seconds > 0);

comment on column public.karaoke_video_durations.duration_seconds is
  'BUILD 22: RAW trusted duration in seconds as reported by the provider. NOT pre-filtered for '
  'admissibility and deliberately unbounded above — any positive integer is storable so the '
  'too-long verdict is durable and costs no repeat quota. Readers apply the 900s admission '
  'policy (classifyDurationAdmission); this column carries no policy of its own.';
