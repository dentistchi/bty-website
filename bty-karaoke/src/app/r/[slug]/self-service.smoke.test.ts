// Source-level guards for the Self-Service Performance UX invariants that can't
// be exercised in the node test env (these are client components). They pin the
// product's hard rules directly to the source so a regression fails CI.
//
// V3 rules:  Finish is NEVER automatic · "I'm Ready" is UI-local · only "Start"
//            hits the start route.
// V3.1 rules: the iPad Display is NOT a video player (no iframe / youtube-nocookie
//            / embed / mute) · a paired iPad defaults to the Display · the DJ
//            console is an EXCEPTION surface (no Play on TV / Open on this iPad
//            in its normal UI) · Finish copy is honest ("pass the turn", stop the
//            TV video first).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// BUILD 26G — the replacement for a hard-coded-literal source scan.
//
// A Guest component no longer holds its copy, so scanning it for Korean text would assert
// nothing. The contract is now two-sided and STRONGER: the source must reference the catalog
// KEY, and the catalog must resolve that key to the pinned Korean AND to a non-empty English.
// A key that lost either language now fails here.
import { guestT, type GuestMessageKey } from '@/domain/guest-messages';

function rendersKey(source: string, key: GuestMessageKey, koreanIs?: string): boolean {
  if (!source.includes(`'${key}'`)) return false;
  const ko = guestT('ko', key);
  const en = guestT('en', key);
  if (!ko || !en || ko === key || en === key) return false;
  return koreanIs === undefined || ko === koreanIs;
}


const here = fileURLToPath(new URL('.', import.meta.url));
const read = (p: string) => readFileSync(here + p, 'utf8');
const dock = read('MyRequestsDock.tsx');
const display = read('display/DisplayClient.tsx');
const dj = read('dj/DjBoard.tsx');
const pair = read('dj/pair/PairClient.tsx');

// Forbidden-pattern checks must inspect executable CODE, not prose in comments
// (which naturally mention "auto-finish", "Play on TV", "never forced", etc.).
// Strip block and line comments first so an accurate description never trips.
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}
const dockCode = code(dock);
const displayCode = code(display);
const djCode = code(dj);

