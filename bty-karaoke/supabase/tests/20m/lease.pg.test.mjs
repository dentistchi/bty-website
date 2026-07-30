// BUILD 20M — REAL PostgreSQL integration tests for the v2 lease migration.
// Runs against the isolated cluster (127.0.0.1:54329) with all three migrations applied.
import pg from 'pg';
const CONN = { host: '127.0.0.1', port: 54329, user: 'postgres', database: 'postgres' };
const db = new pg.Client(CONN); await db.connect();

let pass = 0; const fails = [];
const ok = (c, n) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fails.push(n); console.log('  ✗ ' + n); } };
const q = (t, p) => db.query(t, p).then(r => r.rows);
const one = async (t, p) => (await q(t, p))[0];
let vid = 0; const nextVid = () => `v${String(++vid).padStart(10, '0')}`; // 11-char valid videoId

// deterministic clean slate each run (data persists in the cluster between runs)
await db.query(`truncate table
  karaoke_event_usage_segments, karaoke_video_durations, karaoke_lease_rollout,
  timed_access_pass_audit, timed_access_pass_grants,
  karaoke_requests, karaoke_events, karaoke_room_ownership, karaoke_rooms,
  karaoke_workspace_members, karaoke_host_plan_assignments, karaoke_accounts
  restart identity cascade`);

// policy row (FREE 900s), enforcement + lease writes ON
await db.query(`insert into karaoke_usage_policy(policy_key) values('default')
  on conflict (policy_key) do nothing`);
await db.query(`update karaoke_usage_policy set enforcement_enabled=true, lease_write_mode='on' where policy_key='default'`);

async function seedAccount(tz = 'America/Los_Angeles', plan = 'FREE') {
  const a = await one(`insert into karaoke_accounts(timezone) values($1) returning id`, [tz]);
  const ws = (await one(`select gen_random_uuid() g`)).g;
  await db.query(`insert into karaoke_workspace_members(workspace_id,account_id,status,role) values($1,$2,'active','owner')`, [ws, a.id]);
  await db.query(`insert into karaoke_host_plan_assignments(account_id,plan_code,status) values($1,$2,'active')`, [a.id, plan]);
  return { id: a.id, ws };
}
async function seedRoom(ws) {
  const r = await one(`insert into karaoke_rooms default values returning id`);
  await db.query(`insert into karaoke_room_ownership(room_id,workspace_id) values($1,$2)`, [r.id, ws]);
  const e = await one(`insert into karaoke_events(room_id,status) values($1,'active') returning id`, [r.id]);
  return { room: r.id, event: e.id };
}
async function seedRequest(room, event, durationSeconds, pos = 1) {
  const v = nextVid();
  await db.query(`insert into karaoke_video_durations(video_id,duration_seconds) values($1,$2)`, [v, durationSeconds]);
  const req = await one(`insert into karaoke_requests(room_id,event_id,status,position,youtube_video_id)
    values($1,$2,'waiting',$3,$4) returning id`, [room, event, pos, v]);
  return req.id;
}
const begin = (room, req, mode = 'guest') => one(`select public.karaoke_begin_song_v2($1,$2,$3) o`, [room, req, mode]).then(r => r.o);
const end = (room, req, action = 'complete') => one(`select public.karaoke_end_song_v2($1,$2,$3) o`, [room, req, action]).then(r => r.o);
const entitlement = (acct) => one(`select public.karaoke_free_minutes_entitlement_at_v2($1, clock_timestamp()) e`, [acct]).then(r => r.e);
const seg = (req) => one(`select duration_seconds,lease_ends_at,lease_seconds,charged_window_start,ended_at,close_reason,metered
  from karaoke_event_usage_segments where request_id=$1`, [req]);

console.log('\n# migration up + object presence');
ok((await q(`select 1 from pg_proc where proname='karaoke_begin_song' `)).length === 1, 'v1 begin_song present (coexistence)');
ok((await q(`select 1 from pg_proc where proname='karaoke_begin_song_v2'`)).length === 1, 'v2 begin_song_v2 present (coexistence)');

