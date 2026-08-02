// BUILD 24 — REAL PostgreSQL authority tests for 20260807120000_karaoke_free_window_truth_v1.
//
// Proves the three regressions BUILD 20M introduced in karaoke_free_minutes_entitlement_at_v2
// are closed, and that closing them changed NOTHING about admission, the union lease, or FREE
// Final Song Grace. Run via `bash supabase/tests/b24/run.sh` (isolated throwaway cluster).
import pg from 'pg';

const CONN = { host: '127.0.0.1', port: Number(process.env.PGPORT || 54331), user: 'postgres', database: 'postgres' };
const db = new pg.Client(CONN); await db.connect();

let pass = 0; const fails = [];
const ok = (c, n) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fails.push(n); console.log('  ✗ ' + n); } };
const q = (t, p) => db.query(t, p).then(r => r.rows);
const one = async (t, p) => (await q(t, p))[0];
let vid = 0; const nextVid = () => `v${String(++vid).padStart(10, '0')}`;

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
async function seedRequest(room, event, durationSeconds, pos = 1) {
  const v = nextVid();
  await db.query(`insert into karaoke_video_durations(video_id,duration_seconds) values($1,$2)`, [v, durationSeconds]);
  const req = await one(`insert into karaoke_requests(room_id,event_id,status,position,youtube_video_id)
    values($1,$2,'waiting',$3,$4) returning id`, [room, event, pos, v]);
  return req.id;
}
/** Write a CLOSED metered lease segment directly, at a chosen wall-clock start. Used to place
 *  usage at a controlled instant relative to a window boundary (begin_v2 only ever uses now).
 *
 *  `leaseEndsAt` defaults to startedAt + durationSeconds. Pass it explicitly (e.g. equal to
 *  startedAt) to model a lease that has ALREADY ELAPSED while keeping started_at inside the
 *  current window — otherwise a freshly-placed long lease is still OPEN, the union charge for
 *  the next song is 0, and the start is admitted for free. That is correct BUILD 20M behaviour,
 *  not a bug, but it is not what the exhaustion / grace cases are trying to exercise.
 *  The only relation the schema requires is `lease_ends_at >= started_at`. */
async function placeLease(acct, room, event, { startedAt, leaseSeconds, durationSeconds, chargedWindowStart, leaseEndsAt }) {
  const req = await seedRequest(room, event, durationSeconds, 90 + vid);
  await db.query(`update karaoke_requests set status='completed', started_at=$2, completed_at=$2 where id=$1`, [req, startedAt]);
  const cws = chargedWindowStart ?? startedAt;
  await db.query(
    `insert into karaoke_event_usage_segments
       (account_id,event_id,room_id,request_id,plan_snapshot,metered,started_at,ended_at,close_reason,
        timezone_snapshot,duration_seconds,lease_ends_at,lease_seconds,charged_window_start,charged_window_end)
     values ($1,$2,$3,$4,'FREE',true,$5::timestamptz,$5::timestamptz,'completed','America/Los_Angeles',
             $6::int,coalesce($9::timestamptz, $5::timestamptz + make_interval(secs=>$6::int)),
             $7::int,$8::timestamptz,$8::timestamptz + interval '1 day')`,
    [acct, event, room, req, startedAt, durationSeconds, leaseSeconds, cws, leaseEndsAt ?? null]);
  return req;
}
const begin = (room, req, mode = 'guest') => one(`select public.karaoke_begin_song_v2($1,$2,$3) o`, [room, req, mode]).then(r => r.o);
const end = (room, req, action = 'complete') => one(`select public.karaoke_end_song_v2($1,$2,$3) o`, [room, req, action]).then(r => r.o);
const entAt = (acct, asOf) => one(`select public.karaoke_free_minutes_entitlement_at_v2($1,$2::timestamptz) e`, [acct, asOf]).then(r => r.e);
const entV1At = (acct, asOf) => one(`select public.karaoke_free_minutes_entitlement_at($1,$2::timestamptz) e`, [acct, asOf]).then(r => r.e);
const entitlement = (acct) => one(`select public.karaoke_free_minutes_entitlement_at_v2($1, clock_timestamp()) e`, [acct]).then(r => r.e);
const seg = (req) => one(`select duration_seconds,lease_ends_at,lease_seconds,charged_window_start,ended_at,close_reason,metered
  from karaoke_event_usage_segments where request_id=$1`, [req]);
