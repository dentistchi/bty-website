-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- BUILD 26T-R1B-R6-R1B-R5 — the durable backend state MARK_UNAVAILABLE needs, and the
-- permission to actually clear YouTube API Data.
--
-- WHY A COLUMN AND NOT A NULL TEST. `youtube_title IS NULL` cannot mean "unavailable", because
-- NULL already means legacy / unknown / never-captured on rows written long before provenance
-- existed. An explicit instant is the smallest state that distinguishes "we asked YouTube and it
-- told us this cannot be represented" from "we never knew". NULL therefore does NOT mean
-- unavailable — it means no such determination has been made.
--
-- WHY NOT AN ENUM / STATE MACHINE. There is exactly one determination to record and one fact about
-- it (when it was made). A single nullable timestamptz carries both. An enum would add a second
-- vocabulary to keep in sync with the retention taxonomy without recording anything the timestamp
-- does not already say, so it is not used. If a future slice needs to distinguish deleted from
-- private from region-blocked, that is an ADDITIVE reason column then — not speculative shape now.
--
-- WHY THE NOT NULLs COME OFF. The ratified contract clears the YouTube identifier on
-- HARD_UNAVAILABLE while preserving the BTY row. `karaoke_requests.youtube_video_id NOT NULL` and
-- `karaoke_user_saved_songs.video_id / title_snapshot NOT NULL` make that transition structurally
-- impossible: the only ways to satisfy them are to delete the BTY row (forbidden) or to
-- manufacture placeholder text (forbidden). So the columns become nullable. Nothing is relaxed
-- beyond that: the format CHECKs still hold for every non-NULL value.

begin;

-- ---------------------------------------------------------------------------
-- REQUESTS
-- ---------------------------------------------------------------------------
alter table public.karaoke_requests
  alter column youtube_video_id drop not null;

alter table public.karaoke_requests
  add column if not exists youtube_metadata_unavailable_at timestamptz;

comment on column public.karaoke_requests.youtube_metadata_unavailable_at is
  'BUILD 26T-R1B-R6-R1B-R5. Non-NULL = a factual YouTube retention refresh determined this item '
  'HARD_UNAVAILABLE at this instant and the API Data was cleared. NULL = no such determination '
  '(including every legacy row). Server maintenance path only; never client-writable.';

-- The identifier was NOT NULL, so no existing row can have lost it by accident. Preserve the
-- format guarantee for every value that IS present, now that NULL is representable.
alter table public.karaoke_requests
  drop constraint if exists karaoke_requests_video_id_present_or_unavailable;
alter table public.karaoke_requests
  add constraint karaoke_requests_video_id_present_or_unavailable
  check (
    youtube_video_id is not null
    or youtube_metadata_unavailable_at is not null
  ) not valid;
-- NOT VALID deliberately: it constrains FUTURE writes without re-reading every historical row,
-- and no historical row can violate it anyway (the column was NOT NULL until this migration).

-- COHERENCE. "Successful valid fresh metadata must not coexist with a stale unavailable marker"
-- is enforced by the DATABASE, not by remembering to clear it in application code.
alter table public.karaoke_requests
  drop constraint if exists karaoke_requests_unavailable_excludes_freshness;
alter table public.karaoke_requests
  add constraint karaoke_requests_unavailable_excludes_freshness
  check (
    youtube_metadata_unavailable_at is null
    or (
      youtube_metadata_fetched_at is null
      and youtube_video_id is null
      and youtube_title is null
      and youtube_channel_title is null
      and youtube_thumbnail_url is null
    )
  );

-- ---------------------------------------------------------------------------
-- SAVED SONGS
-- ---------------------------------------------------------------------------
alter table public.karaoke_user_saved_songs
  alter column video_id drop not null;
alter table public.karaoke_user_saved_songs
  alter column title_snapshot drop not null;

alter table public.karaoke_user_saved_songs
  add column if not exists youtube_metadata_unavailable_at timestamptz;

