// AUTOPILOT PLAY FLOW V8 — Ready → auto-start, Finish/Skip → next-Ready auto-start.
// "Ready is the user's intent; Start is the system's responsibility; the Admin only
// tells BTY the song is over." These lock the server-authoritative, concurrency-safe,
// Ready-only promotion seam and its wiring. (Node env → assert on the source.)

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const rooms = read('../../../../lib/rooms.server.ts');
const readyRoute = read('../../../api/rooms/[slug]/requests/[id]/ready/route.ts');
const patchRoute = read('../../../api/rooms/[slug]/requests/[id]/route.ts');
const passTurnRoute = read('../../../api/rooms/[slug]/dj/pass-turn/route.ts');
const fn = (name: string) => {
  const i = rooms.indexOf(`function ${name}`);
  return i === -1 ? '' : rooms.slice(i, i + 1400);
};

describe('V8 — promoteNextReady is the ONE authoritative promotion', () => {
  const p = fn('promoteNextReady');
  it('does nothing when a song is already playing (one-playing invariant upheld)', () => {
    expect(p).toMatch(/find\(\(r\) => r\.status === 'playing'\)/);
    expect(p).toMatch(/already_playing/);
  });
  it('only ever targets the CANONICAL FIRST waiting song (never jumps a Ready guest ahead)', () => {
    expect(p).toContain('canonicalRank'); // canonical order
    expect(p).toMatch(/const first = waiting\[0\]/);
  });
  it('is READY-ONLY (no TV-queue requirement) — the V8 gate', () => {
    expect(p).toMatch(/if \(!first\.ready_at\) return \{ outcome: 'blocked_not_ready'/);
    expect(p).not.toContain('youtube_queued_at');
  });
  it('flips via the ATOMIC advisory-locked RPC (not a client-side race)', () => {
    // Concurrency is enforced by start_karaoke_request (advisory lock + one-playing
    // partial unique index), NOT by an application-level if.
    expect(p).toContain('startOwnRequest'); // wraps rpc('start_karaoke_request')
    expect(rooms).toContain("rpc('start_karaoke_request'");
    expect(p).toMatch(/start\.outcome === 'already_playing'/); // lost-race → idempotent
  });
  it('is event-scoped (an old event\'s waiting/ready never leaks in)', () => {
    expect(p).toMatch(/listActiveRequests\(roomId, eventId\)/);
  });
});

describe('V8 — Finish and Skip share ONE advance seam', () => {
  const adv = fn('advanceAfterTerminal');
  it('advanceAfterTerminal completes/skips the current, then promotes the next Ready', () => {
    expect(adv).toMatch(/terminal === 'completed'/);
    expect(adv).toContain('finishOwnRequest'); // complete
    expect(adv).toMatch(/setRequestStatus\(roomId, currentRequestId, 'skip'\)/); // skip
    expect(adv).toContain('promoteNextReady'); // same promotion for both
  });
  it('passTurnAndPromote ("노래 끝") delegates to advanceAfterTerminal (no divergent code)', () => {
    expect(fn('passTurnAndPromote')).toContain('advanceAfterTerminal');
  });
});

describe('V8 — route wiring (server-authoritative)', () => {
  it('the Ready route auto-starts via promoteNextReady on ready:true only', () => {
    expect(readyRoute).toContain('promoteNextReady');
    expect(readyRoute).toMatch(/if \(ready\) \{/); // never auto-starts on unready
    expect(readyRoute).toMatch(/autoStarted = promote\.outcome === 'started' && promote\.request\?\.id === id/);
  });
  it('the Ready route is owner + event gated (guests can only ready their own)', () => {
    expect(readyRoute).toContain('verifyOwnerCapability');
    expect(readyRoute).toContain('resolveEventAccess');
  });
  it('a Skip/Finish of the PLAYING song promotes the next Ready (same seam)', () => {
    expect(patchRoute).toContain('promoteNextReady');
    expect(patchRoute).toMatch(/action === 'complete' \|\| action === 'skip'/);
    expect(patchRoute).toMatch(/result\.from === 'playing'/); // only when it WAS playing
  });
  it('pass-turn ("노래 끝") is Admin/DJ authed + event-gated', () => {
    expect(passTurnRoute).toContain('authorizeDj');
    expect(passTurnRoute).toContain('resolveEventAccess');
  });
});