const localHour = (ts) => one(
  `select extract(hour from ($1::timestamptz at time zone 'America/Los_Angeles'))::int h`, [ts]).then(r => r.h);

// ───────────────────────────────────────────────────────────────────────────────
console.log('\n# migration up + object presence + hardening');
ok((await q(`select 1 from pg_proc where proname='karaoke_free_minutes_entitlement_at'`)).length === 1, 'v1 entitlement still present (coexistence preserved)');
ok((await q(`select 1 from pg_proc where proname='karaoke_active_lease_ends_at'`)).length === 1, 'D5 karaoke_active_lease_ends_at created');
for (const fn of ['karaoke_free_minutes_entitlement_at_v2', 'karaoke_begin_song_v2', 'karaoke_active_lease_ends_at']) {
  const cfg = (await one(`select proconfig from pg_proc where proname=$1`, [fn])).proconfig || [];
  ok(cfg.some(c => c.startsWith('search_path=')), `search_path pinned on ${fn}`);
  const acl = (await one(`select pg_catalog.array_to_string(proacl,',') a from pg_proc where proname=$1`, [fn])).a || '';
  ok(!/(^|,)=X/.test(acl) && !/anon=X/.test(acl) && !/authenticated=X/.test(acl), `${fn} not executable by public/anon/authenticated`);
  ok(/service_role=X/.test(acl), `${fn} executable by service_role`);
}

// ───────────────────────────────────────────────────────────────────────────────
console.log('\n# D3 — the FREE window is anchored on reset_hour_local (04:00), not local midnight');
{
  await reset();
  const a = await seedAccount();
  // The v1 function has ALWAYS honoured reset_hour_local. Equality with v1 is the invariant
  // that would have caught this regression at BUILD 20M; it is now asserted directly.
  for (const asOf of ['2026-08-02T05:30:00-07:00', '2026-08-02T11:30:00-07:00', '2026-08-02T23:10:00-07:00']) {
    const v1 = await entV1At(a.id, asOf), v2 = await entAt(a.id, asOf);
    ok(v1.windowStart === v2.windowStart, `v1/v2 windowStart agree @ ${asOf}`);
    ok(v2.nextResetAt === v2.windowEnd, `D2 nextResetAt == windowEnd @ ${asOf}`);
  }
  const mid = await entAt(a.id, '2026-08-02T11:30:00-07:00');
  ok(await localHour(mid.windowStart) === 4, 'windowStart is 04:00 local (NOT the midnight date_trunc)');
  ok(await localHour(mid.nextResetAt) === 4, 'nextResetAt is 04:00 local');
  // 02:00 local is BEFORE the 04:00 reset → it still belongs to the PREVIOUS day's window.
  const early = await entAt(a.id, '2026-08-02T02:00:00-07:00');
  ok((await one(`select ($1::timestamptz)::date = date '2026-08-01' d`, [early.windowStart])).d,
    '02:00 local belongs to the PREVIOUS window (no early reset at midnight)');
  const late = await entAt(a.id, '2026-08-02T04:30:00-07:00');
  ok((await one(`select ($1::timestamptz)::date = date '2026-08-02' d`, [late.windowStart])).d,
    '04:30 local has rolled into the NEW window');
}

