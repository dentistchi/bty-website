// BUILD 20M — REAL PostgreSQL integration tests for the v2 lease migration.
// Runs against the isolated cluster (127.0.0.1:54329) with all three migrations applied.
import pg from 'pg';
// BUILD 24 — the port is overridable so `supabase/tests/b24/run.sh` can replay this suite
// against the SAME throwaway cluster it builds. The default keeps the README flow working.
const CONN = { host: '127.0.0.1', port: Number(process.env.PGPORT || 54329), user: 'postgres', database: 'postgres' };
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
  // BUILD 24 CORRECTION. This section was TITLED "04:00 attribution" while asserting that the
  // charged window started at local MIDNIGHT — the exact regression BUILD 20M introduced when it
  // replaced the v1 `reset_hour_local` anchor with `date_trunc('day', ...)`. A green test with a
  // title that contradicted its own assertion is why a Host silently got a fresh 15 minutes at
  // 00:00 for a whole build cycle. The assertion now matches the title AND the policy.
  const a = await seedAccount('America/Los_Angeles'); const r = await seedRoom(a.ws);
  const req = await seedRequest(r.room, r.event, 60);
  await begin(r.room, req);
  const resetHour = Number((await one(
    `select reset_hour_local h from karaoke_usage_policy where policy_key='default'`)).h);
  const wins = await one(`select charged_window_start ws,
     (charged_window_end - charged_window_start) = interval '1 day' d,
     extract(hour from (charged_window_start at time zone 'America/Los_Angeles')) hr
     from karaoke_event_usage_segments where request_id=$1`, [req]);
  ok(resetHour === 4, 'the policy reset hour is 04:00 local');
  ok(Number(wins.hr) === resetHour,
     'charged_window_start is the POLICY reset hour (04:00) in account TZ, not local midnight');
  ok(wins.d === true, 'charged window spans exactly one day (DST-agnostic width via +1 day)');
  // The window the SEGMENT stores must equal the window the ENTITLEMENT bills against, or the
  // Final Song Grace once-per-window key drifts from the balance it guards.
  const ent = await entitlement(a.id);
  const same = await one(`select $1::timestamptz = $2::timestamptz eq`, [ent.windowStart, wins.ws]);
  ok(same.eq === true, 'the segment window and the entitlement window are the SAME instant');
  // DST spring-forward (2026-03-08) and fall-back (2026-11-01): both windows are exactly one
  // calendar day, and both still start at 04:00 local.
  for (const [label, asOf] of [['spring-forward', '2026-03-08T12:00:00-08:00'], ['fall-back', '2026-11-01T12:00:00-07:00']]) {
    const e = await one(`select public.karaoke_free_minutes_entitlement_at_v2($1,$2::timestamptz) e`, [a.id, asOf]);
    const w = await one(`select ($1::timestamptz - $2::timestamptz) = interval '1 day' x,
       extract(hour from ($2::timestamptz at time zone 'America/Los_Angeles'))::int h`, [e.e.windowEnd, e.e.windowStart]);
    ok(w.x === true, `DST ${label}: the window spans exactly one calendar day`);
    ok(w.h === 4, `DST ${label}: the window still starts at 04:00 local`);
  }
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