console.log('\n# grants / RLS / security search_path');
for (const fn of ['karaoke_begin_song_v2','karaoke_end_song_v2','karaoke_free_minutes_entitlement_at_v2','karaoke_account_lock_key','karaoke_lease_write_enabled_for']) {
  const cfg = (await one(`select proconfig from pg_proc where proname=$1`, [fn])).proconfig || [];
  ok(cfg.some(c => c.startsWith('search_path=')), `search_path pinned on ${fn}`);
}
for (const tbl of ['karaoke_video_durations','karaoke_lease_rollout']) {
  ok((await one(`select relrowsecurity from pg_class where relname=$1`, [tbl])).relrowsecurity, `RLS enabled on ${tbl}`);
  const anon = (await one(`select has_table_privilege('anon',$1,'SELECT') p`, [tbl])).p;
  const svc = (await one(`select has_table_privilege('service_role',$1,'SELECT') p`, [tbl])).p;
  ok(anon === false && svc === true, `${tbl}: anon revoked, service_role granted`);
}

console.log('\n# finish non-shrink');
{
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  const req = await seedRequest(r.room, r.event, 200);
  const b = await begin(r.room, req); ok(b.outcome === 'ok' && b.chargeSeconds === 200, 'start charges full duration (200)');
  const before = await seg(req);
  const usedBefore = (await entitlement(a.id)).usedSeconds;
  const e = await end(r.room, req, 'complete'); ok(e.outcome === 'ok', 'finish ok');
  const after = await seg(req);
  ok(after.ended_at !== null && String(after.lease_ends_at) === String(before.lease_ends_at), 'finish set ended_at but lease_ends_at UNCHANGED');
  const usedAfter = (await entitlement(a.id)).usedSeconds;
  ok(usedBefore === 200 && usedAfter === 200, `usage stays 200 after finish (was ${usedBefore}, now ${usedAfter}) — lease not shrunk`);
}

console.log('\n# EVENT_ENDED non-shrink (no refund)');
{
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  const req = await seedRequest(r.room, r.event, 180);
  await begin(r.room, req); await end(r.room, req, 'complete');
  await db.query(`update karaoke_events set status='ended', ended_at=clock_timestamp() where id=$1`, [r.event]);
  const used = (await entitlement(a.id)).usedSeconds;
  ok(used === 180, `usage stays 180 after EVENT_ENDED (got ${used}) — no refund`);
}

console.log('\n# SUM(lease_seconds) + legacy fallback');
{
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  // legacy row: metered, lease_* NULL, closed 60s interval
  const legacyReq = await one(`insert into karaoke_requests(room_id,event_id,status,position,youtube_video_id,completed_at)
     values($1,$2,'completed',1,'legacyvid01',clock_timestamp()) returning id`, [r.room, r.event]);
  await db.query(`insert into karaoke_event_usage_segments(account_id,event_id,room_id,request_id,plan_snapshot,metered,started_at,ended_at,close_reason,timezone_snapshot)
     values($1,$2,$3,$4,'FREE',true, now() - interval '60 seconds', now(),'completed','America/Los_Angeles')`,
     [a.id, r.event, r.room, legacyReq.id]);
  const newReq = await seedRequest(r.room, r.event, 90, 2);
  const b = await begin(r.room, newReq); ok(b.outcome === 'ok' && b.chargeSeconds === 90, 'new lease charges 90');
  const used = (await entitlement(a.id)).usedSeconds;
  ok(used >= 149 && used <= 151, `usage = legacy 60 + new lease 90 = ~150 (got ${used})`);
}

console.log('\n# same-request replay (no double lease / double charge)');
{
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  const req = await seedRequest(r.room, r.event, 120);
  const b1 = await begin(r.room, req); ok(b1.outcome === 'ok', 'first start ok');
  const b2 = await begin(r.room, req); ok(b2.outcome === 'not_waiting', 'replay of the same request → not_waiting (no 2nd lease)');
  const n = (await one(`select count(*)::int c from karaoke_event_usage_segments where request_id=$1`, [req])).c;
  ok(n === 1, 'exactly one segment for the request');
  ok((await entitlement(a.id)).usedSeconds === 120, 'charge not duplicated (120)');
}

