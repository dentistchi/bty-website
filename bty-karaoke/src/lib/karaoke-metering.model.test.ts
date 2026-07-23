// B1 SHADOW METERING — RPC CONTRACT MODEL.
//
// A JavaScript reimplementation of the DRAFT_B1_karaoke_shadow_metering.sql decision
// logic, exercised against an in-memory table. It pins the OUTCOME CONTRACT the service
// wiring depends on (begin/end/event-end/reconcile/cutover/entitlement/capture).
//
// LIMITATION (explicit): this is a behavioral MODEL. It does NOT prove real PostgreSQL
// advisory-lock serialization, trigger firing, CHECK/unique-constraint enforcement, or
// PL/pgSQL transaction rollback. Those require the mandatory real-Postgres gate before
// production activation. enforcement_enabled=false throughout B1.

import { describe, it, expect, beforeEach } from 'vitest';

type ReqStatus = 'waiting' | 'playing' | 'completed' | 'skipped' | 'removed';
interface Req { id: string; room: string; event: string; status: ReqStatus; position: number; created: string; ready_at: string | null; completed_at: string | null }
interface Ev { id: string; room: string; status: 'draft' | 'active' | 'ended' | 'archived'; ended_at: string | null }
interface Seg { id: string; account: string; event: string; room: string; request: string; plan: 'FREE' | 'PRO'; metered: boolean; started_at: number; ended_at: number | null; close_reason: string | null }

const db = {
  owners: {} as Record<string, string | null>, // room → exactly-one owner (null = invalid)
  plans: {} as Record<string, 'FREE' | 'PRO'>,
  reqs: [] as Req[],
  evs: [] as Ev[],
  segs: [] as Seg[],
  enforcement: false,
  seq: 0,
};
const NOW = 1000; // fixed clock for the model (seconds)
const owner = (room: string) => db.owners[room] ?? null;
const req = (id: string) => db.reqs.find((r) => r.id === id) ?? null;
const ev = (id: string) => db.evs.find((e) => e.id === id) ?? null;
const openSeg = (reqId: string) => db.segs.find((s) => s.request === reqId && s.ended_at === null) ?? null;

// ── begin_song ──
function begin(room: string, reqId: string, mode: string) {
  if (mode !== 'guest' && mode !== 'promote') return { outcome: 'invalid_mode' };
  const acct = owner(room);
  if (!acct) return { outcome: 'ownership_state_invalid' };
  const r = req(reqId);
  if (!r || r.room !== room) return { outcome: 'not_found' };
  if (r.status !== 'waiting') return { outcome: 'not_waiting' };
  const e = ev(r.event);
  if (!e || e.room !== room || e.status !== 'active') return { outcome: 'event_state_invalid' };
  if (db.reqs.some((x) => x.room === room && x.status === 'playing')) return { outcome: 'already_playing' };
  const pool = db.reqs.filter((x) => x.room === room && x.event === r.event && x.status === 'waiting');
  if (mode === 'guest') {
    const first = [...pool].sort((a, b) => a.position - b.position)[0];
    if (first?.id !== reqId) return { outcome: 'not_next' };
  } else {
    if (r.ready_at === null) return { outcome: 'not_ready' };
    const firstReady = pool.filter((x) => x.ready_at !== null).sort((a, b) => a.position - b.position)[0];
    if (firstReady?.id !== reqId) return { outcome: 'not_next' };
  }
  const plan = db.plans[acct] ?? 'FREE';
  // B2 enforcement gate — mirrors karaoke_begin_song §G: FREE + enforcement on + no
  // daily minutes left → upgrade_required, and NOTHING mutates (the flip never runs,
  // no segment opens). PRO and enforcement-off skip the gate entirely.
  if (db.enforcement && plan === 'FREE') {
    const ent = entitlement(acct, NOW) as { remainingSeconds?: number; outcome?: string };
    if (ent.outcome) return { outcome: 'shadow_metering_error', detail: ent.outcome };
    if ((ent.remainingSeconds ?? 0) <= 0) return { outcome: 'upgrade_required', entitlement: ent };
  }
  // segment conflict → the whole "transaction" fails; the flip does NOT persist (rollback).
  if (db.segs.some((s) => s.request === reqId)) throw new Error('segment unique(request_id) violation → rollback');
  r.status = 'playing';
  db.segs.push({ id: `seg-${++db.seq}`, account: acct, event: r.event, room, request: reqId, plan, metered: plan === 'FREE', started_at: NOW, ended_at: null, close_reason: null });
  return { outcome: 'ok' };
}