// ─────────────────────────────────────────────────────────────────────────────
// BUILD 20M-GLOBAL-CUTOVER-R1 — admission RESPONSE completeness.
// The gate values themselves are already covered above; these pin that the function
// REPORTS them, that the reported values equal what was persisted, and that a blocked
// admission still writes nothing.
console.log('\n# R1 admission response completeness');
{
  // A/B/C — started reports the authoritative lease end + trusted duration, and both
  // equal the row the SAME transaction wrote (they cannot drift by construction).
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  const req = await seedRequest(r.room, r.event, 230);
  const b = await begin(r.room, req);
  ok(b.outcome === 'ok', 'R1: sufficient FREE time → ok');
  ok(typeof b.leaseEndsAt === 'string' && b.leaseEndsAt.length > 0, 'R1-A: started returns leaseEndsAt');
  ok(b.durationSeconds === 230, 'R1-C: started returns the trusted durationSeconds');
  const s = await seg(req);
  ok(new Date(b.leaseEndsAt).getTime() === new Date(s.lease_ends_at).getTime(),
     'R1-B: returned leaseEndsAt EQUALS the persisted usage segment lease_ends_at');
  ok(s.duration_seconds === 230, 'R1-B: persisted duration matches the reported duration');
}
{
  // F/G/H/I — pass_insufficient reports the boundary, and the boundary itself is unchanged.
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  await db.query(`insert into timed_access_pass_grants(account_id,pass_type,duration_seconds,status,activated_at,expires_at,issue_idempotency_key)
     values($1,'ONE_HOUR',3600,'ACTIVE',now() - interval '3400 seconds', now() + interval '200 seconds',gen_random_uuid()::text)`, [a.id]);
  const req = await seedRequest(r.room, r.event, 600);          // 600s cannot fit in ~200s
  const b = await begin(r.room, req);
  ok(b.outcome === 'pass_insufficient', 'R1: 600s video vs ~200s pass → pass_insufficient');
  ok(b.durationSeconds === 600, 'R1-F: pass_insufficient returns durationSeconds');
  ok(typeof b.passExpiresAt === 'string' && b.passExpiresAt.length > 0, 'R1-F: returns passExpiresAt');
  ok(Number.isInteger(b.remainingSeconds) && b.remainingSeconds >= 0 && b.remainingSeconds <= 200,
     'R1-F: returns clamped integer remainingSeconds matching canonical pass semantics');
  ok(b.remainingSeconds < b.durationSeconds, 'R1: the reported remaining is genuinely shorter than the song');
  // I — a blocked admission mutates NOTHING.
  ok((await one(`select status from karaoke_requests where id=$1`, [req])).status === 'waiting', 'R1-I: no queue transition');
  ok((await one(`select count(*)::int c from karaoke_event_usage_segments where request_id=$1`, [req])).c === 0, 'R1-I: no usage segment / lease');
  ok((await one(`select count(*)::int c from timed_access_pass_audit where account_id=$1 and action='ACTIVATED'`, [a.id])).c === 0,
     'R1-I: no pass activation audit from the rejected attempt');
}
{
  // G/H — the boundary is still exact after the response change: equality admitted,
  // one second short blocked. Pass expiry is set relative to the video length.
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  await db.query(`insert into timed_access_pass_grants(account_id,pass_type,duration_seconds,status,activated_at,expires_at,issue_idempotency_key)
     values($1,'ONE_HOUR',3600,'ACTIVE',now() - interval '3300 seconds', now() + interval '300 seconds',gen_random_uuid()::text)`, [a.id]);
  const eq = await seedRequest(r.room, r.event, 299);   // finishes just inside the window
  const bEq = await begin(r.room, eq);
  ok(bEq.outcome === 'ok', 'R1-G: a video that finishes inside the pass window is still ADMITTED');
  await end(r.room, eq);
  const a2 = await seedAccount(); const r2 = await seedRoom(a2.ws);
  await db.query(`insert into timed_access_pass_grants(account_id,pass_type,duration_seconds,status,activated_at,expires_at,issue_idempotency_key)
     values($1,'ONE_HOUR',3600,'ACTIVE',now() - interval '3300 seconds', now() + interval '300 seconds',gen_random_uuid()::text)`, [a2.id]);
  const over = await seedRequest(r2.room, r2.event, 302);   // ends past expiry
  const bOver = await begin(r2.room, over);
  ok(bOver.outcome === 'pass_insufficient', 'R1-H: a video ending past pass expiry is still BLOCKED');
}
{
  // J/K — upgrade_required reports duration AND the union charge actually compared.
  // A first song opens a lease; a second overlapping song charges only the extension,
  // so requiredChargeSeconds < durationSeconds — the exact case the client must not misreport.
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  // Pre-consume 500s of the 900s FREE window with a LEGACY (v1) completed segment — the same
  // fixture shape the FREE-boundary test above uses, so the CHECK constraints all still hold.
  const spent = await one(`insert into karaoke_requests(room_id,event_id,status,position,youtube_video_id)
     values($1,$2,'completed',9,'r1spent0001') returning id`, [r.room, r.event]);
  await db.query(`insert into karaoke_event_usage_segments(account_id,event_id,room_id,request_id,plan_snapshot,metered,started_at,ended_at,close_reason,timezone_snapshot)
     values($1,$2,$3,$4,'FREE',true, now() - interval '500 seconds', now(),'completed','America/Los_Angeles')`,
     [a.id, r.event, r.room, spent.id]);
  await db.query(`update karaoke_requests set completed_at=(select ended_at from karaoke_event_usage_segments where request_id=$1) where id=$1`, [spent.id]);
  // A 300s song fits in the remaining ~400s and opens a lease to now+300.
  const first = await seedRequest(r.room, r.event, 300, 1);
  const b1 = await begin(r.room, first);
  ok(b1.outcome === 'ok' && b1.chargeSeconds === 300, 'R1-K: first start charges the full 300s');
  await end(r.room, first);   // Finish never shrinks the lease — it still runs to now+300.
  // A 600s song now overlaps that live lease, so the UNION charge is only ~300s — while the
  // remaining allowance is ~100s. Blocked, and charge (300) is provably < duration (600).
  const second = await seedRequest(r.room, r.event, 600, 2);
  const b2 = await begin(r.room, second);
  if (b2.outcome === 'upgrade_required') {
    ok(b2.durationSeconds === 600, 'R1-J: upgrade_required returns durationSeconds (the full 600s song)');
    ok(Number.isInteger(b2.requiredChargeSeconds), 'R1-J: upgrade_required returns requiredChargeSeconds');
    ok(Number.isInteger(b2.remainingSeconds), 'R1-J: upgrade_required returns remainingSeconds');
    ok(b2.requiredChargeSeconds < b2.durationSeconds,
       'R1-K: requiredChargeSeconds is the UNION extension, STRICTLY less than the raw song length');
    ok(b2.requiredChargeSeconds > b2.remainingSeconds, 'R1-J: the block is exactly charge > remaining');
    ok((await one(`select count(*)::int c from karaoke_event_usage_segments where request_id=$1`, [second])).c === 0,
       'R1-I: blocked FREE start wrote no lease');
  } else {
    ok(false, `R1-J: expected upgrade_required for the exhausted FREE account (got ${b2.outcome})`);
  }
}
{
  // L — duration_unavailable must carry NO duration field at all (no fabricated zero).
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  const req = await one(`insert into karaoke_requests(room_id,event_id,status,position,youtube_video_id)
     values($1,$2,'waiting',1,'r1nocache01') returning id`, [r.room, r.event]);
  const b = await begin(r.room, req.id);
  ok(b.outcome === 'duration_unavailable', 'R1-L: unresolved duration → duration_unavailable');
  ok(b.durationSeconds === undefined, 'R1-L: no durationSeconds key (never a fabricated 0)');
  ok(b.remainingSeconds === undefined, 'R1-L: no remainingSeconds key');
}

console.log(`\nRESULT: ${pass} passed, ${fails.length} failed`);
if (fails.length) { for (const f of fails) console.log('  FAILED: ' + f); }
await db.end();
process.exit(fails.length ? 1 : 0);