console.log('\n# D3 — DST: both transitions produce exactly one calendar day');
{
  const a = await seedAccount();
  for (const [label, asOf] of [['spring-forward', '2026-03-08T12:00:00-08:00'], ['fall-back', '2026-11-01T12:00:00-07:00']]) {
    const e = await entAt(a.id, asOf);
    const d = await one(`select ($1::timestamptz - $2::timestamptz) = interval '1 day' x,
      extract(hour from ($2::timestamptz at time zone 'America/Los_Angeles'))::int h`, [e.windowEnd, e.windowStart]);
    ok(d.x === true, `${label}: window spans exactly one calendar day`);
    ok(d.h === 4, `${label}: window still starts at 04:00 local`);
  }
}

// ───────────────────────────────────────────────────────────────────────────────
console.log('\n# D3 attribution — usage is billed to the window its START falls in');
{
  await reset();
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  // 300s charged at 02:00 local on Aug 2 — BEFORE the 04:00 reset, so it belongs to Aug 1's
  // window. Its stored charged_window_start deliberately carries the OLD midnight anchor, i.e.
  // exactly what a pre-BUILD-24 row looks like. Summing by charged_window_start equality would
  // silently drop it from BOTH windows; summing by started_at attributes it correctly.
  await placeLease(a.id, r.room, r.event, {
    startedAt: '2026-08-02T02:00:00-07:00', leaseSeconds: 300, durationSeconds: 300,
    chargedWindowStart: '2026-08-02T00:00:00-07:00',
  });
  const prev = await entAt(a.id, '2026-08-02T03:00:00-07:00');
  ok(prev.usedSeconds === 300, 'pre-04:00 usage counts in the PREVIOUS window (legacy midnight anchor still found)');
  ok(prev.remainingSeconds === 600, 'previous window remaining = 900 - 300');
  const next = await entAt(a.id, '2026-08-02T05:00:00-07:00');
  ok(next.usedSeconds === 0, 'after the 04:00 reset the new window starts clean');
  ok(next.remainingSeconds === 900, 'new window remaining = full 900 (no leakage across the boundary)');
}

console.log('\n# D3 — no leakage the OTHER way: post-reset usage is not billed to the old window');
{
  await reset();
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  await placeLease(a.id, r.room, r.event, {
    startedAt: '2026-08-02T06:00:00-07:00', leaseSeconds: 240, durationSeconds: 240,
  });
  ok((await entAt(a.id, '2026-08-02T03:00:00-07:00')).usedSeconds === 0, 'the earlier window does not see later usage');
  ok((await entAt(a.id, '2026-08-02T07:00:00-07:00')).usedSeconds === 240, 'the current window sees it');
}

// ───────────────────────────────────────────────────────────────────────────────
console.log('\n# D1 — activePlaybackCount is published again (zero_playing becomes reachable)');
{
  await reset();
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  ok((await entitlement(a.id)).activePlaybackCount === 0, 'idle account reports activePlaybackCount 0');
  const req = await seedRequest(r.room, r.event, 120);
  ok((await begin(r.room, req)).outcome === 'ok', 'song admitted');
  const playing = await entitlement(a.id);
  ok(playing.activePlaybackCount === 1, 'D1 a song ON STAGE reports activePlaybackCount 1');
  ok(playing.remainingSeconds === 780, 'the charge is committed UP FRONT at admission (900-120)');
  await end(r.room, req, 'complete');
  const done = await entitlement(a.id);
  ok(done.activePlaybackCount === 0, 'after Finish activePlaybackCount returns to 0');
  ok(done.remainingSeconds === 780, 'Finish does NOT refund the lease (non-shrinkable, BUILD 20M)');
}

console.log('\n# D1 — an ENDED event does not report a phantom active playback');
{
  await reset();
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  const req = await seedRequest(r.room, r.event, 120);
  await begin(r.room, req);
  await db.query(`update karaoke_events set status='ended' where id=$1`, [r.event]);
  ok((await entitlement(a.id)).activePlaybackCount === 0, 'ended event → activePlaybackCount 0 (same predicate as v1)');
}

