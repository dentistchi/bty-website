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

  it('exposes exactly the three guest mutation routes (cancel / start / finish)', () => {
    const routes = (dock.match(/\/(cancel|start|finish)`/g) ?? []).sort();
    expect(routes).toEqual(['/cancel`', '/finish`', '/start`']);
    expect((dock.match(/\/finish`/g) ?? []).length).toBe(1);
    expect((dock.match(/\/start`/g) ?? []).length).toBe(1);
  });

  it('"I’m Ready" is a pure local state setter (no server mutation)', () => {
    expect(dock).toContain('onClick={() => setReadyId(stageReq.requestId)}');
  });

  it('only "Start My Song" invokes the start action', () => {
    expect(dock).toContain('onClick={() => doStart(stageReq)}');
    const startCall = dock.indexOf('async function doStart');
    const startRoute = dock.indexOf('/start`');
    const finishFn = dock.indexOf('async function doFinish');
    expect(startCall).toBeGreaterThan(-1);
    expect(startRoute).toBeGreaterThan(startCall);
    expect(startRoute).toBeLessThan(finishFn);
  });

  it('gates Finish behind a 2-step inline confirmation with honest copy', () => {
    expect(dock).toContain('setFinishConfirmId(stageReq.requestId)');
    // First tap only opens the confirm; the second, honest step passes the turn.
    expect(dock).toContain('TV의 영상도 멈췄나요?');
    expect(dock).toContain('차례 넘기기');
    // The playing card tells the singer to stop the TV video themselves.
    expect(dock).toContain('YouTube에서 영상을 먼저 멈춘');
  });

  it('the Ready step sets an honest expectation about the YouTube handoff', () => {
    expect(dock).toContain('시작하면 YouTube 앱이 열립니다');
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
      expect(url).toMatch(/\/(display|guest-qr)`$/);
    }
  });

  it('renders QR / NOW SINGING / NEXT and keeps wake-lock + fullscreen', () => {
    expect(display).toContain('kd-qr');
    expect(display).toContain('kd-nowbar');
    expect(display).toContain('NOW SINGING');
    expect(display).toContain('kd-next');
    expect(display).toContain('wakeLock');
    expect(display).toContain('enterFullscreen');
  });

  it('uses honest board copy (no lyrics/sync/video-reference claims)', () => {
    expect(displayCode).not.toMatch(/live\s*synced|synced\s*lyrics|lyrics\s*guaranteed|video reference|connected to tv|playing on ipad/i);
    expect(display).toContain('영상과 가사는 TV에서 확인하세요');
  });
});

describe('paired iPad defaults to the Display, not the DJ console (V3.1)', () => {
  it('redeems then navigates to /display', () => {
    expect(pair).toMatch(/location\.replace\(`\/r\/\$\{encodeURIComponent\(slug\)\}\/display`\)/);
    expect(pair).not.toMatch(/location\.replace\(`\/r\/\$\{encodeURIComponent\(slug\)\}\/dj`\)/);
  });
});

describe('DJ console is an exception surface, not a playback surface (V3.1)', () => {
  it('has no Play on TV / Open on this iPad in its normal UI', () => {
    expect(djCode).not.toMatch(/Play on TV/i);
    expect(djCode).not.toMatch(/Open on this iPad/i);
    expect(djCode).not.toMatch(/runPlayOnTv|runOpenOnDevice|playOnTv\(|openOnThisIpad\(/);
  });

  it('shows the exception-only note', () => {
    expect(dj).toContain('정상 운영은 참가자가 각자의 휴대폰에서 진행합니다');
  });

  it('keeps reorder + force-finish (the real exception tools)', () => {
    expect(dj).toContain('DndContext');
    expect(dj).toContain('applyReorder');
    expect(dj).toContain('Force-finish');
    expect(dj).toContain('onFinish(current.id)');
  });
});
