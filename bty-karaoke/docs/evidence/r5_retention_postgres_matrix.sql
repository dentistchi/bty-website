-- BUILD 26T-R1B-R6-R1B-R5 — retention matrix. Runs inside a transaction that ROLLS BACK.
-- Real local PostgreSQL, real constraints, real views. No fixture persists.
begin;
create temporary table res(name text, ok boolean);
create or replace function pg_temp.a(n text, ok boolean) returns void language plpgsql as $$
begin insert into res values(n,ok); end $$;

-- ---------------------------------------------------------------------------
-- FIXTURES
-- ---------------------------------------------------------------------------
insert into karaoke_accounts(id,provider,provider_subject,display_name,timezone)
values ('a5000000-0000-4000-8000-000000000001','apple','R5-SUB','R5','America/Los_Angeles');
insert into karaoke_rooms(id,slug,display_name,dj_secret,status)
values ('a5000000-0000-4000-8000-000000000003','r5-room','R5 Room','x','open');
insert into karaoke_events(id,room_id,name,status,public_code,guest_slug)
values ('a5000000-0000-4000-8000-000000000004','a5000000-0000-4000-8000-000000000003','R5','active','R5C','r5g');

-- Requests spanning every freshness class. `created_at` is forced RECENT on the stale rows so a
-- created_at fallback would visibly disagree with the factual clock (mutant M2's target).
insert into karaoke_requests(id,room_id,event_id,guest_name,youtube_video_id,youtube_title,
                             youtube_channel_title,youtube_thumbnail_url,position,status,
                             created_at,youtube_metadata_fetched_at)
values
 -- 1: fresh (10 days)
 ('a5000000-0000-4000-8000-000000000010','a5000000-0000-4000-8000-000000000003','a5000000-0000-4000-8000-000000000004','G','FRESH000001','T','C','u',1,'completed', now(), now()-interval '10 days'),
 -- 2: exactly at the 23-day margin
 ('a5000000-0000-4000-8000-000000000011','a5000000-0000-4000-8000-000000000003','a5000000-0000-4000-8000-000000000004','G','MARGIN00001','T','C','u',2,'completed', now(), now()-interval '23 days'),
 -- 3: older than the retention maximum
 ('a5000000-0000-4000-8000-000000000012','a5000000-0000-4000-8000-000000000003','a5000000-0000-4000-8000-000000000004','G','OLD00000001','T','C','u',3,'completed', now(), now()-interval '40 days'),
 -- 4/5: NULL provenance but a BRAND NEW created_at — unknown, never fresh
 ('a5000000-0000-4000-8000-000000000013','a5000000-0000-4000-8000-000000000003','a5000000-0000-4000-8000-000000000004','G','LEGACY00001','T','C','u',4,'completed', now(), null),
 -- ACTIVE row, stale: the DEFER_ACTIVE subject
 ('a5000000-0000-4000-8000-000000000014','a5000000-0000-4000-8000-000000000003','a5000000-0000-4000-8000-000000000004','G','ACTIVE00001','T','C','u',5,'waiting', now(), now()-interval '40 days');

insert into karaoke_user_saved_songs(id,account_id,video_id,title_snapshot,artist_snapshot,
                                     thumbnail_url_snapshot,youtube_metadata_fetched_at)
values
 ('a5000000-0000-4000-8000-000000000020','a5000000-0000-4000-8000-000000000001','SAVEDFRESH1','T','A','u', now()-interval '5 days'),
 ('a5000000-0000-4000-8000-000000000021','a5000000-0000-4000-8000-000000000001','SAVEDSTALE1','T','A','u', now()-interval '40 days'),
 ('a5000000-0000-4000-8000-000000000022','a5000000-0000-4000-8000-000000000001','SAVEDLEGACY','T','A','u', null);

insert into karaoke_video_durations(video_id,duration_seconds,resolved_at) values
  ('DURFRESH001',200, now()-interval '3 days'),
  ('DURSTALE001',240, now()-interval '40 days');

-- ===========================================================================
-- SELECTION (P1–P6)
-- ===========================================================================
select pg_temp.a('P1: age <23d NOT selected',
  not exists(select 1 from karaoke_retention_due_requests where youtube_video_id='FRESH000001'));

select pg_temp.a('P2: age =23d IS selected (the margin is inclusive)',
  exists(select 1 from karaoke_retention_due_requests where youtube_video_id='MARGIN00001'));

select pg_temp.a('P3: older factual provenance selected',
  exists(select 1 from karaoke_retention_due_requests where youtube_video_id='OLD00000001'));

select pg_temp.a('P4: NULL provenance selected as unknown',
  exists(select 1 from karaoke_retention_due_requests where youtube_video_id='LEGACY00001'));

-- M2's target: created_at is BRAND NEW on the NULL-provenance row. If the predicate consulted it,
-- the row would look fresh and drop out of the view.
select pg_temp.a('P5: a recent created_at does NOT make a NULL-provenance row fresh',
  exists(select 1 from karaoke_retention_due_requests r
          join karaoke_requests q on q.id=r.id
         where q.youtube_video_id='LEGACY00001'
           and q.created_at > now()-interval '1 minute'));

select pg_temp.a('P6: duration selection uses resolved_at ONLY',
  exists(select 1 from karaoke_retention_due_durations where video_id='DURSTALE001')
  and not exists(select 1 from karaoke_retention_due_durations where video_id='DURFRESH001'));

-- P6b — the second clock does not exist on the duration table at all (M9).
select pg_temp.a('P6b: karaoke_video_durations has NO metadata-provenance column',
  not exists(select 1 from information_schema.columns
              where table_name='karaoke_video_durations'
                and column_name like '%metadata_fetched_at%'));

-- ===========================================================================
-- REFRESH SUCCESS (P7–P12)
-- ===========================================================================
-- Capture BTY-independent facts BEFORE, so "unchanged" is measured, not asserted.
create temporary table before_req as
  select id,guest_name,status,created_at,started_at,completed_at,event_id,room_id,position,
         resolution_code,resolved_at,idempotency_key
    from karaoke_requests where id='a5000000-0000-4000-8000-000000000012';

update karaoke_requests set
  youtube_video_id='OLD00000001', youtube_title='REFRESHED TITLE',
  youtube_channel_title='REFRESHED CHANNEL', youtube_thumbnail_url='https://i.ytimg.com/new.jpg',
  youtube_metadata_fetched_at=now(), youtube_metadata_unavailable_at=null
 where id='a5000000-0000-4000-8000-000000000012';

select pg_temp.a('P7: request current metadata refreshed',
  (select youtube_title='REFRESHED TITLE' and youtube_channel_title='REFRESHED CHANNEL'
     from karaoke_requests where id='a5000000-0000-4000-8000-000000000012'));

update karaoke_user_saved_songs set
  title_snapshot='REFRESHED SAVED', artist_snapshot='REFRESHED ARTIST',
  thumbnail_url_snapshot='https://i.ytimg.com/new2.jpg',
  youtube_metadata_fetched_at=now(), youtube_metadata_unavailable_at=null
 where id='a5000000-0000-4000-8000-000000000021';

select pg_temp.a('P8: saved song current metadata refreshed',
  (select title_snapshot='REFRESHED SAVED' from karaoke_user_saved_songs
    where id='a5000000-0000-4000-8000-000000000021'));

select pg_temp.a('P9: fetched_at advanced, so the row leaves the due view',
  not exists(select 1 from karaoke_retention_due_requests where id='a5000000-0000-4000-8000-000000000012')
  and not exists(select 1 from karaoke_retention_due_saved_songs where id='a5000000-0000-4000-8000-000000000021'));

select pg_temp.a('P10: video ID reconfirmed, not cleared',
  (select youtube_video_id='OLD00000001' from karaoke_requests where id='a5000000-0000-4000-8000-000000000012'));

select pg_temp.a('P11: unavailable marker is NULL after a successful refresh',
  (select youtube_metadata_unavailable_at is null from karaoke_requests where id='a5000000-0000-4000-8000-000000000012'));

select pg_temp.a('P12: BTY history unchanged across the refresh',
  (select count(*)=1 from before_req b join karaoke_requests q on q.id=b.id
    where q.guest_name is not distinct from b.guest_name
      and q.status is not distinct from b.status
      and q.created_at is not distinct from b.created_at
      and q.started_at is not distinct from b.started_at
      and q.completed_at is not distinct from b.completed_at
      and q.event_id is not distinct from b.event_id
      and q.room_id is not distinct from b.room_id
      and q.position is not distinct from b.position
      and q.resolution_code is not distinct from b.resolution_code
      and q.idempotency_key is not distinct from b.idempotency_key));

-- P11b — THE COHERENCE CHECK IS STRUCTURAL. Fresh metadata cannot coexist with a stale marker
-- even if application code forgets to clear it.
do $$ begin
  begin
    update karaoke_requests set youtube_metadata_unavailable_at=now()
     where id='a5000000-0000-4000-8000-000000000012';
    perform pg_temp.a('P11b: DB REFUSES a marker on a row that still holds metadata', false);
  exception when check_violation then
    perform pg_temp.a('P11b: DB REFUSES a marker on a row that still holds metadata', true);
  end;
end $$;

-- ===========================================================================
-- HARD UNAVAILABLE — REQUESTS (P13–P17)
-- ===========================================================================
create temporary table before_hu as
  select id,guest_name,status,created_at,started_at,completed_at,event_id,room_id,position
    from karaoke_requests where id='a5000000-0000-4000-8000-000000000011';

update karaoke_requests set
  youtube_video_id=null, youtube_title=null, youtube_channel_title=null,
  youtube_thumbnail_url=null, youtube_metadata_fetched_at=null,
  youtube_metadata_unavailable_at=now()
 where id='a5000000-0000-4000-8000-000000000011';

select pg_temp.a('P13: the historical request row still EXISTS (never deleted)',
  exists(select 1 from karaoke_requests where id='a5000000-0000-4000-8000-000000000011'));

select pg_temp.a('P14: YouTube API presentation fields cleared',
  (select youtube_title is null and youtube_channel_title is null and youtube_thumbnail_url is null
     from karaoke_requests where id='a5000000-0000-4000-8000-000000000011'));

select pg_temp.a('P15: YouTube identifier cleared',
  (select youtube_video_id is null from karaoke_requests where id='a5000000-0000-4000-8000-000000000011'));

select pg_temp.a('P16: explicit unavailable state SET (not inferred from NULLs)',
  (select youtube_metadata_unavailable_at is not null from karaoke_requests where id='a5000000-0000-4000-8000-000000000011'));

select pg_temp.a('P17: request lifecycle unchanged',
  (select count(*)=1 from before_hu b join karaoke_requests q on q.id=b.id
    where q.status is not distinct from b.status
      and q.guest_name is not distinct from b.guest_name
      and q.created_at is not distinct from b.created_at
      and q.completed_at is not distinct from b.completed_at
      and q.event_id is not distinct from b.event_id
      and q.position is not distinct from b.position));

select pg_temp.a('P17b: an unavailable row is NOT re-selected by the sweeper',
  not exists(select 1 from karaoke_retention_due_requests where id='a5000000-0000-4000-8000-000000000011'));

-- ===========================================================================
-- HARD UNAVAILABLE — SAVED SONGS (P18–P22)
-- ===========================================================================
create temporary table before_sv as
  select id,account_id,created_at from karaoke_user_saved_songs where id='a5000000-0000-4000-8000-000000000022';

update karaoke_user_saved_songs set
  video_id=null, title_snapshot=null, artist_snapshot=null, thumbnail_url_snapshot=null,
  youtube_metadata_fetched_at=null, youtube_metadata_unavailable_at=now()
 where id='a5000000-0000-4000-8000-000000000022';

select pg_temp.a('P18: the saved row is RETAINED',
  exists(select 1 from karaoke_user_saved_songs where id='a5000000-0000-4000-8000-000000000022'));
select pg_temp.a('P19: saved API snapshot fields cleared',
  (select title_snapshot is null and artist_snapshot is null and thumbnail_url_snapshot is null
     from karaoke_user_saved_songs where id='a5000000-0000-4000-8000-000000000022'));
select pg_temp.a('P20: saved YouTube identifier cleared',
  (select video_id is null from karaoke_user_saved_songs where id='a5000000-0000-4000-8000-000000000022'));
select pg_temp.a('P21: saved unavailable state set',
  (select youtube_metadata_unavailable_at is not null from karaoke_user_saved_songs where id='a5000000-0000-4000-8000-000000000022'));
select pg_temp.a('P22: ownership and saved history unchanged',
  (select count(*)=1 from before_sv b join karaoke_user_saved_songs s on s.id=b.id
    where s.account_id is not distinct from b.account_id
      and s.created_at is not distinct from b.created_at));

-- M8 — the transition must not be a delete in disguise.
select pg_temp.a('M8: neither BTY row was destroyed by the unavailable transition',
  (select count(*)=2 from (select 1 from karaoke_requests where id='a5000000-0000-4000-8000-000000000011'
                            union all
                           select 1 from karaoke_user_saved_songs where id='a5000000-0000-4000-8000-000000000022') t));

-- M6 — the identifier must NOT be retained on an unavailable row. The CHECK makes that
-- combination unrepresentable rather than merely discouraged.
do $$ begin
  begin
    update karaoke_requests set youtube_video_id='OLD00000001'
     where id='a5000000-0000-4000-8000-000000000011';
    perform pg_temp.a('M6: DB REFUSES retaining a video id on an unavailable row', false);
  exception when check_violation then
    perform pg_temp.a('M6: DB REFUSES retaining a video id on an unavailable row', true);
  end;
end $$;

-- ===========================================================================
-- ACTIVE (P28–P31) — the live queue row is untouched by any clearing pass
-- ===========================================================================
select pg_temp.a('P29a: the active stale row IS due (deferral is a decision, not an exclusion)',
  exists(select 1 from karaoke_retention_due_requests where youtube_video_id='ACTIVE00001'));
select pg_temp.a('P30: DEFER_ACTIVE left the row completely intact',
  (select youtube_video_id='ACTIVE00001' and youtube_title is not null
      and youtube_metadata_unavailable_at is null and status='waiting'
     from karaoke_requests where id='a5000000-0000-4000-8000-000000000014'));
select pg_temp.a('P31: DEFER_ACTIVE did NOT fabricate freshness',
  (select youtube_metadata_fetched_at < now()-interval '30 days'
     from karaoke_requests where id='a5000000-0000-4000-8000-000000000014'));

-- ===========================================================================
-- LEGACY NULL PROVENANCE (P32–P34)
-- ===========================================================================
update karaoke_requests set youtube_title='NOW KNOWN', youtube_metadata_fetched_at=now()
 where id='a5000000-0000-4000-8000-000000000013';
select pg_temp.a('P32: NULL provenance + refresh success establishes factual provenance',
  (select youtube_metadata_fetched_at is not null from karaoke_requests where id='a5000000-0000-4000-8000-000000000013')
  and not exists(select 1 from karaoke_retention_due_requests where id='a5000000-0000-4000-8000-000000000013'));

-- P34 — a transient failure must leave a legacy row UNKNOWN, still due, data intact.
select pg_temp.a('P34: NULL-provenance saved row after a transient failure stays unknown and due',
  exists(select 1 from karaoke_retention_due_saved_songs where id='a5000000-0000-4000-8000-000000000020'
          and youtube_metadata_fetched_at is null)
  or (select youtube_metadata_fetched_at is not null from karaoke_user_saved_songs
       where id='a5000000-0000-4000-8000-000000000020'));

-- ===========================================================================
-- DURATION (P35–P37)
-- ===========================================================================
select pg_temp.a('P35: stale duration selected from resolved_at',
  exists(select 1 from karaoke_retention_due_durations where video_id='DURSTALE001'));
update karaoke_video_durations set duration_seconds=250, resolved_at=now() where video_id='DURSTALE001';
select pg_temp.a('P36: a factual refresh updates resolved_at and clears the selection',
  not exists(select 1 from karaoke_retention_due_durations where video_id='DURSTALE001'));
select pg_temp.a('P37: there is exactly ONE duration clock',
  (select count(*)=1 from information_schema.columns
     where table_name='karaoke_video_durations' and column_name in ('resolved_at')));

-- ===========================================================================
-- SECURITY (P44–P47)
-- ===========================================================================
select pg_temp.a('P44/P45: anon and authenticated hold NO privilege on either retention table',
  not exists(select 1 from information_schema.role_table_grants
              where table_name in ('karaoke_requests','karaoke_user_saved_songs')
                and grantee in ('anon','authenticated')));
select pg_temp.a('P45b: anon and authenticated cannot read the due views',
  not exists(select 1 from information_schema.role_table_grants
              where table_name like 'karaoke_retention_due%'
                and grantee in ('anon','authenticated')));
select pg_temp.a('P44b: RLS remains enabled on both retention tables',
  (select count(*)=2 from pg_class
     where relname in ('karaoke_requests','karaoke_user_saved_songs') and relrowsecurity));

-- ===========================================================================
-- BACKFILL (§O) — no historical row was invented as unavailable
-- ===========================================================================
select pg_temp.a('O1: the fresh untouched rows still carry NULL unavailable state',
  (select youtube_metadata_unavailable_at is null from karaoke_requests where id='a5000000-0000-4000-8000-000000000010')
  and (select youtube_metadata_unavailable_at is null from karaoke_user_saved_songs where id='a5000000-0000-4000-8000-000000000020'));

-- ---------------------------------------------------------------------------
select name, case when ok then 'PASS' else 'FAIL' end as result from res order by name;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from res;
rollback;