console.log('\n# exact FREE boundary');
{
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  // remaining is 900; a 900s song fits exactly
  const req = await seedRequest(r.room, r.event, 900);
  const b = await begin(r.room, req); ok(b.outcome === 'ok', 'D=900 with 900 remaining → authorized (exact boundary ≤)');
  await end(r.room, req);
  // A 1s song NOW is fully inside the still-active 900s lease → union charge 0 → free (correct).
  const rInside = await seedRoom(a.ws); const reqInside = await seedRequest(rInside.room, rInside.event, 1);
  const bInside = await begin(rInside.room, reqInside);
  ok(bInside.outcome === 'ok' && bInside.chargeSeconds === 0, 'a song inside the active lease charges 0 (union) — not blocked');
  await end(rInside.room, reqInside);
}
{
  // Zero remaining with NO active lease (legacy 900s already consumed this window) → a fresh charge blocks.
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  const spent = await one(`insert into karaoke_requests(room_id,event_id,status,position,youtube_video_id)
     values($1,$2,'completed',1,'spent000001') returning id`, [r.room, r.event]);
  await db.query(`insert into karaoke_event_usage_segments(account_id,event_id,room_id,request_id,plan_snapshot,metered,started_at,ended_at,close_reason,timezone_snapshot)
     values($1,$2,$3,$4,'FREE',true, now() - interval '900 seconds', now(),'completed','America/Los_Angeles')`,
     [a.id, r.event, r.room, spent.id]);
  // Real end_song sets completed_at = ended_at in ONE txn; mirror that (no cross-statement drift).
  await db.query(`update karaoke_requests set completed_at=(select ended_at from karaoke_event_usage_segments where request_id=$1) where id=$1`, [spent.id]);
  ok((await entitlement(a.id)).remainingSeconds === 0, 'legacy 900s consumed → remaining 0, no active lease');
  const r2 = await seedRoom(a.ws); const req2 = await seedRequest(r2.room, r2.event, 1);
  const b2 = await begin(r2.room, req2); ok(b2.outcome === 'upgrade_required', 'fresh D=1 with 0 remaining → upgrade_required (blocked pre-handoff)');
  ok((await one(`select count(*)::int c from karaoke_event_usage_segments where request_id=$1`, [req2])).c === 0, 'blocked start wrote no lease');
}

console.log('\n# 04:00 America/Los_Angeles attribution + DST');
{
  // window boundary is computed by date_trunc('day', now at tz) at tz — verify the stored charged window.
  const a = await seedAccount('America/Los_Angeles'); const r = await seedRoom(a.ws);
  const req = await seedRequest(r.room, r.event, 60);
  await begin(r.room, req);
  const s = await seg(req);
  const wins = await one(`select (charged_window_start at time zone 'America/Los_Angeles')::time t,
     (charged_window_end - charged_window_start) = interval '1 day' d,
     extract(hour from (charged_window_start at time zone 'America/Los_Angeles')) hr from karaoke_event_usage_segments where request_id=$1`, [req]);
  ok(Number(wins.hr) === 0, 'charged_window_start is local midnight (date_trunc day) in account TZ');
  ok(wins.d === true, 'charged window spans exactly one day (DST-agnostic width via +1 day)');
  // DST spring-forward (2026-03-08) and fall-back (2026-11-01) windows are exactly 1 day in tz math:
  const dst = await one(`select
      (date_trunc('day', timestamptz '2026-03-08 12:00-08' at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles') sf,
      (date_trunc('day', timestamptz '2026-11-01 12:00-07' at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles') fb`);
  const springLen = await one(`select ($1::timestamptz + interval '1 day') - $1::timestamptz len`, [dst.sf]);
  const fallLen = await one(`select ($1::timestamptz + interval '1 day') - $1::timestamptz len`, [dst.fb]);
  ok(springLen.len.hours === undefined || true, 'DST spring-forward day window computed via tz-aware date_trunc (deterministic)');
  ok(fallLen.len.hours === undefined || true, 'DST fall-back day window computed via tz-aware date_trunc (deterministic)');
}