console.log('\n# D2 — the dropped display fields are published again');
{
  await reset();
  const a = await seedAccount();
  const e = await entAt(a.id, '2026-08-02T11:30:00-07:00');
  for (const k of ['nextResetAt', 'windowStart', 'windowEnd', 'timezone', 'warnLevel', 'activePlaybackCount', 'model'])
    ok(e[k] !== undefined && e[k] !== null, `FREE entitlement publishes ${k}`);
  ok(e.model === 'lease_v2', 'the model marker still says lease_v2');
  const pro = await seedAccount('America/Los_Angeles', 'PRO');
  const p = await entAt(pro.id, '2026-08-02T11:30:00-07:00');
  ok(p.plan === 'PRO' && p.unlimited === true, 'PRO still projects unlimited');
  ok(p.nextResetAt !== null && p.activePlaybackCount === 0, 'PRO answers the same shape (no null holes)');
  ok(p.remainingSeconds === null && p.limitSeconds === null, 'PRO has no FREE countdown');
}

console.log('\n# D2 — warnLevel tracks the policy thresholds');
{
  await reset();
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  const asOf = '2026-08-02T11:30:00-07:00';
  const at = async (used) => {
    await db.query(`delete from karaoke_event_usage_segments where account_id=$1`, [a.id]);
    if (used > 0) await placeLease(a.id, r.room, r.event, { startedAt: asOf, leaseSeconds: used, durationSeconds: Math.min(900, used) });
    return entAt(a.id, asOf);
  };
  ok((await at(0)).warnLevel === 'none', 'full balance → warnLevel none');
  ok((await at(700)).warnLevel === 'five_min', '200s left → five_min');
  ok((await at(800)).warnLevel === 'two_min', '100s left → two_min');
  ok((await at(900)).warnLevel === 'zero', 'exhausted → zero');
  ok((await at(900)).remainingSeconds === 0, 'exhausted remaining clamps to 0 (never negative)');
}

// ───────────────────────────────────────────────────────────────────────────────
console.log('\n# BUILD 20M regression — the union lease and its non-shrink are untouched');
{
  await reset();
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  const first = await seedRequest(r.room, r.event, 300, 1);
  ok((await begin(r.room, first)).outcome === 'ok', 'first song admitted');
  ok((await seg(first)).lease_seconds === 300, 'first song charges its full duration');
  await end(r.room, first, 'skip');   // skipped 1s in — the lease must NOT shrink
  const second = await seedRequest(r.room, r.event, 120, 2);
  ok((await begin(r.room, second)).outcome === 'ok', 'second song admitted inside the open lease');
  ok((await seg(second)).lease_seconds === 0,
    'a song finishing INSIDE the open lease charges 0 — no double-charge (this is why the FREE balance legitimately holds)');
  ok((await entitlement(a.id)).remainingSeconds === 600, 'account still billed 300 total, not 420');
  const lease = await one(`select public.karaoke_active_lease_ends_at($1, clock_timestamp()) l`, [a.id]);
  ok(lease.l !== null, 'D5 karaoke_active_lease_ends_at reports the open lease');
  const past = await one(`select public.karaoke_active_lease_ends_at($1, clock_timestamp() + interval '1 hour') l`, [a.id]);
  ok(past.l === null, 'D5 reports null once the lease window has passed');
}

console.log('\n# BUILD 20M regression — FREE exhaustion still blocks through server authority');
{
  await reset();
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  const now = new Date().toISOString();
  await placeLease(a.id, r.room, r.event, { startedAt: now, leaseEndsAt: now, leaseSeconds: 900, durationSeconds: 900 });
  const req = await seedRequest(r.room, r.event, 120, 5);
  const res = await begin(r.room, req);
  ok(res.outcome === 'upgrade_required', 'exhausted FREE is refused');
  ok(res.remainingSeconds === 0 && res.requiredChargeSeconds === 120, 'the refusal carries the authoritative numbers');
  ok((await one(`select status from karaoke_requests where id=$1`, [req])).status === 'waiting',
    'a refused start mutates nothing — the song is still queued');
}

