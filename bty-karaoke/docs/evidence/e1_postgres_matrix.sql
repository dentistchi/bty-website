\timing off
-- BUILD 26T-R1B-R6-R1A — E1 Postgres matrix. All fixtures use the E1 marker prefix so §G
-- cleanup can enumerate and remove exactly this slice's rows.
begin;

create temporary table res(name text, ok boolean, detail text);
create or replace function pg_temp.assert(p_name text, p_ok boolean, p_detail text default '')
returns void language plpgsql as $$ begin insert into res values(p_name,p_ok,p_detail); end $$;

-- ---------- fixtures ----------

insert into karaoke_accounts(id,provider,provider_subject,email,display_name,timezone)
values ('e1000000-0000-4000-8000-000000000001'::uuid,'apple','E1-TEST-SUBJECT',null,'E1 Test','America/Los_Angeles');
insert into karaoke_workspaces(id,name) values ('e1000000-0000-4000-8000-000000000002'::uuid,'E1 Test WS');
insert into karaoke_workspace_members(workspace_id,account_id,role,status)
values ('e1000000-0000-4000-8000-000000000002'::uuid,'e1000000-0000-4000-8000-000000000001'::uuid,'owner','active');
insert into karaoke_rooms(id,slug,display_name,dj_secret,status)
values ('e1000000-0000-4000-8000-000000000003'::uuid,'e1-test-room','E1 Test Room','x','open');
insert into karaoke_room_ownership(room_id,workspace_id) values ('e1000000-0000-4000-8000-000000000003'::uuid,'e1000000-0000-4000-8000-000000000002'::uuid);
insert into karaoke_events(id,room_id,name,status,public_code,guest_slug)
values ('e1000000-0000-4000-8000-000000000004'::uuid,'e1000000-0000-4000-8000-000000000003'::uuid,'E1 Test','active','E1CODE','e1-guest');
insert into karaoke_host_plan_assignments(account_id,plan_code,status) values ('e1000000-0000-4000-8000-000000000001'::uuid,'FREE','active');
-- enforcement ON: the pre-E1 world would have refused on FREE exhaustion.
update karaoke_usage_policy set enforcement_enabled = true where policy_key='default';

insert into karaoke_video_durations(video_id,duration_seconds) values
  ('E1SHORT0001', 200),      -- ordinary
  ('E1LONG00001', 960),      -- 16 minutes: over the retired 900 ceiling
  ('E1HUGE00001', 7200);     -- 2 hours: far over
-- 'E1UNKNOWN01' deliberately absent → unknown duration

create or replace function pg_temp.mk(p_vid text) returns uuid language plpgsql as $$
declare v uuid; begin
  -- close any open usage segment: the schema permits only one open segment per room, and each
  -- begin_song opens one. Closing mirrors what Finish does in production.
  update karaoke_event_usage_segments set ended_at=clock_timestamp(), close_reason='completed'
   where room_id='e1000000-0000-4000-8000-000000000003' and ended_at is null;
  update karaoke_requests set status='skipped' where room_id='e1000000-0000-4000-8000-000000000003' and status in ('waiting','playing');
  insert into karaoke_requests(room_id,event_id,guest_name,youtube_video_id,position,status,ready_at)
  values ('e1000000-0000-4000-8000-000000000003','e1000000-0000-4000-8000-000000000004',
          'E1 Guest',p_vid,1,'waiting',now()) returning id into v;
  return v; end $$;

create or replace function pg_temp.outcome(p_vid text, p_mode text default 'guest')
returns text language plpgsql as $$
declare r jsonb; begin
  r := karaoke_begin_song_v2('e1000000-0000-4000-8000-000000000003', pg_temp.mk(p_vid), p_mode);
  return r->>'outcome'; end $$;

-- ---------- exhaust FREE so every case below runs with 0 seconds remaining ----------
-- a COMPLETED historical request to hang the exhausting segment on (request_id is NOT NULL)
insert into karaoke_requests(id,room_id,event_id,guest_name,youtube_video_id,position,status,created_at,started_at,completed_at)
values ('e1000000-0000-4000-8000-0000000000aa'::uuid,'e1000000-0000-4000-8000-000000000003'::uuid,
        'e1000000-0000-4000-8000-000000000004'::uuid,'E1 History','E1SHORT0001',0,'completed',
        now()-interval '2 hours', now()-interval '2 hours', now()-interval '1 hour');
insert into karaoke_event_usage_segments
  (account_id,event_id,room_id,request_id,plan_snapshot,metered,started_at,ended_at,timezone_snapshot,
   close_reason,duration_seconds,lease_ends_at,lease_seconds,charged_window_start,charged_window_end)
values ('e1000000-0000-4000-8000-000000000001'::uuid,'e1000000-0000-4000-8000-000000000004'::uuid,'e1000000-0000-4000-8000-000000000003'::uuid,
        'e1000000-0000-4000-8000-0000000000aa'::uuid,'FREE',true, now()-interval '2 hours', now()-interval '1 hour',
        'America/Los_Angeles', 'completed', 900, now()-interval '1 hour', 900,
        date_trunc('day', now()), date_trunc('day', now())+interval '1 day');

select pg_temp.assert('C0 free is exhausted (precondition)',
  ((karaoke_free_minutes_entitlement_at_v2('e1000000-0000-4000-8000-000000000001'::uuid, now())->>'remainingSeconds')::int) <= 0,
  (karaoke_free_minutes_entitlement_at_v2('e1000000-0000-4000-8000-000000000001'::uuid, now())->>'remainingSeconds'));

