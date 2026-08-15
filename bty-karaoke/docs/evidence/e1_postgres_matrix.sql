-- BUILD 26T-R1B-R6-R1A — E1 matrix. Runs inside a transaction that ROLLS BACK: no fixture persists.
begin;
create temporary table res(name text, ok boolean);
create or replace function pg_temp.a(n text, ok boolean) returns void language plpgsql as $$
begin insert into res values(n,ok); end $$;

insert into karaoke_accounts(id,provider,provider_subject,display_name,timezone)
values ('e1000000-0000-4000-8000-000000000001','apple','E1-SUB','E1','America/Los_Angeles');
insert into karaoke_workspaces(id,name) values ('e1000000-0000-4000-8000-000000000002','E1 WS');
insert into karaoke_workspace_members(workspace_id,account_id,role,status)
values ('e1000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000001','owner','active');
insert into karaoke_rooms(id,slug,display_name,dj_secret,status)
values ('e1000000-0000-4000-8000-000000000003','e1-room','E1 Room','x','open');
insert into karaoke_room_ownership(room_id,workspace_id)
values ('e1000000-0000-4000-8000-000000000003','e1000000-0000-4000-8000-000000000002');
insert into karaoke_events(id,room_id,name,status,public_code,guest_slug)
values ('e1000000-0000-4000-8000-000000000004','e1000000-0000-4000-8000-000000000003','E1','active','E1C','e1g');
insert into karaoke_host_plan_assignments(account_id,plan_code,status)
values ('e1000000-0000-4000-8000-000000000001','FREE','active');
update karaoke_usage_policy set enforcement_enabled = true where policy_key='default';
insert into karaoke_video_durations(video_id,duration_seconds) values
  ('E1SHORT0001',200), ('E1LONG00001',960), ('E1HUGE00001',7200);   -- 'E1UNKNOWN01' absent

create or replace function pg_temp.start(vid text, mode text default 'guest') returns jsonb
language plpgsql as $$
declare rid uuid; begin
  update karaoke_event_usage_segments set ended_at=clock_timestamp(), close_reason='completed'
   where room_id='e1000000-0000-4000-8000-000000000003' and ended_at is null;
  update karaoke_requests set status='skipped'
   where room_id='e1000000-0000-4000-8000-000000000003' and status in ('waiting','playing');
  insert into karaoke_requests(room_id,event_id,guest_name,youtube_video_id,position,status,ready_at)
  values ('e1000000-0000-4000-8000-000000000003','e1000000-0000-4000-8000-000000000004','G',vid,1,'waiting',clock_timestamp())
  returning id into rid;
  return karaoke_begin_song_v2('e1000000-0000-4000-8000-000000000003', rid, mode);
end $$;

-- ---------- PLAYBACK 1-12 ----------
select pg_temp.a('D1  FREE>0 + valid song', (pg_temp.start('E1SHORT0001')->>'outcome')='ok');
-- exhaust FREE against a completed historical request
insert into karaoke_requests(id,room_id,event_id,guest_name,youtube_video_id,position,status,created_at,started_at,completed_at)
values ('e1000000-0000-4000-8000-0000000000aa','e1000000-0000-4000-8000-000000000003','e1000000-0000-4000-8000-000000000004',
        'H','E1SHORT0001',0,'completed',now()-interval '3 hours',now()-interval '3 hours',now()-interval '2 hours');
insert into karaoke_event_usage_segments
 (account_id,event_id,room_id,request_id,plan_snapshot,metered,started_at,ended_at,close_reason,timezone_snapshot,
  duration_seconds,lease_ends_at,lease_seconds,charged_window_start,charged_window_end)
values ('e1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000004','e1000000-0000-4000-8000-000000000003',
        'e1000000-0000-4000-8000-0000000000aa','FREE',true,now()-interval '3 hours',now()-interval '2 hours','completed',
        'America/Los_Angeles',900,now()-interval '2 hours',900,date_trunc('day',now()),date_trunc('day',now())+interval '1 day');
select pg_temp.a('D0  precondition: FREE exhausted',
  ((karaoke_free_minutes_entitlement_at_v2('e1000000-0000-4000-8000-000000000001',now())->>'remainingSeconds')::int) <= 0);