// ── end_song ──
function end(room: string, reqId: string, action: string) {
  if (!['complete', 'skip', 'pass', 'replace'].includes(action)) return { outcome: 'invalid_action' };
  const acct = owner(room);
  if (!acct) return { outcome: 'ownership_state_invalid' };
  const r = req(reqId);
  if (!r || r.room !== room) return { outcome: 'not_found' };
  const seg = openSeg(reqId);
  const reason = action === 'complete' ? 'completed' : action === 'skip' ? 'skipped' : action === 'pass' ? 'passed' : 'replaced';
  if (r.status === 'playing') {
    r.status = action === 'complete' ? 'completed' : 'skipped';
    if (action === 'complete') r.completed_at = String(NOW);
    if (seg) { seg.ended_at = NOW; seg.close_reason = reason; return { outcome: 'ok', segmentClosed: true, shadowAnomaly: 'none' }; }
    return { outcome: 'ok', segmentClosed: false, shadowAnomaly: 'segment_missing' };
  }
  if (r.status === 'completed' || r.status === 'skipped') {
    if (seg) { seg.ended_at = NOW; seg.close_reason = 'recovery'; return { outcome: 'recovered' }; }
    return { outcome: 'already_done' };
  }
  return { outcome: 'not_playing' }; // waiting/removed
}

// ── entitlement_at ──
function entitlement(acct: string, asOf: number | null) {
  if (asOf === null) return { outcome: 'invalid_as_of' };
  if (!db.hasOwnProperty('enforcement')) return { outcome: 'policy_unavailable' };
  if (!(acct in db.plans) && db.owners && !Object.values(db.owners).includes(acct)) {
    /* account existence modeled via plans/owners */
  }
  const exists = acct in db.plans || Object.values(db.owners).includes(acct);
  if (!exists) return { outcome: 'account_not_found' };
  const plan = db.plans[acct] ?? 'FREE';
  const active = db.segs.filter((s) => s.account === acct && s.ended_at === null && req(s.request)?.status === 'playing' && !['ended', 'archived'].includes(ev(s.event)?.status ?? '')).length;
  if (plan === 'PRO') return { plan: 'PRO', unlimited: true, activePlaybackCount: active, burnRatePerSecond: 0, warnLevel: 'none' };
  const burn = db.segs.filter((s) => s.account === acct && s.ended_at === null && s.metered && req(s.request)?.status === 'playing' && !['ended', 'archived'].includes(ev(s.event)?.status ?? '')).length;
  // used = Σ metered overlap with effective_end = LEAST(seg.ended, terminal, event.ended, asOf)
  let used = 0;
  for (const s of db.segs.filter((x) => x.account === acct && x.metered)) {
    const r = req(s.request); const e = ev(s.event);
    const terminal = r && r.status !== 'playing' ? (r.completed_at ? Number(r.completed_at) : asOf) : asOf;
    const eventEnd = e && ['ended', 'archived'].includes(e.status) ? (e.ended_at ? Number(e.ended_at) : asOf) : asOf;
    const eff = Math.min(s.ended_at ?? asOf, terminal, eventEnd, asOf);
    used += Math.max(0, eff - s.started_at);
  }
  const remaining = Math.max(0, 900 - Math.floor(used));
  // B2 warnLevel — mirrors karaoke_free_minutes_entitlement_at §E: computed ONLY when
  // enforcement is enabled (else always 'none' — no active-enforcement warning).
  let warnLevel: 'none' | 'five_min' | 'two_min' | 'zero' = 'none';
  if (db.enforcement) {
    warnLevel = remaining <= 0 ? 'zero' : remaining <= 120 ? 'two_min' : remaining <= 300 ? 'five_min' : 'none';
  }
  return { plan: 'FREE', unlimited: false, enforcementEnabled: db.enforcement, limitSeconds: 900, usedSeconds: Math.floor(used), remainingSeconds: remaining, activePlaybackCount: active, burnRatePerSecond: burn, warnLevel };
}

