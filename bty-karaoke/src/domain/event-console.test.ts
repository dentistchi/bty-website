// BUILD R4E-R1 — event classification, at its boundaries.
//
// The audit found no data defect: every one of the 43 production rows was in a legitimate state.
// So these tests are about JUDGEMENT, not correctness of storage — and the judgement that matters
// most is the negative one: an event must not be called Active, or a DJ called connected, on
// evidence that does not support it.

import { describe, it, expect } from 'vitest';
import {
  ACTIVE_IDLE_DAYS,
  RECENT_ENDED_DAYS,
  classifyEvent,
  compareForView,
  idleDays,
  matchesView,
  showDjConnected,
} from './event-console';

const NOW = Date.parse('2026-08-19T02:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86400000).toISOString();
const base = {
  status: 'active',
  lastActivityAt: daysAgo(1),
  endedAt: null as string | null,
  roomRetired: false,
  provenTest: false,
};

describe('R4E-R1 — (6) the Active idle boundary', () => {
  it('exactly 7 days is still Active; just over 7 days is not', () => {
    expect(ACTIVE_IDLE_DAYS).toBe(7);
    expect(classifyEvent({ ...base, lastActivityAt: daysAgo(7) }, NOW)).toBe('ACTIVE');
    expect(classifyEvent({ ...base, lastActivityAt: daysAgo(7.01) }, NOW)).toBe('STALE');
    expect(classifyEvent({ ...base, lastActivityAt: daysAgo(0) }, NOW)).toBe('ACTIVE');
  });

  it('(7) an old active event with no activity at all is STALE, never Active', () => {
    // The caller passes creation time when no request exists, so "never used" reads as its age.
    expect(classifyEvent({ ...base, lastActivityAt: daysAgo(27) }, NOW)).toBe('STALE');
    // And with no usable timestamp whatsoever it still must not occupy the "what is live" screen.
    expect(classifyEvent({ ...base, lastActivityAt: null }, NOW)).toBe('STALE');
    expect(classifyEvent({ ...base, lastActivityAt: 'not-a-date' }, NOW)).toBe('STALE');
  });
});

describe('R4E-R1 — (8,9) the Recent window', () => {
  it('14 days is Recent; older is Ended', () => {
    expect(RECENT_ENDED_DAYS).toBe(14);
    expect(classifyEvent({ ...base, status: 'ended', endedAt: daysAgo(14) }, NOW)).toBe('RECENT');
    expect(classifyEvent({ ...base, status: 'ended', endedAt: daysAgo(14.01) }, NOW)).toBe('ENDED');
    expect(classifyEvent({ ...base, status: 'ended', endedAt: daysAgo(2) }, NOW)).toBe('RECENT');
    expect(classifyEvent({ ...base, status: 'ended', endedAt: null }, NOW)).toBe('ENDED');
  });
});

describe('R4E-R1 — (10,11,12,13,14) provenance beats vocabulary', () => {
  it('(10) a retired room is Deleted/Archived even while the row says active', () => {
    expect(classifyEvent({ ...base, roomRetired: true }, NOW)).toBe('DELETED_ARCHIVED');
    expect(classifyEvent({ ...base, status: 'ended', endedAt: daysAgo(1), roomRetired: true }, NOW))
      .toBe('DELETED_ARCHIVED');
  });

  it('(12) a structurally proven founder test is TEST', () => {
    expect(classifyEvent({ ...base, provenTest: true, lastActivityAt: daysAgo(27) }, NOW)).toBe('TEST');
  });

  it('(13,14) a name never decides the class', () => {
    // The classifier is not given the name at all — it cannot classify by it even in principle.
    const realHostEvent = { ...base, lastActivityAt: daysAgo(12), provenTest: false };
    expect(classifyEvent(realHostEvent, NOW)).toBe('STALE');   // 테스트 / 테스트2 land here
    const demoHistory = { ...base, status: 'ended', endedAt: daysAgo(3), provenTest: false };
    expect(classifyEvent(demoHistory, NOW)).toBe('RECENT');    // BTY Demo Room history
    expect(Object.keys(realHostEvent)).not.toContain('name');
  });
});

describe('R4E-R1 — (19,20,21) the DJ badge', () => {
  it('(19,20) a historical event never shows DJ connected, however fresh the device', () => {
    for (const cls of ['ENDED', 'RECENT', 'STALE', 'TEST', 'DELETED_ARCHIVED'] as const) {
      expect(showDjConnected(cls, true, daysAgo(0), NOW)).toBe(false);
    }
  });

  it('(20) an active event with a MONTH-old device does not show DJ connected', () => {
    // Production had rooms whose active DJ devices were last used 29–34 days ago.
    expect(showDjConnected('ACTIVE', true, daysAgo(29), NOW)).toBe(false);
    expect(showDjConnected('ACTIVE', true, daysAgo(34), NOW)).toBe(false);
    expect(showDjConnected('ACTIVE', true, null, NOW)).toBe(false); // enrolled, never used
  });

  it('(21) an active event with a genuinely recent device does show DJ connected', () => {
    expect(showDjConnected('ACTIVE', true, daysAgo(0), NOW)).toBe(true);
    expect(showDjConnected('ACTIVE', true, daysAgo(ACTIVE_IDLE_DAYS), NOW)).toBe(true);
    expect(showDjConnected('ACTIVE', true, daysAgo(ACTIVE_IDLE_DAYS + 0.01), NOW)).toBe(false);
  });

  it('no device means no badge, regardless of freshness', () => {
    expect(showDjConnected('ACTIVE', false, daysAgo(0), NOW)).toBe(false);
  });
});

describe('R4E-R1 — views and (17,18) ordering', () => {
  it('each view admits exactly its own class', () => {
    expect(matchesView('active', 'ACTIVE')).toBe(true);
    expect(matchesView('active', 'STALE')).toBe(false);
    expect(matchesView('needs-attention', 'STALE')).toBe(true);
    expect(matchesView('recent', 'RECENT')).toBe(true);
    expect(matchesView('ended', 'ENDED')).toBe(true);
    expect(matchesView('test', 'TEST')).toBe(true);
    expect(matchesView('deleted', 'DELETED_ARCHIVED')).toBe(true);
    for (const c of ['ACTIVE', 'STALE', 'RECENT', 'ENDED', 'TEST', 'DELETED_ARCHIVED'] as const) {
      expect(matchesView('all', c)).toBe(true);
    }
  });

  it('(17) Active sorts by last activity, not creation', () => {
    const older = { cls: 'ACTIVE' as const, lastActivityAt: daysAgo(3), endedAt: null, createdAt: daysAgo(1) };
    const fresher = { cls: 'ACTIVE' as const, lastActivityAt: daysAgo(0), endedAt: null, createdAt: daysAgo(30) };
    // `fresher` was created a month ago but is alive today — it must come first.
    expect(compareForView('active', fresher, older)).toBeLessThan(0);
  });

  it('Needs Attention puts the MOST stale first', () => {
    const veryStale = { cls: 'STALE' as const, lastActivityAt: daysAgo(27), endedAt: null, createdAt: daysAgo(27) };
    const lessStale = { cls: 'STALE' as const, lastActivityAt: daysAgo(9), endedAt: null, createdAt: daysAgo(9) };
    expect(compareForView('needs-attention', veryStale, lessStale)).toBeLessThan(0);
  });

  it('(18) Recent and Ended sort by ended_at', () => {
    const a = { cls: 'ENDED' as const, lastActivityAt: daysAgo(40), endedAt: daysAgo(2), createdAt: daysAgo(40) };
    const b = { cls: 'ENDED' as const, lastActivityAt: daysAgo(1), endedAt: daysAgo(20), createdAt: daysAgo(30) };
    expect(compareForView('ended', a, b)).toBeLessThan(0);
    expect(compareForView('recent', a, b)).toBeLessThan(0);
  });

  it('All puts current work ahead of history', () => {
    const active = { cls: 'ACTIVE' as const, lastActivityAt: daysAgo(1), endedAt: null, createdAt: daysAgo(1) };
    const archived = { cls: 'DELETED_ARCHIVED' as const, lastActivityAt: daysAgo(0), endedAt: daysAgo(0), createdAt: daysAgo(0) };
    expect(compareForView('all', active, archived)).toBeLessThan(0);
  });
});

describe('R4E-R1 — idle age copy', () => {
  it('reports whole days, and nothing when unknown', () => {
    expect(idleDays(daysAgo(9.7), NOW)).toBe(9);
    expect(idleDays(null, NOW)).toBeNull();
  });
});