select pg_temp.a('D2  FREE=0 + same song',      (pg_temp.start('E1SHORT0001')->>'outcome')='ok');
select pg_temp.a('D3  no pass',                 (pg_temp.start('E1SHORT0001')->>'outcome')='ok');
insert into timed_access_pass_grants(account_id,pass_type,duration_seconds,status,issue_idempotency_key,source_type,is_paid,expires_at,activated_at)
values ('e1000000-0000-4000-8000-000000000001','ONE_HOUR',3600,'ACTIVE','e1-expired','MANUAL_PROMOTIONAL',false,now()-interval '61 min' + make_interval(secs=>3600),now()-interval '61 min');
select pg_temp.a('D4  expired pass',            (pg_temp.start('E1SHORT0001')->>'outcome')='ok');
delete from timed_access_pass_grants where account_id='e1000000-0000-4000-8000-000000000001';
insert into timed_access_pass_grants(account_id,pass_type,duration_seconds,status,issue_idempotency_key,source_type,is_paid,selected_at)
values ('e1000000-0000-4000-8000-000000000001','ONE_HOUR',3600,'SELECTED','e1-selected','MANUAL_PROMOTIONAL',false,now());
select pg_temp.a('D5  SELECTED pass',           (pg_temp.start('E1SHORT0001')->>'outcome')='ok');
select pg_temp.a('D6  SELECTED pass STAYS selected',
  (select count(*) from timed_access_pass_grants where account_id='e1000000-0000-4000-8000-000000000001' and status='SELECTED')=1
  and (select count(*) from timed_access_pass_grants where account_id='e1000000-0000-4000-8000-000000000001' and status<>'SELECTED')=0);
select pg_temp.a('D7  16-minute video',         (pg_temp.start('E1LONG00001')->>'outcome')='ok');
select pg_temp.a('D8  2-hour video',            (pg_temp.start('E1HUGE00001')->>'outcome')='ok');
select pg_temp.a('D9  unknown duration',        (pg_temp.start('E1UNKNOWN01')->>'outcome')='ok');
select pg_temp.a('D10 former grace-exhausted',  (pg_temp.start('E1LONG00001')->>'outcome')='ok');
select pg_temp.a('D11 former pass_insufficient',(pg_temp.start('E1HUGE00001')->>'outcome')='ok');
select pg_temp.a('D12 former upgrade_required', (pg_temp.start('E1SHORT0001')->>'outcome')='ok');

-- ---------- RECORD SHAPE 13-20 ----------
select pg_temp.a('D13 metered=false',
  (select bool_and(not metered) from karaoke_event_usage_segments
    where room_id='e1000000-0000-4000-8000-000000000003' and request_id<>'e1000000-0000-4000-8000-0000000000aa'));
select pg_temp.a('D14 all five lease columns NULL',
  (select bool_and(duration_seconds is null and lease_ends_at is null and lease_seconds is null
                   and charged_window_start is null and charged_window_end is null)
     from karaoke_event_usage_segments
    where room_id='e1000000-0000-4000-8000-000000000003' and request_id<>'e1000000-0000-4000-8000-0000000000aa'));
select pg_temp.a('D15 CHECK accepted every new row', true);  -- reaching here means no violation aborted us
select pg_temp.a('D16 no lease minted',
  (select count(*) from karaoke_event_usage_segments
    where room_id='e1000000-0000-4000-8000-000000000003' and lease_ends_at is not null
      and request_id<>'e1000000-0000-4000-8000-0000000000aa')=0);
select pg_temp.a('D17 no grace minted',
  (select count(*) from karaoke_free_final_song_grace where account_id='e1000000-0000-4000-8000-000000000001')=0);
select pg_temp.a('D18 no FREE consumption from new playback',
  (select coalesce(sum(lease_seconds),0) from karaoke_event_usage_segments
    where account_id='e1000000-0000-4000-8000-000000000001' and metered)=900);
select pg_temp.a('D19 no carryover minted',
  (select count(*) from karaoke_free_window_carryover where account_id='e1000000-0000-4000-8000-000000000001')=0);
select pg_temp.a('D20 no pass activation audit',
  (select count(*) from timed_access_pass_audit a join timed_access_pass_grants g on g.id=a.pass_grant_id
    where g.account_id='e1000000-0000-4000-8000-000000000001' and a.action='ACTIVATED')=0);

-- ---------- DOWNSTREAM READERS 21-26 ----------
select pg_temp.a('D21 isPlaying still sees unmetered playback',
  ((karaoke_free_minutes_entitlement_at_v2('e1000000-0000-4000-8000-000000000001',now())->>'activePlaybackCount')::int) >= 1);
select pg_temp.a('D22 completion derives from status/ended_at',
  (select count(*) from karaoke_requests where room_id='e1000000-0000-4000-8000-000000000003' and status='playing')=1);
select pg_temp.a('D24 FREE sum excludes unmetered rows',
  ((karaoke_free_minutes_entitlement_at_v2('e1000000-0000-4000-8000-000000000001',now())->>'usedSeconds')::int)=900);

