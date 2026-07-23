// V8.1 SINGLE READY PLAYER — wiring guards. Pins the lifecycle end to end at the
// source level (behaviour is covered by the mocked-DB + pure tests): ready-first
// promotion, the idempotent ensure-playing route with PRECISE Korean errors (no
// generic "Could not start"), Admin self-heal reconciliation on every poll, the ONE
// player surface (TV QUEUE PREP removed), and the play-before-navigate order that
// keeps Display / Personal Player in sync regardless of the YouTube handoff.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const rooms = read('../../../../lib/rooms.server.ts');
const startRoute = read('../../../api/rooms/[slug]/dj/start/route.ts');
const queueRoute = read('../../../api/rooms/[slug]/dj/queue/route.ts');
const patchRoute = read('../../../api/rooms/[slug]/requests/[id]/route.ts');
const readyRoute = read('../../../api/rooms/[slug]/requests/[id]/ready/route.ts');
const djBoard = read('./DjBoard.tsx');
const djConsole = read('./DjConsole.tsx');

describe('V8.1 server — ready-first promotion + idempotent one-playing', () => {
  it('promoteNextReady delegates to the pure resolveStageDecision (ready-first, skip unready)', () => {
    const p = rooms.slice(rooms.indexOf('export async function promoteNextReady'));
    expect(p.slice(0, 900)).toContain('resolveStageDecision(active)');
    expect(p.slice(0, 900)).toContain("case 'promote'");
  });

  it('promoteRequestToPlaying delegates the atomic flip + one-playing guarantee to the begin_song RPC', () => {
    const f = rooms.slice(rooms.indexOf('async function promoteRequestToPlaying'), rooms.indexOf('async function promoteRequestToPlaying') + 400);
    // B1 metering: the waiting→playing flip + usage segment are now one atomic RPC.
    expect(f).toContain("beginSong(roomId, requestId, 'promote')");
    // The 23505 / one-playing / already_playing handling moved INTO the RPC — no app-level
    // status='playing' update remains in this function.
    expect(f).not.toContain("status: 'playing'");
    // already_playing is still surfaced to callers via the outcome mapping.
    expect(rooms).toContain("case 'already_playing':");
  });

  it('ensurePlaying is idempotent (already_active) and reports a precise conflict', () => {
    const e = rooms.slice(rooms.indexOf('export async function ensurePlaying'), rooms.indexOf('export async function ensurePlaying') + 1400);
    expect(e).toContain("outcome: 'already_active'");
    expect(e).toContain("outcome: 'conflict'");
    expect(e).toMatch(/playing\.id === requestId/); // same song → success, not a false failure
  });

  it('V1.1 manual-first: the idle self-heal (reconcileStage) is GONE — no idle auto-promotion', () => {
    // The reconcileStage seam existed only to auto-promote the first Ready song on a
    // poll. Manual-first removes idle auto-promotion, so the function is gone and no
    // route calls it. promoteNextReady survives ONLY for the finish→next continuation.
    expect(rooms).not.toContain('reconcileStage');
    expect(rooms).toContain('export async function promoteNextReady');
  });
});

describe('V8.1 routes — ensure-playing, precise errors, self-heal', () => {
  it('/dj/start uses ensurePlaying and NEVER returns a generic "Could not start"', () => {
    expect(startRoute).toContain('ensurePlaying');
    expect(strip(startRoute)).not.toContain('Could not start');
    // started + already_active are BOTH success (ok:true).
    expect(startRoute).toMatch(/case 'started':/);
    expect(startRoute).toMatch(/case 'already_active':/);
    // Precise, user-facing Korean reasons for the real failure modes.
    expect(startRoute).toContain('다른 곡이 현재 재생 중입니다.');
    expect(startRoute).toContain('이 신청곡을 찾을 수 없습니다.');
    expect(startRoute).toContain('재생 상태를 변경하지 못했습니다.');
    expect(startRoute).toContain('이 이벤트가 종료되었습니다.');
  });

  it('V1.1: /dj/queue is READ-ONLY — it never reconciles or promotes on a read', () => {
    // A poll (incl. the first load on launch) must not create a playing row, so the
    // first song is never already playing before the operator taps Start.
    expect(queueRoute).not.toContain('reconcileStage');
    expect(strip(queueRoute)).not.toMatch(/promoteNextReady|ensurePlaying|setRequestReady/);
  });

  it('a complete/skip of the PLAYING song auto-promotes the next Ready (continuation seam KEPT)', () => {
    expect(patchRoute).toContain('promoteNextReady');
    expect(patchRoute).toMatch(/action === 'complete' \|\| action === 'skip'/);
    expect(patchRoute).toMatch(/result\.from === 'playing'/);
  });

  it('V1.1: the guest Ready route sets the signal ONLY — it never auto-starts a song', () => {
    // Ready is no longer a "go" signal; starting the first song is an explicit operator
    // action. autoStarted is pinned false for client compatibility.
    expect(strip(readyRoute)).not.toContain('promoteNextReady');
    expect(readyRoute).toContain('autoStarted: false');
  });
});