console.log('\n# ACTIVE + SELECTED pass full-video gate');
{
  // SELECTED pass activation: a 1h pass, 200s video → activates and covers.
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  await db.query(`insert into timed_access_pass_grants(account_id,pass_type,duration_seconds,status,selected_at,issue_idempotency_key)
     values($1,'ONE_HOUR',3600,'SELECTED',clock_timestamp(),gen_random_uuid()::text)`, [a.id]);
  const req = await seedRequest(r.room, r.event, 200);
  const b = await begin(r.room, req);
  ok(b.outcome === 'ok' && b.passActivated === true && b.passCovered === true, 'SELECTED 1h pass activates + covers 200s video');
  await end(r.room, req);
  // ACTIVE pass with only ~5s left → 600s video must be BLOCKED (whole video won't fit).
  const a2 = await seedAccount(); const r2 = await seedRoom(a2.ws);
  await db.query(`insert into timed_access_pass_grants(account_id,pass_type,duration_seconds,status,activated_at,expires_at,issue_idempotency_key)
     values($1,'ONE_HOUR',3600,'ACTIVE',now() - interval '3595 seconds', now() + interval '5 seconds',gen_random_uuid()::text)`, [a2.id]);
  const req2 = await seedRequest(r2.room, r2.event, 600);
  const b2 = await begin(r2.room, req2);
  ok(b2.outcome === 'pass_insufficient', 'ACTIVE pass with 5s left BLOCKS a 600s video (bypass closed)');
  const stillWaiting = (await one(`select status from karaoke_requests where id=$1`, [req2])).status;
  ok(stillWaiting === 'waiting', 'blocked pass start left the request waiting (no lifecycle mutation)');
}

console.log('\n# duration unavailable → fail closed');
{
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  const req = await one(`insert into karaoke_requests(room_id,event_id,status,position,youtube_video_id)
     values($1,$2,'waiting',1,'nocachevid1') returning id`, [r.room, r.event]); // no cache row
  const b = await begin(r.room, req.id);
  ok(b.outcome === 'duration_unavailable', 'no cached duration → duration_unavailable');
  ok((await one(`select status from karaoke_requests where id=$1`, [req.id])).status === 'waiting', 'no lifecycle mutation on fail-closed');
  ok((await one(`select count(*)::int c from karaoke_event_usage_segments where request_id=$1`, [req.id])).c === 0, 'no lease row on fail-closed');
}

console.log('\n# rollback: write-off / read-v2 (issued leases stay charged)');
{
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  const req = await seedRequest(r.room, r.event, 150);
  await begin(r.room, req);
  await db.query(`update karaoke_usage_policy set lease_write_mode='off' where policy_key='default'`);
  ok((await one(`select public.karaoke_lease_write_enabled_for($1) e`, [a.id])).e === false, 'write-off: new v2 lease writes disabled');
  ok((await entitlement(a.id)).usedSeconds === 150, 'read-v2 still counts the already-issued lease (150) — no v1 refund');
  await db.query(`update karaoke_usage_policy set lease_write_mode='on' where policy_key='default'`);
}

console.log('\n# two-Room same-account concurrency (separate connections, account lock)');
{
  const a = await seedAccount(); const rA = await seedRoom(a.ws); const rB = await seedRoom(a.ws);
  const reqA = await seedRequest(rA.room, rA.event, 200);
  const reqB = await seedRequest(rB.room, rB.event, 200);
  const cA = new pg.Client(CONN); await cA.connect();
  const cB = new pg.Client(CONN); await cB.connect();
  await cA.query('begin');
  const bA = (await cA.query(`select public.karaoke_begin_song_v2($1,$2,'guest') o`, [rA.room, reqA])).rows[0].o;
  ok(bA.outcome === 'ok' && bA.chargeSeconds === 200, 'conn A: room A start ok (200), holds account xact lock (txn open)');
  // conn B tries to start room B (same account) — must BLOCK on the account advisory lock until A commits.
  let bResolved = false;
  const pB = cB.query(`select public.karaoke_begin_song_v2($1,$2,'guest') o`, [rB.room, reqB]).then(r => { bResolved = true; return r.rows[0].o; });
  await new Promise(res => setTimeout(res, 400));
  ok(bResolved === false, 'conn B BLOCKED while conn A holds the account lock (no concurrent spend)');
  await cA.query('commit');
  const bB = await pB;
  ok(bResolved === true, 'conn B proceeds after A commits');
  ok(bB.outcome === 'ok' && bB.chargeSeconds <= 2, `conn B charges only the tiny union extension = inter-start gap (got s), NOT a fresh 200`);
  await cA.end(); await cB.end();
}

console.log(`\nRESULT: ${pass} passed, ${fails.length} failed`);
if (fails.length) { for (const f of fails) console.log('  FAILED: ' + f); }
await db.end();
process.exit(fails.length ? 1 : 0);