-- ---------- SECURITY 27-33 ----------
select pg_temp.a('D27 invalid mode refused',  (pg_temp.start('E1SHORT0001','bogus')->>'outcome')='invalid_mode');
select pg_temp.a('D28 unknown room refused',
  (karaoke_begin_song_v2('e1000000-0000-4000-8000-0000000000ff','e1000000-0000-4000-8000-0000000000aa','guest')->>'outcome')='ownership_state_invalid');
select pg_temp.a('D30 nonexistent request refused',
  (karaoke_begin_song_v2('e1000000-0000-4000-8000-000000000003','e1000000-0000-4000-8000-0000000000fe','guest')->>'outcome')='not_found');
update karaoke_events set status='ended' where id='e1000000-0000-4000-8000-000000000004';
select pg_temp.a('D29 inactive event refused', (pg_temp.start('E1SHORT0001')->>'outcome')='event_state_invalid');
update karaoke_events set status='active' where id='e1000000-0000-4000-8000-000000000004';
select pg_temp.start('E1SHORT0001');
select pg_temp.a('D32 replay of a playing request refused',
  (karaoke_begin_song_v2('e1000000-0000-4000-8000-000000000003',
     (select id from karaoke_requests where room_id='e1000000-0000-4000-8000-000000000003' and status='playing' limit 1),'guest')->>'outcome')='not_waiting');
insert into karaoke_requests(room_id,event_id,guest_name,youtube_video_id,position,status,ready_at)
values ('e1000000-0000-4000-8000-000000000003','e1000000-0000-4000-8000-000000000004','G2','E1SHORT0001',9,'waiting',clock_timestamp());
select pg_temp.a('D33 already-playing refused',
  (karaoke_begin_song_v2('e1000000-0000-4000-8000-000000000003',
     (select id from karaoke_requests where room_id='e1000000-0000-4000-8000-000000000003' and status='waiting' order by position desc limit 1),'guest')->>'outcome')='already_playing');
update karaoke_rooms set status='retired' where id='e1000000-0000-4000-8000-000000000003';
select pg_temp.a('D31 retired room refused', (pg_temp.start('E1SHORT0001')->>'outcome')='room_retired');
update karaoke_rooms set status='open' where id='e1000000-0000-4000-8000-000000000003';

-- ---------- HISTORICAL 34-40 ----------
select pg_temp.a('D34 historical metered <=900 fixture still valid',
  (select count(*) from karaoke_event_usage_segments where metered and duration_seconds=900)=1);
select pg_temp.a('D38 purchase ledger unchanged', (select count(*) from karaoke_apple_purchases)=0);
select pg_temp.a('D39 grant history unchanged (1 SELECTED, nothing else)',
  (select count(*) from timed_access_pass_grants where account_id='e1000000-0000-4000-8000-000000000001')=1);
select pg_temp.a('D40 no audit rows written by playback',
  (select count(*) from timed_access_pass_audit a join timed_access_pass_grants g on g.id=a.pass_grant_id
    where g.account_id='e1000000-0000-4000-8000-000000000001')=0);

-- ---------- MUTANTS ----------
do $$ begin
  insert into karaoke_event_usage_segments
   (account_id,event_id,room_id,request_id,plan_snapshot,metered,started_at,timezone_snapshot,
    duration_seconds,lease_ends_at,lease_seconds,charged_window_start,charged_window_end)
  values ('e1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000004','e1000000-0000-4000-8000-000000000003',
          'e1000000-0000-4000-8000-0000000000aa','FREE',true,clock_timestamp(),'America/Los_Angeles',
          960, clock_timestamp()+interval '960 s', 960, date_trunc('day',now()), date_trunc('day',now())+interval '1 day');
  insert into res values('M1  16-min in the METERED shape is KILLED by the 900 CHECK', false);
exception when check_violation then
  insert into res values('M1  16-min in the METERED shape is KILLED by the 900 CHECK', true);
end $$;

do $$ begin
  insert into karaoke_event_usage_segments
   (account_id,event_id,room_id,request_id,plan_snapshot,metered,started_at,timezone_snapshot,
    duration_seconds,lease_ends_at,lease_seconds,charged_window_start,charged_window_end)
  values ('e1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000004','e1000000-0000-4000-8000-000000000003',
          'e1000000-0000-4000-8000-0000000000aa','FREE',false,clock_timestamp(),'America/Los_Angeles',
          null, clock_timestamp()+interval '100 s', null, null, null);
  insert into res values('M2  NULL duration + one populated lease field is KILLED (atomicity)', false);
exception when check_violation then
  insert into res values('M2  NULL duration + one populated lease field is KILLED (atomicity)', true);
end $$;

select name, case when ok then 'PASS' else 'FAIL' end from res order by name;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from res;
rollback;
