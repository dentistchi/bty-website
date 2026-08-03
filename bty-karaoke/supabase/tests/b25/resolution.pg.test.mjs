// BUILD 25 — REAL PostgreSQL authority tests for
// 20260808120000_karaoke_request_resolution_v1.
//
// Proves the four constraint invariants, the measured writer mappings, the no-overwrite
// precedence, and — the part that protects the rest of the product — that recording a reason
// changed NOTHING about metering, leases, entitlement, or Final Song Grace.
//
// Run via `bash supabase/tests/b25/run.sh` (isolated throwaway cluster).
import pg from 'pg';

const CONN = { host: '127.0.0.1', port: Number(process.env.PGPORT || 54341), user: 'postgres', database: 'postgres' };
const db = new pg.Client(CONN); await db.connect();

let pass = 0; const fails = [];
const ok = (c, n) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fails.push(n); console.log('  ✗ ' + n); } };
const q = (t, p) => db.query(t, p).then(r => r.rows);
const one = async (t, p) => (await q(t, p))[0];
let vid = 0; const nextVid = () => `v${String(++vid).padStart(10, '0')}`;

/** Run a statement expected to FAIL, and return the error (or null if it wrongly succeeded). */
async function expectFail(text, params) {
  try { await db.query(text, params); return null; } catch (e) { return e; }
}

async function reset() {
  await db.query(`truncate table
    karaoke_free_final_song_grace, karaoke_event_usage_segments, karaoke_video_durations,
    karaoke_lease_rollout, timed_access_pass_audit, timed_access_pass_grants,
    karaoke_requests, karaoke_events, karaoke_room_ownership, karaoke_rooms,
    karaoke_workspace_members, karaoke_host_plan_assignments, karaoke_accounts
    restart identity cascade`);
}
await db.query(`insert into karaoke_usage_policy(policy_key) values('default') on conflict do nothing`);
await db.query(`update karaoke_usage_policy set enforcement_enabled=true, lease_write_mode='on' where policy_key='default'`);
await reset();

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
async function seedRequest(room, event, durationSeconds = 60, pos = 1) {
  const v = nextVid();
  await db.query(`insert into karaoke_video_durations(video_id,duration_seconds) values($1,$2) on conflict do nothing`, [v, durationSeconds]);
  const req = await one(`insert into karaoke_requests(room_id,event_id,status,position,youtube_video_id)
    values($1,$2,'waiting',$3,$4) returning id`, [room, event, pos, v]);
  return req.id;
}
const row = (id) => one(`select status, resolution_code, resolved_at, completed_at from karaoke_requests where id=$1`, [id]);