describe('V8.1 Admin UI — ONE player surface, TV QUEUE PREP gone', () => {
  it('has NO TV QUEUE PREP anywhere (heading, controls, queued-signal wiring)', () => {
    for (const s of ['TV QUEUE PREP', 'onSetQueued', 'queuePrepLabel', 'preparedOrderDrifted', '대기열에 추가했어요', 'tv-queue-prep']) {
      expect(djBoard).not.toContain(s);
    }
  });

  it('V9.0: READY TO PLAY has exactly ONE button — ▶ 다음 곡 재생 → onPlayNext', () => {
    expect(djBoard).toContain('READY TO PLAY');
    expect(djBoard).toContain('▶ 다음 곡 재생');
    expect(djBoard).toMatch(/onPlayNext\(firstReady\.id, firstReady\.youtube_video_id\)/);
    // No completion button, no YouTube-labelled button, no legacy start controls.
    expect(djBoard).not.toContain('노래 완료');
    expect(djBoard).not.toContain('YouTube에서 재생');
    expect(djBoard).not.toContain('강제로 시작');
    expect(djBoard).not.toContain('지금 시작');
    expect(djBoard).not.toContain('onStartFirst');
    expect(djBoard).not.toContain('onPlayCurrent');
    expect(djBoard).not.toContain('onPassTurn');
  });

  it('the player subject is the earliest READY song (ready-first, reused)', () => {
    expect(djBoard).toContain('const firstReady = displayQueue.find((r) => r.ready_at != null)');
  });

  it('State A (nobody Ready) shows the waiting message and NO button', () => {
    expect(djBoard).toContain('다음 준비된 참가자를 기다리는 중');
  });
});

describe('V9.0 one-tap play — every transition, then navigate last', () => {
  it('playNext completes-current-or-starts-first, revalidates, THEN navigates (no fire-and-forget)', () => {
    const fn = djConsole.slice(djConsole.indexOf('async function playNext'), djConsole.indexOf('async function reorder'));
    // Both branches await a server mutation and loadQueue BEFORE navigating the SEPARATE
    // YouTube tab (Gate A fix — the Admin tab is never navigated away).
    const navIdx = fn.indexOf('ytWin.location.replace(url)');
    const loadIdx = fn.indexOf('await loadQueue(cred)');
    expect(loadIdx).toBeGreaterThan(-1);
    expect(navIdx).toBeGreaterThan(loadIdx); // secondary-tab navigation is LAST
    // Admin tab is NEVER replaced.
    expect(fn).not.toContain('window.location.assign');
    // A song is playing → pass-turn (complete + promote next). No current → start.
    expect(fn).toContain('/dj/pass-turn');
    expect(fn).toContain('/dj/start');
    expect(fn).toMatch(/find\(\(r\) => r\.status === 'playing'\)/);
    // Only navigate when the next singer is actually promoted onto the stage.
    expect(fn).toMatch(/reason !== 'promoted'/);
    // Precise server reason on failure — never a generic error.
    expect(fn).toContain("body?.error ?? '재생 상태를 변경하지 못했습니다.'");
  });

  it('does not claim verified external YouTube playback (honest copy)', () => {
    expect(strip(djBoard)).not.toMatch(/재생\s*확인|재생\s*중임을\s*확인|verified.*play/i);
  });

  it('the console no longer wires any removed prep/start/complete/lyrics handlers', () => {
    for (const s of ['onSetQueued', 'onStartFirst', 'onPlayCurrent', 'onPassTurn', 'onSetLyrics', 'setQueued', 'startFirst', 'playCurrentRequest', 'passTurn', 'setLyrics', 'reopenOnTv', 'playOnTv']) {
      expect(djConsole).not.toContain(s);
    }
  });
});