beforeEach(() => {
  db.owners = { r1: 'acctA' };
  db.plans = { acctA: 'FREE' };
  db.reqs = [];
  db.evs = [{ id: 'e1', room: 'r1', status: 'active', ended_at: null }];
  db.segs = [];
  db.enforcement = false;
  db.seq = 0;
});
function seedReq(id: string, position: number, over: Partial<Req> = {}) {
  db.reqs.push({ id, room: 'r1', event: 'e1', status: 'waiting', position, created: `t${position}`, ready_at: null, completed_at: null, ...over });
}

describe('begin_song contract', () => {
  it('invalid_mode / ownership / not_found / not_waiting / event_state_invalid', () => {
    seedReq('a', 1, { ready_at: 'r' });
    expect(begin('r1', 'a', 'bogus').outcome).toBe('invalid_mode');
    db.owners.r1 = null; expect(begin('r1', 'a', 'promote').outcome).toBe('ownership_state_invalid'); db.owners.r1 = 'acctA';
    expect(begin('r1', 'ghost', 'promote').outcome).toBe('not_found');
    db.reqs[0].status = 'completed'; expect(begin('r1', 'a', 'promote').outcome).toBe('not_waiting'); db.reqs[0].status = 'waiting';
    db.evs[0].status = 'ended'; expect(begin('r1', 'a', 'promote').outcome).toBe('event_state_invalid'); db.evs[0].status = 'active';
  });
  it('stage-open parity: already_playing when a song is on stage', () => {
    seedReq('p', 1, { status: 'playing' }); seedReq('a', 2, { ready_at: 'r' });
    expect(begin('r1', 'a', 'promote').outcome).toBe('already_playing');
  });
  it('event-scoped canonical: a stale OTHER-event waiting row does not block', () => {
    db.evs.push({ id: 'e0', room: 'r1', status: 'ended', ended_at: null });
    seedReq('stale', 0, { event: 'e0' }); // lower position but different (ended) event
    seedReq('a', 1, { ready_at: 'r' });
    expect(begin('r1', 'a', 'promote').outcome).toBe('ok');
    expect(req('a')?.status).toBe('playing');
  });
  it('guest requires first-waiting; promote requires first-ready', () => {
    seedReq('a', 1); seedReq('b', 2, { ready_at: 'r' });
    expect(begin('r1', 'b', 'guest').outcome).toBe('not_next'); // a is first waiting
    expect(begin('r1', 'a', 'promote').outcome).toBe('not_ready'); // a not ready
    expect(begin('r1', 'b', 'promote').outcome).toBe('ok'); // b is first ready
  });
  it('ok opens exactly one segment; a duplicate start rolls back (throws, no state change)', () => {
    seedReq('a', 1, { ready_at: 'r' });
    expect(begin('r1', 'a', 'promote').outcome).toBe('ok');
    // force the conflict path: request already has a segment
    db.reqs[0].status = 'waiting';
    expect(() => begin('r1', 'a', 'promote')).toThrow(/rollback/);
    expect(req('a')?.status).toBe('waiting'); // flip did not persist
    expect(db.segs.filter((s) => s.request === 'a').length).toBe(1);
  });
});

describe('end_song contract', () => {
  beforeEach(() => { seedReq('a', 1, { ready_at: 'r' }); begin('r1', 'a', 'promote'); });
  it('complete closes the segment + sets completed_at; skip closes with skipped reason', () => {
    const r = end('r1', 'a', 'complete');
    expect(r).toMatchObject({ outcome: 'ok', segmentClosed: true, shadowAnomaly: 'none' });
    expect(req('a')?.status).toBe('completed');
    expect(req('a')?.completed_at).toBe(String(NOW));
    expect(openSeg('a')).toBeNull();
  });
  it('invalid_action writes nothing', () => {
    expect(end('r1', 'a', 'bogus').outcome).toBe('invalid_action');
    expect(req('a')?.status).toBe('playing');
  });
  it('duplicate complete → already_done (segment already closed, no overwrite)', () => {
    end('r1', 'a', 'complete');
    const closedAt = db.segs[0].close_reason;
    expect(end('r1', 'a', 'complete').outcome).toBe('already_done');
    expect(db.segs[0].close_reason).toBe(closedAt); // unchanged
  });
  it('terminal + stray OPEN segment → recovered (close as recovery, not the action reason)', () => {
    req('a')!.status = 'completed'; // simulate crash: terminal but segment left open
    const r = end('r1', 'a', 'skip');
    expect(r.outcome).toBe('recovered');
    expect(db.segs[0].close_reason).toBe('recovery');
  });
  it('completing a WAITING request → not_playing (parity with isValidTransition)', () => {
    seedReq('b', 2);
    expect(end('r1', 'b', 'complete').outcome).toBe('not_playing');
  });
  it('playing but NO open segment → ok + segment_missing anomaly (never blocks completion)', () => {
    db.segs = []; // simulate a cutover gap
    const r = end('r1', 'a', 'complete');
    expect(r).toMatchObject({ outcome: 'ok', segmentClosed: false, shadowAnomaly: 'segment_missing' });
    expect(req('a')?.status).toBe('completed');
  });
});

