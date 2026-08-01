// BUILD 23 — the web DJ console's AUTO-ADVANCE admission-block behaviour.
//
// BUILD 21's test file covers the pure reconciler that keeps a notice alive across polls. This one
// covers the decision that was missing entirely: what the console does with a `/dj/pass-turn` 200
// body. Before BUILD 23, `duration_unavailable` and `pass_insufficient` reached the
// `reason !== 'promoted'` branch and rendered "다음 준비된 참가자를 기다리는 중이에요." — a claim that
// the next singer had not pressed Ready, when pressing Ready is exactly why the server chose them.
//
// The same-song repeat (18B) discrimination is re-run here against the FINISH path, because that
// is a different call site from the Start path BUILD 21 pinned.

import { describe, it, expect } from 'vitest';
import {
  resolvePassTurnDecision,
  clearBlockSupersededBy,
  reconcileAdmissionBlock,
  type AdmissionBlock,
} from './DjConsole';

const NEXT = 'req-next';
const SERVER_MSG = '이 영상은 너무 길어요 (15분을 넘습니다). 노래는 대기열에 그대로 있습니다.\n더 짧은 버전을 선택해 주세요.';

describe('BUILD 23 — neither new block reaches the needs_ready branch', () => {
  it('duration_unavailable becomes an admission block, not not_promoted', () => {
    const d = resolvePassTurnDecision(
      { reason: 'duration_unavailable', blockedRequestId: NEXT, message: SERVER_MSG, durationFailureReason: 'too_long' },
      'fallback',
    );
    expect(d.kind).toBe('admission_block');
    if (d.kind !== 'admission_block') throw new Error('unreachable');
    expect(d.block.requestId).toBe(NEXT);
    expect(d.block.reason).toBe('too_long');
    expect(d.block.message).toBe(SERVER_MSG);
  });

  it('pass_insufficient becomes an admission block, not not_promoted', () => {
    const d = resolvePassTurnDecision(
      { reason: 'pass_insufficient', blockedRequestId: NEXT, message: '남은 이용권 시간으로는 이 곡 전체를 재생할 수 없어요.' },
      'fallback',
    );
    expect(d.kind).toBe('admission_block');
    if (d.kind !== 'admission_block') throw new Error('unreachable');
    expect(d.block.requestId).toBe(NEXT);
    expect(d.block.reason).toBeUndefined(); // a pass block is not a duration classification
  });

  it('renders the SERVER wording, never a client-invented sentence', () => {
    const d = resolvePassTurnDecision(
      { reason: 'duration_unavailable', blockedRequestId: NEXT, message: SERVER_MSG },
      'fallback',
    );
    if (d.kind !== 'admission_block') throw new Error('unreachable');
    expect(d.block.message).toBe(SERVER_MSG);
    expect(d.block.message).not.toContain('준비된 참가자');
  });

  it('falls back to the console’s own ready-first target when an older server omits the id', () => {
    const d = resolvePassTurnDecision({ reason: 'pass_insufficient' }, 'fallback-target');
    if (d.kind !== 'admission_block') throw new Error('unreachable');
    expect(d.block.requestId).toBe('fallback-target');
  });
});

describe('BUILD 23 — frozen console branches', () => {
  it('upgrade_required is unchanged', () => {
    expect(resolvePassTurnDecision({ reason: 'upgrade_required' }, NEXT).kind).toBe('upgrade_required');
  });

  it('a genuine needs_ready still takes the not_promoted branch', () => {
    expect(resolvePassTurnDecision({ reason: 'needs_ready' }, NEXT).kind).toBe('not_promoted');
  });

  it('no_next still takes the not_promoted branch', () => {
    expect(resolvePassTurnDecision({ reason: 'no_next' }, NEXT).kind).toBe('not_promoted');
  });

  it('an unknown future reason degrades to not_promoted — never to a fabricated block', () => {
    expect(resolvePassTurnDecision({ reason: 'something_new' }, NEXT).kind).toBe('not_promoted');
    expect(resolvePassTurnDecision({}, NEXT).kind).toBe('not_promoted');
  });

  it('promoted carries the started id so exactly one handoff follows', () => {
    const d = resolvePassTurnDecision({ reason: 'promoted', promoted: { id: NEXT } }, NEXT);
    expect(d).toEqual({ kind: 'promoted', promotedId: NEXT });
  });
});

// ---------------------------------------------------------------------------------------------
// Notice ownership. A and B are a legitimate 18B same-song repeat: DIFFERENT requestId, identical
// videoId/title/artist. Every assertion below fails for a videoId/title/position-keyed notice.
// ---------------------------------------------------------------------------------------------

const A = { requestId: 'req-A', youtubeVideoId: 'vid-SAME', title: '같은 노래', artist: '같은 가수' };
const B = { requestId: 'req-B', youtubeVideoId: 'vid-SAME', title: '같은 노래', artist: '같은 가수' };
const blockOnA = (): AdmissionBlock => ({ requestId: A.requestId, reason: 'too_long', message: SERVER_MSG });

describe('BUILD 23 — notice ownership across the finish path', () => {
  it('a poll that still contains the blocked request keeps the notice (identical object)', () => {
    const block = blockOnA();
    expect(reconcileAdmissionBlock(block, [A.requestId, B.requestId])).toBe(block);
  });

  it('THE DISCRIMINATOR — A’s success clears A’s notice while its twin B is still queued', () => {
    expect(clearBlockSupersededBy(blockOnA(), A.requestId)).toBeNull();
  });

  it('THE DISCRIMINATOR — B starting does NOT clear A’s notice (mutant 12)', () => {
    const block = blockOnA();
    expect(clearBlockSupersededBy(block, B.requestId)).toBe(block);
  });

  it('THE DISCRIMINATOR — removing A while twin B remains clears the notice', () => {
    expect(reconcileAdmissionBlock(blockOnA(), [B.requestId])).toBeNull();
  });

  it('removing B while A remains PRESERVES A’s notice', () => {
    const block = blockOnA();
    expect(reconcileAdmissionBlock(block, [A.requestId])).toBe(block);
  });

  it('a terminal event that removes every row clears the notice', () => {
    expect(reconcileAdmissionBlock(blockOnA(), [])).toBeNull();
  });

  it('a promotion with no id never clears anything', () => {
    const block = blockOnA();
    expect(clearBlockSupersededBy(block, null)).toBe(block);
  });

  it('queue position is irrelevant to ownership', () => {
    const block = blockOnA();
    expect(reconcileAdmissionBlock(block, [B.requestId, A.requestId])).toBe(block);
    expect(reconcileAdmissionBlock(block, [A.requestId, B.requestId])).toBe(block);
  });
});
