// BUILD 25 — domain tests for request resolution: the code table, the copy mapping, the client
// merge rules, and the Event-isolation predicate.
//
// The merge rules are where the product defect can silently come back, so each rule is asserted
// as a behaviour a mutation would break, not as a restatement of the implementation.

import { describe, it, expect } from 'vitest';
import {
  RESOLUTION_CODES,
  RESOLUTION_MESSAGE_KEY,
  RESOLVED_MAX,
  RESOLVED_VIEW_KEYS,
  UNKNOWN_RESOLUTION,
  isResolutionCode,
  mergeResolutions,
  resolutionAccessibilityLabel,
  resolutionCopy,
  resolutionsSurviveEvent,
  toDisplayResolution,
  type ResolvedRequestView,
} from './request-resolution';
import { groupOwned, type OwnedRow } from './guest-requests';

const view = (requestId: string, over: Partial<ResolvedRequestView> = {}): ResolvedRequestView => ({
  requestId,
  videoId: 'vid1',
  title: '노래',
  channelTitle: null,
  thumbnailUrl: null,
  status: 'removed',
  resolutionCode: 'host_removed',
  resolvedAt: '2026-08-08T10:00:00.000Z',
  eventId: 'evt-1',
  ...over,
});

describe('BUILD 25 — resolution codes', () => {
  it('persists exactly the four codes that have a production writer', () => {
    expect([...RESOLUTION_CODES]).toEqual([
      'guest_cancelled',
      'host_removed',
      'host_skipped',
      'event_ended',
    ]);
  });

  it('unknown_resolution is NOT a storable code — it is a projection fallback only', () => {
    expect(isResolutionCode(UNKNOWN_RESOLUTION)).toBe(false);
    expect((RESOLUTION_CODES as readonly string[]).includes(UNKNOWN_RESOLUTION)).toBe(false);
  });

  it('rejects anything outside the table, including near-misses and non-strings', () => {
    for (const bad of ['host_remove', 'HOST_REMOVED', '', null, undefined, 7, {}]) {
      expect(isResolutionCode(bad)).toBe(false);
    }
  });

  it('a legacy null reason degrades to unknown_resolution rather than being dropped', () => {
    expect(toDisplayResolution(null)).toBe(UNKNOWN_RESOLUTION);
    expect(toDisplayResolution(undefined)).toBe(UNKNOWN_RESOLUTION);
    // A future writer this build does not know must also degrade, never throw.
    expect(toDisplayResolution('some_future_code')).toBe(UNKNOWN_RESOLUTION);
  });
});

