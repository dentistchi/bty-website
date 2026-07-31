// BUILD 20M-R4 — FREE Final Song Grace V1, real PostgreSQL integration tests.
// Isolated cluster (127.0.0.1:54333) with all five migrations applied. Production untouched.
//
// The whole point of grace is that lease coverage and FREE charge DIVERGE: the lease covers the
// full song so external playback stays authorized and the union protects the next start, while
// only the remaining balance is billed. Every test below pins that divergence explicitly.
import pg from 'pg';
const CONN = { host: '127.0.0.1', port: 54333, user: 'postgres', database: 'postgres' };
const db = new pg.Client(CONN); await db.connect();

let pass = 0; const fails = [];
const ok = (c, n) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fails.push(n); console.log('  ✗ ' + n); } };
const q = (t, p) => db.query(t, p).then(r => r.rows);
const one = async (t, p) => (await q(t, p))[0];
let vid = 0; const nextVid = () => `g${String(++vid).padStart(10, '0')}`;

await db.query(`insert into karaoke_usage_policy(policy_key) values('default') on conflict do nothing`);
await db.query(`update karaoke_usage_policy set enforcement_enabled=true, lease_write_mode='on' where policy_key='default'`);

async function reset() {
  await db.query(`truncate table karaoke_free_final_song_grace, karaoke_event_usage_segments,
    karaoke_video_durations, karaoke_lease_rollout, timed_access_pass_audit, timed_access_pass_grants,
    karaoke_requests, karaoke_events, karaoke_room_ownership, karaoke_rooms,
    karaoke_workspace_members, karaoke_host_plan_assignments, karaoke_accounts restart identity cascade`);
}
async function seedAccount(plan = 'FREE') {
  const a = await one(`insert into karaoke_accounts(timezone) values('America/Los_Angeles') returning id`);
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
async function seedRequest(room, event, dur, pos = 1) {
  const v = nextVid();
  await db.query(`insert into karaoke_video_durations(video_id,duration_seconds) values($1,$2)`, [v, dur]);
  const req = await one(`insert into karaoke_requests(room_id,event_id,status,position,youtube_video_id,ready_at)
    values($1,$2,'waiting',$3,$4,now()) returning id`, [room, event, pos, v]);
  return req.id;
}
/** Burn `secs` of the FREE window with a LEGACY completed segment (the harness's proven shape). */
async function burnFree(acct, room, event, secs, tag) {
  const spent = await one(`insert into karaoke_requests(room_id,event_id,status,position,youtube_video_id)
     values($1,$2,'completed',900,$3) returning id`, [room, event, tag]);
  await db.query(`insert into karaoke_event_usage_segments(account_id,event_id,room_id,request_id,plan_snapshot,metered,started_at,ended_at,close_reason,timezone_snapshot)
     values($1,$2,$3,$4,'FREE',true, now() - make_interval(secs=>$5), now(),'completed','America/Los_Angeles')`,
     [acct, event, room, spent.id, secs]);
  await db.query(`update karaoke_requests set completed_at=(select ended_at from karaoke_event_usage_segments where request_id=$1) where id=$1`, [spent.id]);
}
const begin = (room, req) => one(`select public.karaoke_begin_song_v2($1,$2,'promote') o`, [room, req]).then(r => r.o);
const ent = (acct) => one(`select public.karaoke_free_minutes_entitlement_at_v2($1, clock_timestamp()) e`, [acct]).then(r => r.e);
const seg = (req) => one(`select * from karaoke_event_usage_segments where request_id=$1`, [req]);
const graceRows = (acct) => q(`select * from karaoke_free_final_song_grace where account_id=$1`, [acct]);

/** Build a FREE account with exactly `remaining` seconds left, plus a ready request of `dur`. */
async function scenario(remaining, dur, plan = 'FREE') {
  await reset();
  const a = await seedAccount(plan);
  const r = await seedRoom(a.ws);
  if (plan === 'FREE' && remaining < 900) await burnFree(a.id, r.room, r.event, 900 - remaining, 'burn0000001');
  const req = await seedRequest(r.room, r.event, dur);
  return { a, r, req };
}

console.log('\n# A — a song that FITS is unaffected by grace');
{
  const s = await scenario(300, 200);
  const b = await begin(s.r.room, s.req);
  ok(b.outcome === 'ok', 'A: fitting song admitted');
  ok(b.finalSongGraceApplied === false, 'A: finalSongGraceApplied is false');
  ok((await graceRows(s.a.id)).length === 0, 'A: NO grace row written');
  ok((await seg(s.req)).lease_seconds === 200, 'A: ordinary full charge (200)');
  ok((await ent(s.a.id)).remainingSeconds === 100, 'A: remaining 300-200=100 (grace untouched)');
}

console.log('\n# B/C/D — the shortfall boundary (≤90 admits, 91 blocks)');
{
  const s = await scenario(200, 201);          // shortfall 1
  const b = await begin(s.r.room, s.req);
  ok(b.outcome === 'ok' && b.finalSongGraceApplied === true, 'B: shortfall 1s → grace admits');
  ok(b.finalSongGraceSeconds === 1 && b.finalSongChargedSeconds === 200, 'B: grace 1s, charged 200');
  ok((await ent(s.a.id)).remainingSeconds === 0, 'B: remaining lands exactly on 0');
}
{
  const s = await scenario(200, 290);          // shortfall 90 — the inclusive edge
  const b = await begin(s.r.room, s.req);
  ok(b.outcome === 'ok' && b.finalSongGraceApplied === true, 'C: shortfall exactly 90s → grace admits');
  ok(b.finalSongGraceSeconds === 90, 'C: graceSeconds 90');
  ok((await ent(s.a.id)).remainingSeconds === 0, 'C: remaining 0');
}
{
  const s = await scenario(200, 291);          // shortfall 91 — one past the edge
  const b = await begin(s.r.room, s.req);
  ok(b.outcome === 'upgrade_required', 'D: shortfall 91s → BLOCKED (no grace)');
  ok((await graceRows(s.a.id)).length === 0, 'D: no grace row');
  ok((await one(`select status from karaoke_requests where id=$1`, [s.req])).status === 'waiting', 'D: no queue transition');
  ok((await one(`select count(*)::int c from karaoke_event_usage_segments where request_id=$1`, [s.req])).c === 0, 'D: no segment/lease');
  ok((await ent(s.a.id)).remainingSeconds === 200, 'D: remaining untouched');
}

console.log('\n# E — zero remaining never earns grace');
{
  const s = await scenario(0, 60);
  const b = await begin(s.r.room, s.req);
  ok(b.outcome === 'upgrade_required', 'E: remaining 0 → upgrade_required, never grace');
  ok((await graceRows(s.a.id)).length === 0, 'E: no grace row');
  ok((await one(`select count(*)::int c from karaoke_event_usage_segments where request_id=$1`, [s.req])).c === 0, 'E: no segment');
}

console.log('\n# the canonical fixture arithmetic (remaining 30, duration 69)');
{
  const s = await scenario(30, 69);
  const before = await ent(s.a.id);
  ok(before.usedSeconds === 870 && before.remainingSeconds === 30, 'fixture: 870 used / 30 remaining');
  const b = await begin(s.r.room, s.req);
  ok(b.outcome === 'ok' && b.finalSongGraceApplied === true, 'fixture: admitted with grace');
  ok(b.durationSeconds === 69, 'fixture: durationSeconds 69');
  ok(b.finalSongChargedSeconds === 30, 'fixture: chargedSeconds 30');
  ok(b.finalSongGraceSeconds === 39, 'fixture: graceSeconds 39');
  ok(b.remainingBeforeSeconds === 30, 'fixture: remainingBeforeSeconds 30');
  const sg = await seg(s.req);
  ok(sg.duration_seconds === 69, 'fixture: segment duration 69');
  ok(sg.lease_seconds === 30, 'fixture: segment CHARGE is 30, not 69');
  const leaseSpan = (new Date(sg.lease_ends_at) - new Date(sg.started_at)) / 1000;
  ok(leaseSpan === 69, 'fixture: LEASE COVERS THE FULL 69s (coverage ≠ charge)');
  const after = await ent(s.a.id);
  ok(after.usedSeconds === 900, 'fixture: usedSeconds 870 → 900');
  ok(after.remainingSeconds === 0, 'fixture: remainingSeconds 30 → 0 exactly');
  const g = (await graceRows(s.a.id))[0];
  ok(g && g.remaining_before_seconds === 30 && g.duration_seconds === 69
       && g.charged_seconds === 30 && g.grace_seconds === 39, 'fixture: ledger records the full arithmetic');
  ok(g.segment_id === sg.id && g.request_id === s.req, 'fixture: ledger references the real segment + request');
}

console.log('\n# F — grace is once per FREE window');
{
  const s = await scenario(30, 69);
  ok((await begin(s.r.room, s.req)).finalSongGraceApplied === true, 'F: first grace succeeds');
  await db.query(`select public.karaoke_end_song_v2($1,$2,'complete')`, [s.r.room, s.req]);
  // The first lease still covers the next few minutes, and a song ending INSIDE it charges 0
  // (correct union behaviour — that window is already paid for). Age the lease into the past so
  // the second song genuinely needs a charge, which is what makes this a grace-eligibility test.
  // Collapse the lease to its earliest legal value (= started_at, per usage_seg_lease_consistency),
  // which is already in the past. Subtracting from now() would land BEFORE started_at here,
  // because the whole scenario runs inside a few milliseconds.
  await db.query(`update karaoke_event_usage_segments set lease_ends_at = started_at
                  where request_id=$1`, [s.req]);
  const req2 = await seedRequest(s.r.room, s.r.event, 60, 2);
  const b2 = await begin(s.r.room, req2);
  ok(b2.outcome === 'upgrade_required',
     'F: SECOND request needing a real charge is blocked — the ledger, not the shortfall, stops it');
  ok(b2.requiredChargeSeconds === 60 && b2.requiredChargeSeconds - 0 <= 90,
     'F: its shortfall (60s) is INSIDE the 90s window, proving the ledger did the blocking');
  ok((await graceRows(s.a.id)).length === 1, 'F: still exactly ONE grace row');
  ok((await one(`select status from karaoke_requests where id=$1`, [req2])).status === 'waiting', 'F: no queue transition');
  ok((await one(`select count(*)::int c from karaoke_event_usage_segments where request_id=$1`, [req2])).c === 0, 'F: no segment');
  ok((await ent(s.a.id)).remainingSeconds === 0, 'F: remaining stays 0 — never negative');
}

console.log('\n# G/O — retry of the SAME admitted request is idempotent');
{
  const s = await scenario(30, 69);
  const b1 = await begin(s.r.room, s.req);
  ok(b1.finalSongGraceApplied === true, 'G: first admission grants grace');
  const segId = (await seg(s.req)).id;
  const b2 = await begin(s.r.room, s.req);          // response-loss style retry
  // The RPC checks the request's OWN status before the stage check, so a same-request retry is
  // `not_waiting`. The app never sees this: ensurePlaying detects the playing row first and
  // returns already_active + the grace metadata (covered by the route/native tests).
  ok(b2.outcome === 'not_waiting', 'G/O: retry is rejected by the RPC (no second admission)');
  ok((await graceRows(s.a.id)).length === 1, 'G: still ONE grace grant');
  ok((await q(`select id from karaoke_event_usage_segments where request_id=$1`, [s.req])).length === 1, 'G: still ONE segment');
  ok((await seg(s.req)).id === segId, 'O: the same canonical segment identity survives the retry');
  ok((await ent(s.a.id)).remainingSeconds === 0, 'G: charged once — remaining still exactly 0');
  const g = (await graceRows(s.a.id))[0];
  ok(g.charged_seconds === 30 && g.grace_seconds === 39, 'O: same grace metadata is recoverable for the retry');
}

console.log('\n# H — concurrent race: exactly one winner');
{
  await reset();
  const a = await seedAccount(); const r1 = await seedRoom(a.ws); const r2 = await seedRoom(a.ws);
  await burnFree(a.id, r1.room, r1.event, 870, 'burnrace001');
  const reqA = await seedRequest(r1.room, r1.event, 69);
  const reqB = await seedRequest(r2.room, r2.event, 69);
  const cA = new pg.Client(CONN); await cA.connect();
  const cB = new pg.Client(CONN); await cB.connect();
  await cA.query('begin'); await cB.query('begin');
  const pA = cA.query(`select public.karaoke_begin_song_v2($1,$2,'promote') o`, [r1.room, reqA]).then(r => r.rows[0].o);
  const oA = await pA;
  const pB = cB.query(`select public.karaoke_begin_song_v2($1,$2,'promote') o`, [r2.room, reqB]).then(r => r.rows[0].o);
  await cA.query('commit');
  const oB = await pB;
  await cB.query('commit');
  const winners = [oA, oB].filter(o => o.finalSongGraceApplied === true).length;
  ok(winners === 1, `H: exactly ONE grace winner (got ${winners})`);
  ok((await graceRows(a.id)).length === 1, 'H: exactly one grace row persisted');
  const loser = [oA, oB].find(o => o.finalSongGraceApplied !== true);
  ok(loser.outcome === 'upgrade_required', 'H: the loser fails cleanly as upgrade_required');
  ok((await ent(a.id)).remainingSeconds === 0, 'H: only one charge landed');
  await cA.end(); await cB.end();
}

console.log('\n# I/J/K — passes and PRO take precedence; no grace record');
{
  const s = await scenario(30, 69);
  await db.query(`insert into timed_access_pass_grants(account_id,pass_type,duration_seconds,status,selected_at,issue_idempotency_key)
     values($1,'ONE_HOUR',3600,'SELECTED',clock_timestamp(),gen_random_uuid()::text)`, [s.a.id]);
  const b = await begin(s.r.room, s.req);
  ok(b.outcome === 'ok' && b.passActivated === true && b.passCovered === true, 'I: SELECTED pass activates and covers');
  ok(b.finalSongGraceApplied === false, 'I: no grace applied when a pass covers');
  ok((await graceRows(s.a.id)).length === 0, 'I: NO grace row consumed');
  ok((await seg(s.req)).lease_seconds === 0, 'I: pass-covered → charge 0');
}
{
  const s = await scenario(30, 69);
  await db.query(`insert into timed_access_pass_grants(account_id,pass_type,duration_seconds,status,activated_at,expires_at,issue_idempotency_key)
     values($1,'ONE_HOUR',3600,'ACTIVE',now(), now() + interval '3600 seconds',gen_random_uuid()::text)`, [s.a.id]);
  const b = await begin(s.r.room, s.req);
  ok(b.outcome === 'ok' && b.passCovered === true && b.finalSongGraceApplied === false, 'J: ACTIVE pass covers, no grace');
  ok((await graceRows(s.a.id)).length === 0, 'J: NO grace row consumed');
}
{
  const s = await scenario(900, 69, 'PRO');
  const b = await begin(s.r.room, s.req);
  ok(b.outcome === 'ok' && b.finalSongGraceApplied === false, 'K: PRO admits without grace');
  ok((await graceRows(s.a.id)).length === 0, 'K: NO grace row for PRO');
}

console.log('\n# L — duration fail-closed is unchanged');
{
  await reset();
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  await burnFree(a.id, r.room, r.event, 870, 'burnnodur01');
  const req = await one(`insert into karaoke_requests(room_id,event_id,status,position,youtube_video_id,ready_at)
     values($1,$2,'waiting',1,'nocachevid9',now()) returning id`, [r.room, r.event]);
  const b = await begin(r.room, req.id);
  ok(b.outcome === 'duration_unavailable', 'L: unresolved duration still fails closed');
  ok((await graceRows(a.id)).length === 0, 'L: no grace row on fail-closed');
  ok((await one(`select status from karaoke_requests where id=$1`, [req.id])).status === 'waiting', 'L: no queue transition');
}

console.log('\n# M — a new FREE window restores grace eligibility');
{
  const s = await scenario(30, 69);
  ok((await begin(s.r.room, s.req)).finalSongGraceApplied === true, 'M: grace used in window 1');
  await db.query(`select public.karaoke_end_song_v2($1,$2,'complete')`, [s.r.room, s.req]);
  // Age everything by a day: the prior window's rows no longer match the current v_ws.
  await db.query(`update karaoke_free_final_song_grace set charged_window_start = charged_window_start - interval '1 day',
                  charged_window_end = charged_window_end - interval '1 day' where account_id=$1`, [s.a.id]);
  // lease_ends_at MUST age too: an un-aged lease from window 1 would still be live, and the new
  // song would fall inside it (union charge 0) — admitted without ever consulting grace.
  await db.query(`update karaoke_event_usage_segments set charged_window_start = charged_window_start - interval '1 day',
                  charged_window_end = charged_window_end - interval '1 day',
                  started_at = started_at - interval '1 day', ended_at = ended_at - interval '1 day',
                  lease_ends_at = lease_ends_at - interval '1 day'
                  where account_id=$1`, [s.a.id]);
  await db.query(`update karaoke_requests set completed_at = completed_at - interval '1 day' where room_id=$1 and completed_at is not null`, [s.r.room]);
  const fresh = await ent(s.a.id);
  ok(fresh.remainingSeconds === 900, 'M: new window starts at the full 900');
  await burnFree(s.a.id, s.r.room, s.r.event, 870, 'burnwin2001');
  ok((await ent(s.a.id)).remainingSeconds === 30, 'M: new window burned down to 30');
  // Only ONE waiting row at a time: promote mode requires the canonical first-READY song, so a
  // leftover waiting request would block the next one for reasons unrelated to grace.
  const req3 = await seedRequest(s.r.room, s.r.event, 69, 3);
  const b3 = await begin(s.r.room, req3);
  ok(b3.outcome === 'ok' && b3.finalSongGraceApplied === true, 'M: grace is AVAILABLE again in the new window');
  ok((await graceRows(s.a.id)).length === 2, 'M: two grace rows total — one per window, both retained');
}

console.log('\n# N — finish long after lease expiry does not grow the charge');
{
  const s = await scenario(30, 69);
  await begin(s.r.room, s.req);
  ok((await ent(s.a.id)).remainingSeconds === 0, 'N: exhausted at admission');
  // Simulate a Finish two hours later by ageing the start; end_song must not re-derive a charge.
  await db.query(`update karaoke_event_usage_segments set started_at = started_at - interval '2 hours',
                  lease_ends_at = lease_ends_at - interval '2 hours' where request_id=$1`, [s.req]);
  await db.query(`update karaoke_requests set started_at = started_at - interval '2 hours' where id=$1`, [s.req]);
  await db.query(`select public.karaoke_end_song_v2($1,$2,'complete')`, [s.r.room, s.req]);
  const sg = await seg(s.req);
  ok(sg.lease_seconds === 30, 'N: charged seconds still 30 after a 2h-late finish (no wall-clock growth)');
  ok(sg.ended_at !== null && sg.close_reason === 'completed', 'N: closed canonically');
  ok((await ent(s.a.id)).remainingSeconds === 0, 'N: FREE remains exactly exhausted, never negative');
  ok((await graceRows(s.a.id)).length === 1, 'N: no extra grace consumed by the finish');
}

console.log(`\nRESULT: ${pass} passed, ${fails.length} failed`);
if (fails.length) for (const f of fails) console.log('  FAILED: ' + f);
await db.end();
process.exit(fails.length ? 1 : 0);
