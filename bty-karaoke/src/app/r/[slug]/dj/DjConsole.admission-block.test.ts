// BUILD 21 — the web DJ console's admission-block identity contract.
//
// No DjConsole test file existed, so this one is deliberately narrow: it covers ONLY the pure
// reconciler that decides whether a fail-closed block still refers to something real.
//
// ADDENDUM §8 — the same-song repeat identity test. An 18B repeat means two canonical requests can
// carry the SAME youtube_video_id, title, and artist. Identity must therefore be the requestId and
// nothing else. Branch 3 below (remove A while its twin B remains) is the ONLY branch that can
// tell a correct implementation from a videoId/title/position-keyed one, which is why the four
// branches fork from one arranged state instead of running in sequence: chaining "remove B, then
// remove A" ends with an empty queue, where even a wrong reconciler clears the notice and passes.

import { describe, it, expect } from 'vitest';
import { reconcileAdmissionBlock, type AdmissionBlock } from './DjConsole';

// A and B are a legitimate same-song repeat: different requestId, identical song identity.
const A = { requestId: 'req-A', youtubeVideoId: 'vid-SAME', title: '같은 노래', artist: '같은 가수' };
const B = { requestId: 'req-B', youtubeVideoId: 'vid-SAME', title: '같은 노래', artist: '같은 가수' };

/** The arranged state: queue [A, B], notice stored against A. */
function arrange(): AdmissionBlock {
  return { requestId: A.requestId, reason: 'too_long', message: '이 영상은 너무 길어요 (15분을 넘습니다).' };
}

describe('BUILD 21 §8 — the notice is keyed by canonical requestId, never by song identity', () => {
  it('is stored against the request that was actually blocked', () => {
    expect(arrange().requestId).toBe('req-A');
  });

  it('Branch 1 — a successful poll containing BOTH keeps the notice, unchanged and still keyed to A', () => {
    const block = arrange();
    const next = reconcileAdmissionBlock(block, [A.requestId, B.requestId]);
    expect(next).not.toBeNull();
    expect(next!.requestId).toBe('req-A');
    expect(next!.message).toBe(block.message);
    // Same object identity → a 4s poll causes no re-render.
    expect(next).toBe(block);
  });

  it('Branch 2 — removing B (A remains) PRESERVES A’s notice', () => {
    const block = arrange();
    expect(reconcileAdmissionBlock(block, [A.requestId])).toBe(block);
  });

  // THE DISCRIMINATING BRANCH. `vid-SAME` is still in the queue via B, so a reconciler keyed on
  // videoId / title / position keeps the notice here and fails. Do not merge or reorder this.
  it('Branch 3 — removing A while its same-song twin B REMAINS clears the notice', () => {
    expect(reconcileAdmissionBlock(arrange(), [B.requestId])).toBeNull();
  });

  it('Branch 4 — removing both clears the notice', () => {
    expect(reconcileAdmissionBlock(arrange(), [])).toBeNull();
  });

  it('a null block stays null regardless of the queue', () => {
    expect(reconcileAdmissionBlock(null, [A.requestId, B.requestId])).toBeNull();
  });

  it('queue POSITION is irrelevant — A first or A last, the notice survives either way', () => {
    const block = arrange();
    expect(reconcileAdmissionBlock(block, [B.requestId, A.requestId])).toBe(block);
    expect(reconcileAdmissionBlock(block, [A.requestId, B.requestId])).toBe(block);
  });
});