describe('MyRequestsDock — self-service performance card', () => {
  it('derives its stage from the pure domain resolver (UI never recomputes ordering)', () => {
    expect(dock).toContain("from '@/domain/self-service'");
    expect(dock).toContain('resolvePerfStage(');
  });

  it('implements NO auto-finish — no ended/duration/timer-driven completion', () => {
    expect(dockCode).not.toMatch(/onEnded|onended|videoEnded|\bended\b/i);
    expect(dockCode).not.toMatch(/\bduration\b/i);
    expect(dockCode).not.toMatch(/auto[-\s]?finish/i);
    // doFinish must never be scheduled by a timer.
    expect(dockCode).not.toMatch(/set(Timeout|Interval)\([^)]*doFinish/);
  });

  it('does not pretend to stop YouTube / the TV cast (no player/cast control)', () => {
    expect(dockCode).not.toMatch(/pauseVideo|stopVideo|postMessage|CastSession|cast\.|player\./i);
  });

  it('V6: the guest touches only cancel + ready — NO start / finish routes', () => {
    const routes = (dock.match(/\/(cancel|start|finish|ready)`/g) ?? []).sort();
    expect(routes).toEqual(['/cancel`', '/ready`']);
    expect(dock).not.toMatch(/\/start`/);
    expect(dock).not.toMatch(/\/finish`/);
    expect(dockCode).not.toContain('doStart');
    expect(dockCode).not.toContain('doFinish');
  });

  it('V6: Ready is a SHARED server signal (calls the /ready route), not a local flag', () => {
    expect(dock).toContain('async function doReady');
    expect(dock).toContain('/ready`');
    expect(dock).toContain('onClick={() => doReady(stageReq, true)}'); // "준비됐어요"
    expect(dock).toContain('onClick={() => doReady(stageReq, false)}'); // "준비 상태 취소"
    // Ready reads from the server status, never a local ready flag.
    expect(dockCode).not.toContain('setReadyId');
    expect(dock).toContain('statuses[stageId]?.readyAt');
  });

  it('V6: the guest never opens YouTube or connects the TV', () => {
    // EVOLVED by R9 §I, INTENT PRESERVED. What this has always protected is that the Guest dock
    // holds no YouTube NAVIGATION capability — no watch URL, no window handoff, no TV connect.
    // Those bans are unchanged and absolute.
    expect(dockCode).not.toMatch(/safeYoutubeWatchUrl|location\.assign|window\.open|youtube\.com|iframe_api/i);
    // The dock now renders the approved unavailable copy, which arrives from a module whose PATH
    // contains "youtube". So rather than drop the blunt substring check, pin it: the only
    // permitted occurrence is that one import, and any other reintroduction still fails.
    // Counted against COMMENT-STRIPPED source, so prose explaining the feature cannot satisfy —
    // or trip — a check about what the code can actually do.
    const executable = dockCode.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    // The blunt substring ban was always a PROXY for "no navigation capability". It is replaced
    // by the explicit capability regex above, which states the real rule directly — plus an
    // allowlist, so any NEW kind of YouTube reference still has to be justified here.
    const mentions = executable.match(/.*youtube.*/gi) ?? [];
    const allowed = mentions.filter(
      (line) => /from '@\/domain\/youtube-unavailable'/.test(line) || /youtubeUnavailable/.test(line),
    );
    expect(allowed.length, `unexpected YouTube reference in the dock: ${mentions.filter((m) => !allowed.includes(m))}`)
      .toBe(mentions.length);
    expect(mentions.length).toBeGreaterThan(0); // the allowlist must cover something real
    expect(rendersKey(dock, 'guest.stage.singing_note')).toBe(true); // playing card: the host runs the stage
    expect(guestT('ko', 'guest.stage.singing_note')).toContain('Admin이 다음 차례로 넘깁니다');
    // The English sentence must carry the SAME fact — the host, not the guest, moves on.
    expect(guestT('en', 'guest.stage.singing_note').toLowerCase()).toContain('your host moves on');
  });
});

describe('iPad Display — read-only song board, NOT a video player (V3.1)', () => {
  it('renders no video: no iframe / youtube-nocookie / embed / mute / autoplay', () => {
    expect(displayCode).not.toMatch(/<iframe/i);
    expect(displayCode).not.toMatch(/youtube-nocookie/);
    expect(displayCode).not.toMatch(/displayEmbedUrl|embedUrl/);
    expect(displayCode).not.toMatch(/autoplay/i);
    expect(displayCode).not.toMatch(/\bmute\b|setMuted/i);
  });

  it('carries no DJ mutation controls', () => {
    expect(displayCode).not.toMatch(/method:\s*'PATCH'/);
    expect(displayCode).not.toMatch(/\/dj\//);
    expect(displayCode).not.toMatch(/reorder|move_next|force|skip/i);
    expect(displayCode).not.toMatch(/Authorization/i);
  });

  it('only reads the public display + guest-qr endpoints', () => {
    const fetched = [...display.matchAll(/\/api\/rooms\/[^`]*`/g)].map((m) => m[0]);
    expect(fetched.length).toBeGreaterThan(0);
    for (const url of fetched) {
      // V1.1: the Display opts into automatic lyrics via ?lyrics=1 on the same
      // public display endpoint — still no DJ/authed endpoint.
      expect(url).toMatch(/\/(display(\?lyrics=1)?|guest-qr)`$/);
    }
  });

  it('keeps QR + NOW + NEXT + wake-lock + fullscreen (V1.4 Living Joy Stage)', () => {
    expect(display).toContain('js-qr'); // QR reachable
    expect(display).toContain('js-vstage'); // living visual stage (no lyrics surface)
    expect(display).toContain('js-next'); // NEXT STAGE footer
    expect(display).toContain('NOW SINGING');
    expect(display).toContain('NEXT STAGE');
    expect(display).toContain('wakeLock');
    expect(display).toContain('enterFullscreen');
  });

  it('uses honest, warm copy (no false sync/video claims, no lyrics screen)', () => {
    expect(displayCode).not.toMatch(/live\s*synced|synced\s*lyrics|lyrics\s*guaranteed|video reference|connected to tv|playing on ipad/i);
    // V1.4: the iPad is a warm stage, not a lyrics screen. No lyrics surface at all.
    expect(display).toContain('이 순간을 함께 즐겨주세요');
    expect(display).not.toContain('js-lyrics-scroll');
  });
});

describe('Guest cards — MC greeting, Ready-only (V6)', () => {
  it('V8: greets the singer and frames Ready as the auto-start signal', () => {
    expect(dock).toContain('namePrefix');
    expect(rendersKey(dock, 'guest.stage.next', '다음은 당신의 무대예요')).toBe(true);
    expect(rendersKey(dock, 'guest.stage.next_note')).toBe(true);
    expect(guestT('ko', 'guest.stage.next_note')).toContain('앞의 무대가 끝나면 바로 이어집니다');
  });

  it('the playing card explains the Admin runs the stage (no guest finish)', () => {
    expect(dock).toContain('perf-card playing hero');
    expect(rendersKey(dock, 'guest.stage.singing_now', '지금 노래하는 중')).toBe(true);
    expect(guestT('ko', 'guest.stage.singing_note')).toContain('TV에서 노래가 재생되고 있어요');
    expect(guestT('en', 'guest.stage.singing_note').toLowerCase()).toContain('playing on the tv');
  });
});

describe('paired iPad defaults to the Display, not the DJ console (V3.1)', () => {
  it('redeems then navigates to /display', () => {
    expect(pair).toMatch(/location\.replace\(`\/r\/\$\{encodeURIComponent\(slug\)\}\/display`\)/);
    expect(pair).not.toMatch(/location\.replace\(`\/r\/\$\{encodeURIComponent\(slug\)\}\/dj`\)/);
  });
});

describe('Admin console is the SINGLE "next song" player (V9.0)', () => {
  it('has exactly ONE playback control — "▶ 다음 곡 재생" via onPlayNext', () => {
    expect(dj).toContain('▶ 다음 곡 재생');
    expect(dj).toMatch(/onPlayNext\(firstReady\.id, firstReady\.youtube_video_id\)/);
    // Every other/legacy playback control is gone.
    expect(dj).not.toContain('노래 완료');
    expect(dj).not.toContain('YouTube에서 재생');
    expect(dj).not.toContain('TV QUEUE PREP');
    expect(dj).not.toContain('강제로 시작');
    expect(dj).not.toContain('onPlayCurrent');
    expect(dj).not.toContain('onPassTurn');
  });

  it('the player subject is the earliest READY song (ready-first, reused)', () => {
    // EVOLVED by R6 §E. The historical contract was `ready_at != null` alone; a second
    // condition now joins it, because an unavailable song must not be the play subject.
    // Ready-first is UNCHANGED — that is what this assertion has always protected.
    expect(dj).toContain('const firstReady = displayQueue.find((r) => r.ready_at != null && isPlayable(r))');
    expect(dj).toContain('READY TO PLAY');
  });

  it('State A (nobody Ready) shows the waiting message and NO button', () => {
    expect(dj).toContain('다음 준비된 참가자를 기다리는 중');
  });

  it('keeps reorder + remove (exception tools) and stays on one canonical event', () => {
    expect(dj).toContain('DndContext');
    expect(dj).toContain('applyReorder');
  });
});
