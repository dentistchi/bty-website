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

  it('promoteRequestToPlaying maps the one-playing index violation (23505) to already_playing', () => {
    const f = rooms.slice(rooms.indexOf('async function promoteRequestToPlaying'), rooms.indexOf('async function promoteRequestToPlaying') + 900);
    expect(f).toContain("=== '23505'");
    expect(f).toContain("return 'already_playing'");
    // Idempotent: the target already being the stage is success, not a failure.
    expect(f).toMatch(/status === 'playing'\) return 'ok'/);
  });

  it('ensurePlaying is idempotent (already_active) and reports a precise conflict', () => {
    const e = rooms.slice(rooms.indexOf('export async function ensurePlaying'), rooms.indexOf('export async function ensurePlaying') + 1400);
    expect(e).toContain("outcome: 'already_active'");
    expect(e).toContain("outcome: 'conflict'");
    expect(e).toMatch(/playing\.id === requestId/); // same song → success, not a false failure
  });

  it('reconcileStage is the idempotent self-heal (no interrupt) = promoteNextReady', () => {
    expect(rooms).toContain('export async function reconcileStage');
    const r = rooms.slice(rooms.indexOf('export async function reconcileStage'));
    expect(r.slice(0, 300)).toContain('return promoteNextReady(roomId, eventId)');
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

  it('/dj/queue self-heals: it reconciles the stage before every read (initial + idle poll)', () => {
    expect(queueRoute).toContain('reconcileStage');
    expect(queueRoute).toMatch(/reconcileStage\(auth\.room\.id, event\?\.id \?\? null\)/);
  });

  it('a complete/skip of the PLAYING song auto-promotes the next Ready (shared seam)', () => {
    expect(patchRoute).toContain('promoteNextReady');
    expect(patchRoute).toMatch(/action === 'complete' \|\| action === 'skip'/);
    expect(patchRoute).toMatch(/result\.from === 'playing'/);
  });

  it('the guest Ready route drives promotion (Ready is the go signal)', () => {
    expect(readyRoute).toContain('promoteNextReady');
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
    const fn = djConsole.slice(djConsole.indexOf('async function playNext'), djConsole.indexOf('async function playNext') + 2000);
    // Both branches await a server mutation and loadQueue BEFORE location.assign.
    const assignIdx = fn.indexOf('location.assign');
    const loadIdx = fn.indexOf('await loadQueue(cred)');
    expect(loadIdx).toBeGreaterThan(-1);
    expect(assignIdx).toBeGreaterThan(loadIdx); // navigation is LAST
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