comment on column public.karaoke_user_saved_songs.youtube_metadata_unavailable_at is
  'BUILD 26T-R1B-R6-R1B-R5. Non-NULL = a factual YouTube retention refresh determined this item '
  'HARD_UNAVAILABLE at this instant and the API Data was cleared. NULL = no such determination. '
  'Server maintenance path only; never client-writable.';

alter table public.karaoke_user_saved_songs
  drop constraint if exists karaoke_saved_songs_video_id_present_or_unavailable;
alter table public.karaoke_user_saved_songs
  add constraint karaoke_saved_songs_video_id_present_or_unavailable
  check (
    video_id is not null
    or youtube_metadata_unavailable_at is not null
  ) not valid;

alter table public.karaoke_user_saved_songs
  drop constraint if exists karaoke_saved_songs_unavailable_excludes_freshness;
alter table public.karaoke_user_saved_songs
  add constraint karaoke_saved_songs_unavailable_excludes_freshness
  check (
    youtube_metadata_unavailable_at is null
    or (
      youtube_metadata_fetched_at is null
      and video_id is null
      and title_snapshot is null
      and artist_snapshot is null
      and thumbnail_url_snapshot is null
    )
  );

-- ---------------------------------------------------------------------------
-- SWEEPER SELECTION INDEXES
-- ---------------------------------------------------------------------------
-- Partial, because the sweeper only ever asks for rows that still hold API Data. A row already
-- marked unavailable has nothing left to clear and must never be re-selected.
create index if not exists karaoke_requests_retention_due_idx
  on public.karaoke_requests (youtube_metadata_fetched_at nulls first, id)
  where youtube_metadata_unavailable_at is null and youtube_video_id is not null;

create index if not exists karaoke_saved_songs_retention_due_idx
  on public.karaoke_user_saved_songs (youtube_metadata_fetched_at nulls first, id)
  where youtube_metadata_unavailable_at is null and video_id is not null;

-- karaoke_video_durations gets NO unavailable marker. Nothing reads such a state: a duration that
-- cannot be refreshed is simply deleted or left to be re-resolved, and inventing a marker with no
-- reader would be state nobody maintains.

-- ---------------------------------------------------------------------------
-- SELECTION — ONE definition, shared
-- ---------------------------------------------------------------------------
-- The sweeper (TypeScript) and the validation matrix (SQL) must agree about which rows are due.
-- If each carried its own copy of the predicate they would drift, and the test would then be
-- verifying a rule the sweeper does not use. These views are that single definition.
--
-- `nulls first` in the ordering is deliberate: UNKNOWN_PROVENANCE rows are the ones whose age we
-- cannot bound at all, so they are remediated before rows we can still measure.

create or replace view public.karaoke_retention_due_requests as
  select id, youtube_video_id, youtube_metadata_fetched_at, status, event_id
    from public.karaoke_requests
   where youtube_metadata_unavailable_at is null
     and youtube_video_id is not null
     -- UNKNOWN (NULL) is due. It is never fresh, because an unknown age cannot be spent as a
     -- young one. created_at is deliberately absent from this predicate.
     and (youtube_metadata_fetched_at is null
          or youtube_metadata_fetched_at <= now() - interval '23 days');

create or replace view public.karaoke_retention_due_saved_songs as
  select id, video_id, youtube_metadata_fetched_at, account_id
    from public.karaoke_user_saved_songs
   where youtube_metadata_unavailable_at is null
     and video_id is not null
     and (youtube_metadata_fetched_at is null
          or youtube_metadata_fetched_at <= now() - interval '23 days');

-- Duration has its OWN factual clock and must never borrow the metadata one.
create or replace view public.karaoke_retention_due_durations as
  select video_id, resolved_at
    from public.karaoke_video_durations
   where resolved_at is null
      or resolved_at <= now() - interval '23 days';

-- Views inherit the default-deny posture of their base tables; the server (service_role) is the
-- only reader, exactly as for every other karaoke relation.
revoke all on public.karaoke_retention_due_requests    from anon, authenticated;
revoke all on public.karaoke_retention_due_saved_songs  from anon, authenticated;
revoke all on public.karaoke_retention_due_durations    from anon, authenticated;

commit;