-- ---------- 1,2: FREE=0, no pass ----------
select pg_temp.assert('C1 FREE=0 + valid song starts', pg_temp.outcome('E1SHORT0001')='ok');
select pg_temp.assert('C2 no pass + valid song starts', pg_temp.outcome('E1SHORT0001')='ok');

-- ---------- 5,6: the retired ceiling ----------
select pg_temp.assert('C5 16-minute song starts (900 ceiling retired)', pg_temp.outcome('E1LONG00001')='ok');
select pg_temp.assert('C6 2-hour song starts (no duration ceiling)',    pg_temp.outcome('E1HUGE00001')='ok');

-- ---------- 7: unknown duration ----------
select pg_temp.assert('C7 unknown duration is not refused', pg_temp.outcome('E1UNKNOWN01')='ok');

-- ---------- 3: expired pass ----------
insert into timed_access_pass_grants(account_id,pass_type,duration_seconds,status,source,expires_at,activated_at)
values ('e1000000-0000-4000-8000-000000000001'::uuid,'ONE_HOUR',3600,'ACTIVE','PROMOTIONAL', now()-interval '1 minute', now()-interval '61 minutes');
select pg_temp.assert('C3 expired pass + valid song starts', pg_temp.outcome('E1SHORT0001')='ok');

-- ---------- 4 & 18: SELECTED pass must survive untouched ----------
delete from timed_access_pass_grants where account_id='e1000000-0000-4000-8000-000000000001'::uuid;
insert into timed_access_pass_grants(account_id,pass_type,duration_seconds,status,source)
values ('e1000000-0000-4000-8000-000000000001'::uuid,'ONE_HOUR',3600,'SELECTED','PROMOTIONAL');
select pg_temp.assert('C4 SELECTED pass + valid song starts', pg_temp.outcome('E1SHORT0001')='ok');
select pg_temp.assert('C4b SELECTED pass is NOT activated by playback',
  (select count(*) from timed_access_pass_grants where account_id='e1000000-0000-4000-8000-000000000001'::uuid and status='SELECTED')=1
  and (select count(*) from timed_access_pass_grants where account_id='e1000000-0000-4000-8000-000000000001'::uuid and status='ACTIVE')=0);
select pg_temp.assert('C18 no ACTIVATED audit row written by playback',
  (select count(*) from timed_access_pass_audit a
     join timed_access_pass_grants g on g.id=a.pass_grant_id
    where g.account_id='e1000000-0000-4000-8000-000000000001'::uuid and a.action='ACTIVATED')=0);

-- ---------- 8,9: the former refusal paths are unreachable ----------
select pg_temp.assert('C8 former FREE-grace exhaustion does not refuse', pg_temp.outcome('E1LONG00001')='ok');
select pg_temp.assert('C9 former pass_insufficient case does not refuse', pg_temp.outcome('E1HUGE00001')='ok');

-- ---------- SECURITY / STRUCTURE regressions ----------
select pg_temp.assert('C10 invalid mode still refused', pg_temp.outcome('E1SHORT0001','bogus')='invalid_mode');

select pg_temp.assert('C11 unknown room still refused',
  (karaoke_begin_song_v2('e1000000-0000-4000-8000-0000000000ff', pg_temp.mk('E1SHORT0001'),'guest')
   ->>'outcome') = 'ownership_state_invalid');

select pg_temp.assert('C13 nonexistent request still refused',
  (karaoke_begin_song_v2('e1000000-0000-4000-8000-000000000003'::uuid,'e1000000-0000-4000-8000-0000000000fe','guest')->>'outcome')='not_found');

-- inactive event
update karaoke_events set status='ended' where id='e1000000-0000-4000-8000-000000000004'::uuid;
select pg_temp.assert('C12 inactive event still refused', pg_temp.outcome('E1SHORT0001')='event_state_invalid');
update karaoke_events set status='active' where id='e1000000-0000-4000-8000-000000000004'::uuid;

-- already playing
select pg_temp.outcome('E1SHORT0001');
insert into karaoke_requests(room_id,event_id,guest_name,youtube_video_id,position,status,ready_at)
values ('e1000000-0000-4000-8000-000000000003'::uuid,'e1000000-0000-4000-8000-000000000004'::uuid,'E1 Guest 2','E1SHORT0001',2,'waiting',now());
select pg_temp.assert('C15 already-playing still refused',
  (karaoke_begin_song_v2('e1000000-0000-4000-8000-000000000003'::uuid,(select id from karaoke_requests where room_id='e1000000-0000-4000-8000-000000000003'::uuid and status='waiting' limit 1),'guest')
   ->>'outcome')='already_playing');

-- replay: the same request cannot start twice
select pg_temp.assert('C14 replay of a playing request refused (not_waiting)',
  (karaoke_begin_song_v2('e1000000-0000-4000-8000-000000000003'::uuid,(select id from karaoke_requests where room_id='e1000000-0000-4000-8000-000000000003'::uuid and status='playing' limit 1),'guest')
   ->>'outcome')='not_waiting');

-- retired room
update karaoke_rooms set status='retired' where id='e1000000-0000-4000-8000-000000000003'::uuid;
select pg_temp.assert('C11b retired room still refused', pg_temp.outcome('E1SHORT0001')='room_retired');
update karaoke_rooms set status='open' where id='e1000000-0000-4000-8000-000000000003'::uuid;

-- ---------- 19: ledger untouched ----------
select pg_temp.assert('C19 purchase ledger untouched by playback',
  (select count(*) from karaoke_apple_purchases)=0);

-- ---------- results ----------
select name, case when ok then 'PASS' else 'FAIL' end as result, detail from res order by name;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from res;
rollback;