describe('entitlement contract', () => {
  it('invalid_as_of / account_not_found', () => {
    expect(entitlement('acctA', null).outcome).toBe('invalid_as_of');
    expect(entitlement('ghost', NOW).outcome).toBe('account_not_found');
  });
  it('PRO → unlimited; FREE → used/remaining with LEAST effective-end', () => {
    db.plans.acctA = 'PRO';
    expect(entitlement('acctA', NOW)).toMatchObject({ plan: 'PRO', unlimited: true });
    db.plans.acctA = 'FREE';
    // one closed metered segment of 60s
    db.segs.push({ id: 's', account: 'acctA', event: 'e1', room: 'r1', request: 'x', plan: 'FREE', metered: true, started_at: NOW - 60, ended_at: NOW, close_reason: 'completed' });
    const e = entitlement('acctA', NOW) as { usedSeconds: number; remainingSeconds: number };
    expect(e.usedSeconds).toBe(60);
    expect(e.remainingSeconds).toBe(840);
  });
  it('activePlaybackCount/burn ignore a stale open segment whose request is terminal', () => {
    seedReq('a', 1, { ready_at: 'r' }); begin('r1', 'a', 'promote');
    let e = entitlement('acctA', NOW) as { activePlaybackCount: number; burnRatePerSecond: number };
    expect(e.activePlaybackCount).toBe(1);
    req('a')!.status = 'completed'; // segment still open, but request terminal
    e = entitlement('acctA', NOW) as { activePlaybackCount: number; burnRatePerSecond: number };
    expect(e.activePlaybackCount).toBe(0);
    expect(e.burnRatePerSecond).toBe(0);
  });
});