describe('BUILD 25 — copy mapping', () => {
  it('is exhaustive: every code and the fallback have copy', () => {
    for (const c of [...RESOLUTION_CODES, UNKNOWN_RESOLUTION]) {
      expect(RESOLUTION_MESSAGE_KEY[c]).toBeTruthy();
      // BUILD 26G — every code must render real copy in EVERY language, not just Korean.
      for (const locale of ['ko', 'en'] as const) {
        expect(resolutionCopy(locale, c)).toBeTruthy();
        expect(resolutionCopy(locale, c)).not.toBe(RESOLUTION_MESSAGE_KEY[c]);
      }
    }
  });

  it('renders the approved Korean sentence for each code', () => {
    expect(resolutionCopy('ko', 'guest_cancelled')).toBe('신청을 취소했어요.');
    expect(resolutionCopy('ko', 'host_removed')).toBe('Host가 이 곡을 대기열에서 제거했어요.');
    expect(resolutionCopy('ko', 'host_skipped')).toBe('Host가 이 곡의 재생을 종료했어요.');
    expect(resolutionCopy('ko', 'event_ended')).toBe('노래방이 종료되어 이 신청곡의 진행이 끝났어요.');
    expect(resolutionCopy('ko', null)).toBe('이 곡은 더 이상 대기열에 없어요.');
  });

  it('never claims the song completed', () => {
    for (const c of [...RESOLUTION_CODES, UNKNOWN_RESOLUTION]) {
      expect(resolutionCopy('ko', c)).not.toContain('완료');
      expect(resolutionCopy('ko', c)).not.toContain('부르셨');
    }
  });

  it('only the guest_cancelled sentence says the Guest cancelled', () => {
    const cancelClaim = (s: string) => s.includes('취소');
    expect(cancelClaim(resolutionCopy('ko', 'guest_cancelled'))).toBe(true);
    for (const c of ['host_removed', 'host_skipped', 'event_ended', UNKNOWN_RESOLUTION] as const) {
      expect(cancelClaim(resolutionCopy('ko', c))).toBe(false);
    }
  });

  it('the unknown fallback guesses no specific actor', () => {
    const u = resolutionCopy('ko', UNKNOWN_RESOLUTION);
    expect(u).not.toContain('Host');
    expect(u).not.toContain('취소');
    expect(u).not.toContain('종료되어');
  });

  it('exposes no internal detail in any sentence', () => {
    for (const c of [...RESOLUTION_CODES, UNKNOWN_RESOLUTION]) {
      const s = resolutionCopy('ko', c);
      expect(s).not.toMatch(/error|null|undefined|uuid|token|account|segment|lease/i);
    }
  });

  it('builds a VoiceOver label that names the song and then what happened', () => {
    const label = resolutionAccessibilityLabel('ko', '아파트', 'host_removed');
    expect(label).toBe('아파트. Host가 이 곡을 대기열에서 제거했어요.');
    // A blank title still yields a meaningful label rather than a leading full stop.
    expect(resolutionAccessibilityLabel('ko', '   ', 'event_ended')).toBe(
      '신청곡. 노래방이 종료되어 이 신청곡의 진행이 끝났어요.',
    );
  });
});