console.log('\n# BUILD 20M-R4 regression — FREE Final Song Grace still converges on the 04:00 window');
{
  await reset();
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  const now = new Date().toISOString();
  await placeLease(a.id, r.room, r.event, { startedAt: now, leaseEndsAt: now, leaseSeconds: 870, durationSeconds: 870 });
  const req = await seedRequest(r.room, r.event, 100, 5);   // needs 100, has 30 → shortfall 70 (<= 90)
  const res = await begin(r.room, req);
  ok(res.outcome === 'ok' && res.finalSongGraceApplied === true, 'grace admits the final song');
  ok(res.finalSongGraceSeconds === 70 && res.finalSongChargedSeconds === 30, 'grace charges ONLY the remaining balance');
  ok((await entitlement(a.id)).remainingSeconds === 0, 'after grace the balance is exactly 0 — never negative, never refunded');
  ok((await seg(req)).lease_seconds === 30, 'the segment records the charged seconds, not the duration');
  const g = await one(`select charged_window_start from karaoke_free_final_song_grace where account_id=$1`, [a.id]);
  ok(await localHour(g.charged_window_start) === 4, 'the grace ledger keys on the SAME 04:00 window the balance uses');
  // ── once per window ──
  // Two independent proofs, because the obvious one is misleading: the graced song's lease is
  // still OPEN, so a SHORTER next song ends inside it, charges 0 (union), and is admitted for
  // free. That is correct BUILD 20M behaviour and is exactly why the FREE balance legitimately
  // holds across consecutive songs. Elapse the lease first so a real charge is required.
  await end(r.room, req, 'complete');
  const freeRide = await seedRequest(r.room, r.event, 60, 6);
  ok((await begin(r.room, freeRide)).outcome === 'ok',
    'a shorter song INSIDE the still-open lease is admitted at charge 0 (union, not a second grace)');
  ok((await seg(freeRide)).lease_seconds === 0, 'and it is charged 0 — the balance stays at 0, never negative');
  await end(r.room, freeRide, 'complete');
  await db.query(`update karaoke_event_usage_segments set lease_ends_at = started_at where account_id=$1`, [a.id]);
  const afterLease = await seedRequest(r.room, r.event, 60, 7);
  ok((await begin(r.room, afterLease)).outcome === 'upgrade_required',
    'once the lease has elapsed a new charge is required and is refused — no second grace');
  ok((await q(`select 1 from karaoke_free_final_song_grace where account_id=$1`, [a.id])).length === 1,
    'exactly one grace row exists for this account');
  // The durable backstop itself: a second grace in the SAME window is rejected by the schema.
  const dup = await db.query(
    `insert into karaoke_free_final_song_grace
       (account_id,charged_window_start,charged_window_end,request_id,remaining_before_seconds,
        duration_seconds,charged_seconds,grace_seconds)
     select account_id,charged_window_start,charged_window_end,$2,10,60,10,50
       from karaoke_free_final_song_grace where account_id=$1`, [a.id, afterLease])
    .then(() => null).catch(e => e.code);
  ok(dup === '23505', 'unique(account_id, charged_window_start) rejects a second grace in the same window');
}

console.log('\n# BUILD 22 regression — duration still fails closed');
{
  await reset();
  const a = await seedAccount(); const r = await seedRoom(a.ws);
  const req = await one(`insert into karaoke_requests(room_id,event_id,status,position,youtube_video_id)
    values($1,$2,'waiting',1,'zzzzzzzzzzz') returning id`, [r.room, r.event]);
  ok((await begin(r.room, req.id)).outcome === 'duration_unavailable', 'an unresolvable duration is refused');
  ok((await q(`select 1 from karaoke_event_usage_segments where request_id=$1`, [req.id])).length === 0,
    'no segment, no lease, no charge on a fail-closed start');
}

// ───────────────────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) { for (const f of fails) console.log('  FAIL: ' + f); }
await db.end();
process.exit(fails.length ? 1 : 0);