// ═══════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n# A — migration objects and column defaults');
// ═══════════════════════════════════════════════════════════════════════════════════════════════
{
  const cols = await q(`select column_name, is_nullable, data_type from information_schema.columns
    where table_name='karaoke_requests' and column_name in ('resolution_code','resolved_at') order by column_name`);
  ok(cols.length === 2, 'A: both columns exist');
  ok(cols.every(c => c.is_nullable === 'YES'), 'A: both are NULLABLE (no backfill possible)');
  ok(cols.find(c => c.column_name === 'resolved_at')?.data_type === 'timestamp with time zone',
     'A: resolved_at is timestamptz');

  const con = await one(`select pg_get_constraintdef(oid) d from pg_constraint where conname='karaoke_requests_resolution_valid'`);
  ok(!!con, 'A: the resolution CHECK constraint exists');
  ok(/unknown_resolution/.test(con?.d ?? '') === false,
     'A: unknown_resolution is NOT an accepted stored value (it is a projection fallback only)');

  const idx = await one(`select indexdef d from pg_indexes where indexname='karaoke_requests_resolved_idx'`);
  ok(!!idx && /WHERE \(resolution_code IS NOT NULL\)/i.test(idx.d), 'A: the resolved index is PARTIAL');

  // A fresh request is active and carries no resolution.
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  const req = await seedRequest(r.room, r.event);
  const x = await row(req);
  ok(x.resolution_code === null && x.resolved_at === null, 'A: a new request has NO resolution');
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n# B — CHECK constraint: the five required invariants');
// ═══════════════════════════════════════════════════════════════════════════════════════════════
{
  const a = await seedAccount(); const r = await seedRoom(a.ws);

  // (1) unknown codes rejected
  const req1 = await seedRequest(r.room, r.event);
  await db.query(`update karaoke_requests set status='removed' where id=$1`, [req1]);
  let e = await expectFail(`update karaoke_requests set resolution_code='banana', resolved_at=now() where id=$1`, [req1]);
  ok(e !== null, 'B1: an unknown reason code is REJECTED');
  e = await expectFail(`update karaoke_requests set resolution_code='unknown_resolution', resolved_at=now() where id=$1`, [req1]);
  ok(e !== null, 'B1: unknown_resolution is REJECTED as a stored value');

  for (const code of ['guest_cancelled', 'host_removed', 'host_skipped', 'event_ended']) {
    const rq = await seedRequest(r.room, r.event);
    await db.query(`update karaoke_requests set status='removed' where id=$1`, [rq]);
    e = await expectFail(`update karaoke_requests set resolution_code=$2, resolved_at=now() where id=$1`, [rq, code]);
    ok(e === null, `B1: ${code} is ACCEPTED`);
  }

  // (2) pair nullability
  const req2 = await seedRequest(r.room, r.event);
  await db.query(`update karaoke_requests set status='removed' where id=$1`, [req2]);
  e = await expectFail(`update karaoke_requests set resolution_code='host_removed' where id=$1`, [req2]);
  ok(e !== null, 'B2: a code WITHOUT resolved_at is rejected');
  e = await expectFail(`update karaoke_requests set resolved_at=now() where id=$1`, [req2]);
  ok(e !== null, 'B2: resolved_at WITHOUT a code is rejected');

  // (3)/(5) only non-normal TERMINAL statuses may carry a resolution
  for (const st of ['waiting', 'playing']) {
    const rq = await seedRequest(r.room, r.event);
    await db.query(`update karaoke_requests set status=$2 where id=$1`, [rq, st]);
    e = await expectFail(`update karaoke_requests set resolution_code='host_removed', resolved_at=now() where id=$1`, [rq]);
    ok(e !== null, `B5: an ACTIVE (${st}) request cannot hold a resolution`);
  }

  // (4) normal completion never carries an abnormal reason
  const req4 = await seedRequest(r.room, r.event);
  await db.query(`update karaoke_requests set status='completed', completed_at=now() where id=$1`, [req4]);
  e = await expectFail(`update karaoke_requests set resolution_code='host_skipped', resolved_at=now() where id=$1`, [req4]);
  ok(e !== null, 'B4: a COMPLETED request cannot be given an abnormal resolution');

  // ...and a terminal row may always stay (null, null) — the legacy state.
  const req6 = await seedRequest(r.room, r.event);
  await db.query(`update karaoke_requests set status='skipped' where id=$1`, [req6]);
  const legacy = await row(req6);
  ok(legacy.resolution_code === null, 'B6: a terminal row may legitimately carry NO reason (legacy rows stay valid)');
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n# C — measured writers: end_song_v2');
// ═══════════════════════════════════════════════════════════════════════════════════════════════
{
  const a = await seedAccount(); const r = await seedRoom(a.ws);

  // Host SKIP of a playing song → host_skipped
  const skip = await seedRequest(r.room, r.event);
  await db.query(`update karaoke_requests set status='playing', started_at=now() where id=$1`, [skip]);
  const rs = await one(`select public.karaoke_end_song_v2($1,$2,'skip') o`, [r.room, skip]);
  ok(rs.o.outcome === 'ok', 'C: end_song_v2 skip succeeds');
  const xs = await row(skip);
  ok(xs.status === 'skipped', 'C: skip → status skipped');
  ok(xs.resolution_code === 'host_skipped', 'C: skip → resolution host_skipped');
  ok(xs.resolved_at !== null, 'C: skip → resolved_at written in the SAME statement');
  ok(xs.completed_at === null, 'C: skip does NOT set completed_at (it did not complete)');

  // NATURAL COMPLETION → no abnormal resolution
  const done = await seedRequest(r.room, r.event);
  await db.query(`update karaoke_requests set status='playing', started_at=now() where id=$1`, [done]);
  const rc = await one(`select public.karaoke_end_song_v2($1,$2,'complete') o`, [r.room, done]);
  ok(rc.o.outcome === 'ok', 'C: end_song_v2 complete succeeds');
  const xc = await row(done);
  ok(xc.status === 'completed', 'C: complete → status completed');
  ok(xc.resolution_code === null && xc.resolved_at === null,
     'C: NATURAL COMPLETION carries NO abnormal resolution (the contract\'s central rule)');
  ok(xc.completed_at !== null, 'C: complete still sets completed_at');

  // 'pass'/'replace' have NO production caller → they invent no reason.
  const passed = await seedRequest(r.room, r.event);
  await db.query(`update karaoke_requests set status='playing', started_at=now() where id=$1`, [passed]);
  await db.query(`select public.karaoke_end_song_v2($1,$2,'pass')`, [r.room, passed]);
  const xp = await row(passed);
  ok(xp.status === 'skipped' && xp.resolution_code === null,
     'C: an action with no production writer records NO invented reason');

  // REPLAY is idempotent and cannot rewrite the first truthful reason.
  const r2 = await one(`select public.karaoke_end_song_v2($1,$2,'skip') o`, [r.room, skip]);
  ok(r2.o.outcome === 'recovered', 'C: replaying a terminal skip returns recovered');
  const xs2 = await row(skip);
  ok(xs2.resolution_code === 'host_skipped' && String(xs2.resolved_at) === String(xs.resolved_at),
     'C: REPLAY does not change the original reason or its timestamp');

  // A DIFFERENT later action cannot overwrite either.
  await db.query(`select public.karaoke_end_song_v2($1,$2,'complete')`, [r.room, skip]);
  const xs3 = await row(skip);
  ok(xs3.status === 'skipped' && xs3.resolution_code === 'host_skipped',
     'C: a later complete cannot rewrite an already-skipped row (status guard holds)');
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n# D — measured writer: end_karaoke_event');
// ═══════════════════════════════════════════════════════════════════════════════════════════════
{
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  const waiting = await seedRequest(r.room, r.event, 60, 1);
  const playing = await seedRequest(r.room, r.event, 60, 2);
  const completed = await seedRequest(r.room, r.event, 60, 3);
  await db.query(`update karaoke_requests set status='playing', started_at=now() where id=$1`, [playing]);
  await db.query(`update karaoke_requests set status='completed', completed_at=now() where id=$1`, [completed]);

  const res = await one(`select public.end_karaoke_event($1) o`, [r.event]);
  ok(res.o.unfinishedClosedCount === 2, 'D: exactly the two unfinished rows are closed');
  ok(res.o.completedCount === 1, 'D: the completed count is unchanged by End');

  const xw = await row(waiting), xp = await row(playing), xc = await row(completed);
  ok(xw.status === 'removed' && xw.resolution_code === 'event_ended', 'D: waiting → removed + event_ended');
  ok(xp.status === 'skipped' && xp.resolution_code === 'event_ended', 'D: playing → skipped + event_ended');
  ok(xw.resolved_at !== null && xp.resolved_at !== null, 'D: both carry resolved_at');
  ok(xc.status === 'completed' && xc.resolution_code === null,
     'D: a COMPLETED row is NOT rewritten by Event end (honest history preserved)');

  // Event end must NOT overwrite a reason recorded earlier by a different actor.
  const r3 = await seedRoom(a.ws);
  const cancelled = await seedRequest(r3.room, r3.event);
  await db.query(`update karaoke_requests set status='removed', resolution_code='guest_cancelled', resolved_at=now() where id=$1`, [cancelled]);
  const before = await row(cancelled);
  await db.query(`select public.end_karaoke_event($1)`, [r3.event]);
  const after = await row(cancelled);
  ok(after.resolution_code === 'guest_cancelled' && String(after.resolved_at) === String(before.resolved_at),
     'D: Event end NEVER rewrites a Guest cancellation as event_ended');

  // Replaying End is idempotent for resolutions.
  const r4 = await seedRoom(a.ws);
  const w4 = await seedRequest(r4.room, r4.event);
  await db.query(`select public.end_karaoke_event($1)`, [r4.event]);
  const f1 = await row(w4);
  await db.query(`select public.end_karaoke_event($1)`, [r4.event]);
  const f2 = await row(w4);
  ok(f1.resolution_code === 'event_ended' && String(f1.resolved_at) === String(f2.resolved_at),
     'D: replaying Event end leaves the recorded resolution untouched');
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n# E — precedence: the first truthful terminal disposition wins');
// ═══════════════════════════════════════════════════════════════════════════════════════════════
{
  const a = await seedAccount(); const r = await seedRoom(a.ws);

  // Guest cancel vs Host remove — both are guarded `status='waiting'` UPDATEs, so exactly one
  // can match. This models the second writer arriving after the first committed.
  const race = await seedRequest(r.room, r.event);
  const first = await q(`update karaoke_requests set status='removed', resolution_code='guest_cancelled', resolved_at=now()
                          where id=$1 and status='waiting' returning id`, [race]);
  const second = await q(`update karaoke_requests set status='removed', resolution_code='host_removed', resolved_at=now()
                          where id=$1 and status='waiting' returning id`, [race]);
  ok(first.length === 1 && second.length === 0,
     'E: the second terminal writer matches ZERO rows — the status guard is the precedence rule');
  ok((await row(race)).resolution_code === 'guest_cancelled', 'E: the first truthful reason stands');

  // A CONCURRENT pair converges deterministically: the loser blocks on the row lock, then its
  // status predicate is re-evaluated against the committed row and matches nothing.
  const conc = await seedRequest(r.room, r.event);
  const cA = new pg.Client(CONN), cB = new pg.Client(CONN);
  await cA.connect(); await cB.connect();
  await cA.query('begin'); await cB.query('begin');
  const wonA = (await cA.query(`update karaoke_requests set status='removed', resolution_code='guest_cancelled', resolved_at=now()
                                 where id=$1 and status='waiting' returning id`, [conc])).rowCount;
  const pending = cB.query(`update karaoke_requests set status='skipped', resolution_code='host_skipped', resolved_at=now()
                             where id=$1 and status='waiting' returning id`, [conc]);
  await cA.query('commit');
  const wonB = (await pending).rowCount;
  await cB.query('commit');
  await cA.end(); await cB.end();
  ok(wonA === 1 && wonB === 0, 'E: under real concurrency exactly ONE writer wins');
  ok((await row(conc)).resolution_code === 'guest_cancelled', 'E: the committed winner\'s reason is the stored one');
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n# F — the accounting graph is untouched');
// ═══════════════════════════════════════════════════════════════════════════════════════════════
{
  // The migration must not have altered any accounting table's shape.
  const seg = await q(`select column_name from information_schema.columns
    where table_name='karaoke_event_usage_segments' and column_name in ('resolution_code','resolved_at')`);
  ok(seg.length === 0, 'F: no resolution column leaked into the usage-segment table');
  const grace = await q(`select column_name from information_schema.columns
    where table_name='karaoke_free_final_song_grace' and column_name in ('resolution_code','resolved_at')`);
  ok(grace.length === 0, 'F: no resolution column leaked into the grace ledger');

  // A skip still closes its segment and still bills the SAME lease — recording a reason must not
  // refund, extend, or re-charge anything.
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  const req = await seedRequest(r.room, r.event, 120);
  const begin = await one(`select public.karaoke_begin_song_v2($1,$2,'guest') o`, [r.room, req]);
  ok(begin.o.outcome === 'ok', `F: begin_song_v2 still admits normally (got ${JSON.stringify(begin.o)})`);
  const segBefore = await one(`select lease_seconds, lease_ends_at, charged_window_start from karaoke_event_usage_segments where request_id=$1`, [req]);
  await db.query(`select public.karaoke_end_song_v2($1,$2,'skip')`, [r.room, req]);
  const segAfter = await one(`select lease_seconds, lease_ends_at, charged_window_start, ended_at, close_reason from karaoke_event_usage_segments where request_id=$1`, [req]);
  ok(String(segBefore.lease_seconds) === String(segAfter.lease_seconds), 'F: lease_seconds unchanged by a resolved skip');
  ok(String(segBefore.lease_ends_at) === String(segAfter.lease_ends_at),
     'F: lease_ends_at is STILL never modified (BUILD 20M non-shrink invariant holds)');
  ok(String(segBefore.charged_window_start) === String(segAfter.charged_window_start), 'F: the charged window is unchanged');
  ok(segAfter.close_reason === 'skipped', 'F: the segment close_reason mapping is unchanged');
  ok((await row(req)).resolution_code === 'host_skipped', 'F: ...and the Guest-facing reason was still recorded');
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n# G — owner-only retrieval shape (the query the API will run)');
// ═══════════════════════════════════════════════════════════════════════════════════════════════
{
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  const mine = await seedRequest(r.room, r.event, 60, 1);
  const theirs = await seedRequest(r.room, r.event, 60, 2);
  await db.query(`update karaoke_requests set status='removed', resolution_code='host_removed', resolved_at=now() where id in ($1,$2)`, [mine, theirs]);

  // The API filters by EXPLICIT request-id allowlist (the ids the caller proved ownership of).
  const got = await q(`select id, resolution_code from karaoke_requests
                        where event_id=$1 and id = any($2::uuid[]) and resolution_code is not null`, [r.event, [mine]]);
  ok(got.length === 1 && got[0].id === mine, 'G: the owner-scoped query returns ONLY the proven request');
  ok(!got.some(x => x.id === theirs), 'G: another Guest\'s resolved row is not returned');

  // Cross-Event isolation: the same proven id must not surface under a different event.
  const other = await seedRoom(a.ws);
  const cross = await q(`select id from karaoke_requests
                          where event_id=$1 and id = any($2::uuid[]) and resolution_code is not null`, [other.event, [mine]]);
  ok(cross.length === 0, 'G: an id from another Event is filtered out by the event scope');
}

console.log(`\nRESULT: ${pass} passed, ${fails.length} failed`);
if (fails.length) { for (const f of fails) console.log('FAILED: ' + f); process.exit(1); }
await db.end();