describe('BUILD 25 — groupOwned retains resolved rows (the defect)', () => {
  const rows: OwnedRow[] = [
    { requestId: 'a', state: 'waiting' },
    { requestId: 'b', state: 'done' },
    { requestId: 'c', state: 'removed' },
    { requestId: 'd', state: 'not_found' },
    { requestId: 'e', state: 'now_playing' },
  ];

  it('a removed request is RETAINED, not silently discarded', () => {
    // THE REGRESSION THAT DEFINES THIS BUILD: `removed` used to hit `continue` and vanish.
    expect(groupOwned(rows).resolvedIds).toEqual(['c', 'd']);
  });

  it('the three collections are mutually exclusive and cover every row', () => {
    const g = groupOwned(rows);
    const all = [...g.activeIds, ...g.completedIds, ...g.resolvedIds];
    expect(all.sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(new Set(all).size).toBe(all.length);
  });

  it('completed history stays separate from resolved results', () => {
    const g = groupOwned(rows);
    expect(g.completedIds).toEqual(['b']);
    expect(g.resolvedIds).not.toContain('b');
  });
});

describe('BUILD 25 — merge rules', () => {
  it('a resolution REMOVES the request from the active snapshot', () => {
    const r = mergeResolutions([{ requestId: 'a' }, { requestId: 'b' }], [], [view('a')]);
    expect(r.active.map((x) => x.requestId)).toEqual(['b']);
    expect(r.resolved.map((x) => x.requestId)).toEqual(['a']);
  });

  it('a STALE active poll cannot resurrect a resolved request', () => {
    // The poll was in flight when the Host removed 'a', so it still lists 'a' as active.
    const r = mergeResolutions([{ requestId: 'a' }], [view('a')], []);
    expect(r.active).toEqual([]);
    expect(r.resolved.map((x) => x.requestId)).toEqual(['a']);
  });

  it('never places a request in both collections', () => {
    const r = mergeResolutions([{ requestId: 'a' }], [view('a')], [view('a')]);
    const ids = new Set([...r.active.map((x) => x.requestId), ...r.resolved.map((x) => x.requestId)]);
    expect(ids.size).toBe(1);
    expect(r.active).toEqual([]);
  });

  it('repeated terminal polls do not duplicate a card', () => {
    let r = mergeResolutions([], [], [view('a')]);
    r = mergeResolutions([], r.resolved, [view('a')]);
    r = mergeResolutions([], r.resolved, [view('a')]);
    expect(r.resolved).toHaveLength(1);
  });

  it('keeps a known resolution when a later poll does not mention it', () => {
    // A capability can expire while the explanation is still on screen; it must not disappear.
    const r = mergeResolutions([], [view('a')], []);
    expect(r.resolved.map((x) => x.requestId)).toEqual(['a']);
  });

  it('SAME VIDEO with a different requestId stays independent', () => {
    // A is resolved; B re-requests the same video and must remain active.
    const r = mergeResolutions(
      [{ requestId: 'B' }],
      [view('A', { videoId: 'same' })],
      [],
    );
    expect(r.active.map((x) => x.requestId)).toEqual(['B']);
    expect(r.resolved.map((x) => x.requestId)).toEqual(['A']);
    // Resolving B must not rewrite A.
    const r2 = mergeResolutions([], r.resolved, [view('B', { videoId: 'same', resolutionCode: 'guest_cancelled' })]);
    expect(r2.resolved.find((x) => x.requestId === 'A')?.resolutionCode).toBe('host_removed');
    expect(r2.resolved.find((x) => x.requestId === 'B')?.resolutionCode).toBe('guest_cancelled');
  });

  it('orders newest first with a stable tie-break', () => {
    const older = view('a', { resolvedAt: '2026-08-08T09:00:00.000Z' });
    const newer = view('b', { resolvedAt: '2026-08-08T11:00:00.000Z' });
    expect(mergeResolutions([], [], [older, newer]).resolved.map((x) => x.requestId)).toEqual(['b', 'a']);
    // Equal timestamps must not reshuffle between polls.
    const t = '2026-08-08T10:00:00.000Z';
    const one = mergeResolutions([], [], [view('y', { resolvedAt: t }), view('x', { resolvedAt: t })]).resolved;
    const two = mergeResolutions([], [], [view('x', { resolvedAt: t }), view('y', { resolvedAt: t })]).resolved;
    expect(one.map((r) => r.requestId)).toEqual(two.map((r) => r.requestId));
  });

  it('a fresher server view replaces a stale cached one for the same request', () => {
    const r = mergeResolutions([], [view('a', { resolutionCode: 'host_removed' })], [
      view('a', { resolutionCode: 'event_ended' }),
    ]);
    expect(r.resolved).toHaveLength(1);
    expect(r.resolved[0].resolutionCode).toBe('event_ended');
  });
});

describe('BUILD 25 — Event isolation', () => {
  it('clears stored resolutions when the Event genuinely changed', () => {
    expect(resolutionsSurviveEvent('evt-1', 'evt-2')).toBe(false);
  });

  it('keeps them within the same Event', () => {
    expect(resolutionsSurviveEvent('evt-1', 'evt-1')).toBe(true);
  });

  it('a transient unknown Event does not wipe history', () => {
    expect(resolutionsSurviveEvent('evt-1', null)).toBe(true);
    expect(resolutionsSurviveEvent(null, 'evt-1')).toBe(true);
  });
});

describe('BUILD 25 — projection allowlist', () => {
  it('pins the exact Guest-safe key list', () => {
    expect([...RESOLVED_VIEW_KEYS]).toEqual([
      'requestId',
      'videoId',
      'title',
      'channelTitle',
      'thumbnailUrl',
      'status',
      'resolutionCode',
      'resolvedAt',
      'eventId',
    ]);
  });

  it('names no private field', () => {
    const forbidden = [
      'accountId', 'account_id', 'sessionId', 'session_id', 'guestName', 'guest_name',
      'cancelToken', 'token', 'idempotencyKey', 'idempotency_key', 'leaseEndsAt',
      'segmentId', 'roomId', 'room_id', 'djSecret',
    ];
    for (const f of forbidden) expect(RESOLVED_VIEW_KEYS as readonly string[]).not.toContain(f);
  });

  it('bounds one owner-only response', () => {
    expect(RESOLVED_MAX).toBe(50);
  });
});
