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
    expect(dockCode).not.toMatch(/safeYoutubeWatchUrl|location\.assign|youtube/i);
    expect(dock).toContain('Admin이 다음 차례로 넘깁니다'); // playing card: Admin runs the stage
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
    expect(dock).toContain('다음은 당신의 무대예요');
    expect(dock).toContain('앞의 무대가 끝나면 바로 이어집니다');
  });

  it('the playing card explains the Admin runs the stage (no guest finish)', () => {
    expect(dock).toContain('perf-card playing hero');
    expect(dock).toContain('지금 노래하는 중');
    expect(dock).toContain('TV에서 노래가 재생되고 있어요');
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
    expect(dj).toContain('const firstReady = displayQueue.find((r) => r.ready_at != null)');
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
