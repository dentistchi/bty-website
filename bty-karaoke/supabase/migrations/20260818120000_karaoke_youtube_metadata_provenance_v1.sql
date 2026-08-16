-- BUILD 26T-R1B-R6-R1B — factual YouTube metadata freshness provenance.
--
-- WHY A NEW COLUMN, AND ONLY ON THESE TWO TABLES. karaoke_requests and
-- karaoke_user_saved_songs take their title/channel/thumbnail/video id from the CLIENT's POST
-- body, and BUILD 18B can replay a durable intent that re-sends an older payload verbatim. So
-- created_at is when BTY recorded the row, never when YouTube was asked, and inferring one from
-- the other would manufacture a freshness fact that does not exist.
--
-- karaoke_video_durations is DELIBERATELY NOT TOUCHED: its resolved_at is already factual
-- (upsertDurations writes it in the same server call that fetched from YouTube), so adding a
-- second provenance column there would create two sources of truth for one fact.
--
-- NULL means PROVENANCE UNKNOWN, and the sweeper must treat unknown as NOT FRESH. Existing rows
-- are left NULL: nothing is backfilled, because nothing about them is known.
alter table public.karaoke_requests
  add column if not exists youtube_metadata_fetched_at timestamptz;

alter table public.karaoke_user_saved_songs
  add column if not exists youtube_metadata_fetched_at timestamptz;

comment on column public.karaoke_requests.youtube_metadata_fetched_at is
  'When the YouTube API Data on this row was actually fetched. NULL = provenance unknown (never '
  'inferred from created_at, which is the BTY request-recording time). Set only from a factual '
  'search-fetch instant propagated through the request contract; a BUILD 18B replay must preserve '
  'the ORIGINAL value, because a replay is not a refresh.';

comment on column public.karaoke_user_saved_songs.youtube_metadata_fetched_at is
  'When the YouTube API Data on this row was actually fetched. NULL = provenance unknown. Same '
  'rule as karaoke_requests: never inferred from created_at.';

-- Partial indexes for the two sweeper selections. Their invariant: the sweeper must be able to
-- find (a) rows whose provenance is unknown and (b) rows approaching the freshness limit, without
-- scanning history that is already known-fresh.
create index if not exists karaoke_requests_yt_unknown_provenance_idx
  on public.karaoke_requests (created_at)
  where youtube_metadata_fetched_at is null and youtube_video_id is not null;

create index if not exists karaoke_requests_yt_fetched_at_idx
  on public.karaoke_requests (youtube_metadata_fetched_at)
  where youtube_metadata_fetched_at is not null;

create index if not exists karaoke_saved_songs_yt_unknown_provenance_idx
  on public.karaoke_user_saved_songs (created_at)
  where youtube_metadata_fetched_at is null;

create index if not exists karaoke_saved_songs_yt_fetched_at_idx
  on public.karaoke_user_saved_songs (youtube_metadata_fetched_at)
  where youtube_metadata_fetched_at is not null;