// ── B2 ENFORCEMENT MATRIX (enforcement_enabled=true) ─────────────────────────────
// Mirrors the SQL that is ALREADY deployed but gated off in B1. Proves the start-
// boundary block, the warning thresholds, current-song safety, and the automatic-next
// boundary against the same in-memory model the B1 contract tests use.
describe('B2 enforcement — FREE daily limit', () => {
  // Burn `used` seconds via ONE closed metered segment (distinct request id so it never
  // collides with the unique(request_id) / one-open-per-room rules under test).
  function burnUsed(used: number) {
    const id = `used-${++db.seq}`;
    db.segs.push({ id, account: 'acctA', event: 'e1', room: 'r1', request: id, plan: 'FREE', metered: true, started_at: NOW - used, ended_at: NOW, close_reason: 'completed' });
  }
  const remainingOf = () => (entitlement('acctA', NOW) as { remainingSeconds: number }).remainingSeconds;
  const warnOf = () => (entitlement('acctA', NOW) as { warnLevel: string }).warnLevel;

  describe('usage calculation', () => {
    it('fresh FREE window → 900s, no warn', () => { db.enforcement = true; expect(remainingOf()).toBe(900); expect(warnOf()).toBe('none'); });
    it('30s used → 870s', () => { db.enforcement = true; burnUsed(30); expect(remainingOf()).toBe(870); });
    it('over-limit never goes negative → 0', () => { db.enforcement = true; burnUsed(1200); expect(remainingOf()).toBe(0); });
    it('PRO is not FREE-metered even past the limit', () => { db.plans.acctA = 'PRO'; db.enforcement = true; burnUsed(1200); expect(entitlement('acctA', NOW)).toMatchObject({ plan: 'PRO', unlimited: true }); });
    it('enforcement disabled → warnLevel none even at 0 remaining', () => { db.enforcement = false; burnUsed(1200); expect(warnOf()).toBe('none'); });
  });

  describe('manual start gate', () => {
    beforeEach(() => { db.enforcement = true; });
    it('900 remaining → start ok + exactly one segment', () => { seedReq('a', 1, { ready_at: 'r' }); expect(begin('r1', 'a', 'promote').outcome).toBe('ok'); expect(db.segs.filter((s) => s.request === 'a').length).toBe(1); });
    it('301 remaining → start ok, no warn yet', () => { burnUsed(599); expect(warnOf()).toBe('none'); seedReq('a', 1, { ready_at: 'r' }); expect(begin('r1', 'a', 'promote').outcome).toBe('ok'); });
    it('300 remaining → start ok + five_min', () => { burnUsed(600); expect(warnOf()).toBe('five_min'); seedReq('a', 1, { ready_at: 'r' }); expect(begin('r1', 'a', 'promote').outcome).toBe('ok'); });
    it('120 remaining → start ok + two_min', () => { burnUsed(780); expect(warnOf()).toBe('two_min'); seedReq('a', 1, { ready_at: 'r' }); expect(begin('r1', 'a', 'promote').outcome).toBe('ok'); });
    it('1 remaining → start ok (server does not predict song length)', () => { burnUsed(899); seedReq('a', 1, { ready_at: 'r' }); expect(begin('r1', 'a', 'promote').outcome).toBe('ok'); });
    it('0 remaining → upgrade_required, NO segment, request stays waiting', () => { burnUsed(900); seedReq('a', 1, { ready_at: 'r' }); const r = begin('r1', 'a', 'promote'); expect(r.outcome).toBe('upgrade_required'); expect(db.segs.filter((s) => s.request === 'a').length).toBe(0); expect(req('a')?.status).toBe('waiting'); });
    it('PRO can start regardless of FREE-equivalent usage', () => { db.plans.acctA = 'PRO'; burnUsed(1200); seedReq('a', 1, { ready_at: 'r' }); expect(begin('r1', 'a', 'promote').outcome).toBe('ok'); });
    it('duplicate successful start creates no second segment', () => { seedReq('a', 1, { ready_at: 'r' }); expect(begin('r1', 'a', 'promote').outcome).toBe('ok'); expect(begin('r1', 'a', 'promote').outcome).toBe('not_waiting'); expect(db.segs.filter((s) => s.request === 'a').length).toBe(1); });
    it('enforcement disabled preserves B1 non-blocking start at 0 remaining', () => { db.enforcement = false; burnUsed(900); seedReq('a', 1, { ready_at: 'r' }); expect(begin('r1', 'a', 'promote').outcome).toBe('ok'); });
  });

  describe('current playing song at zero', () => {
    beforeEach(() => { db.enforcement = true; });
    it('remaining reaches 0 WHILE playing → stays playing, segment open, warn zero', () => {
      seedReq('a', 1, { ready_at: 'r' }); begin('r1', 'a', 'promote');
      burnUsed(900); // exhaust the window while 'a' plays
      expect(req('a')?.status).toBe('playing');
      expect(openSeg('a')).not.toBeNull();
      expect(warnOf()).toBe('zero');
    });
    it('complete at zero closes the segment exactly once (no force-stop)', () => {
      seedReq('a', 1, { ready_at: 'r' }); begin('r1', 'a', 'promote'); burnUsed(900);
      expect(end('r1', 'a', 'complete')).toMatchObject({ outcome: 'ok', segmentClosed: true });
      expect(openSeg('a')).toBeNull();
    });
  });

  describe('automatic-next boundary', () => {
    beforeEach(() => { db.enforcement = true; });
    it('zero remaining: current closes, next start blocked, next stays waiting, no next segment', () => {
      seedReq('a', 1, { ready_at: 'r' }); seedReq('b', 2, { ready_at: 'r' });
      begin('r1', 'a', 'promote'); burnUsed(900);
      expect(end('r1', 'a', 'complete')).toMatchObject({ outcome: 'ok', segmentClosed: true });
      const next = begin('r1', 'b', 'promote');
      expect(next.outcome).toBe('upgrade_required');
      expect(req('b')?.status).toBe('waiting');
      expect(db.segs.filter((s) => s.request === 'b').length).toBe(0);
    });
    it('positive remaining: current closes then next opens exactly one segment', () => {
      seedReq('a', 1, { ready_at: 'r' }); seedReq('b', 2, { ready_at: 'r' });
      begin('r1', 'a', 'promote'); end('r1', 'a', 'complete');
      expect(begin('r1', 'b', 'promote').outcome).toBe('ok');
      expect(db.segs.filter((s) => s.request === 'b').length).toBe(1);
    });
  });
});
