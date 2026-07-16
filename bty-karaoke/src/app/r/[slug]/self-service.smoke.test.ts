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

  it('renders QR / NOW SINGING / NEXT and keeps wake-lock + fullscreen', () => {
    expect(display).toContain('kd-qr');
    expect(display).toContain('kd-nowbar');
    expect(display).toContain('NOW SINGING');
    expect(display).toContain('kd-next');
    expect(display).toContain('wakeLock');
    expect(display).toContain('enterFullscreen');
  });

  it('uses honest board copy (no false sync/video claims)', () => {
    expect(displayCode).not.toMatch(/live\s*synced|synced\s*lyrics|lyrics\s*guaranteed|video reference|connected to tv|playing on ipad/i);
    // Lyrics V1: the board shows the song's words when available and an HONEST
    // fallback otherwise (never a guessed match); video still lives on the TV.
    expect(display).toContain('가사가 아직 없어요');
    expect(display).toContain('영상은 TV에서 확인하세요');
  });
});

describe('Display polish V4 — hero, LIVE panel, empty stage, data-keyed motion', () => {
  it('renders the hero ladder in order: singer → song → badge → artist', () => {
    const singer = display.indexOf('kd-now-singer');
    const song = display.indexOf('kd-now-song');
    const badge = display.indexOf('kd-now-badge');
    const artist = display.indexOf('kd-now-artist');
    expect(singer).toBeGreaterThan(-1);
    expect(singer).toBeLessThan(song);
    expect(song).toBeLessThan(badge);
    expect(badge).toBeLessThan(artist);
  });

  it('shows an information-only LIVE panel from the display stats', () => {
    expect(display).toContain('kd-live');
    expect(display).toContain('state?.stats');
    expect(display).toContain('stats.singers');
    expect(display).toContain('stats.completed');
    // Information only — the panel is not a button / has no click handler.
    expect(display).not.toMatch(/kd-live[^]{0,400}onClick/);
  });

  it('animates ONLY on real data change (keyed by id/value, never every poll)', () => {
    // NOW fades keyed by the singing request id; NEXT slides keyed by next id;
    // each LIVE number pops keyed by its value. Same data → same key → no re-anim.
    expect(display).toMatch(/kd-fade[^]{0,60}key=\{playing\.id\}|key=\{playing\.id\}[^]{0,60}kd-fade/);
    expect(display).toMatch(/kd-slide[^]{0,60}key=\{next\.id\}|key=\{next\.id\}[^]{0,60}kd-slide/);
    expect(display).toMatch(/kd-live-num[^]*key=\{value\}|key=\{value\}[^]*kd-live-num/);
  });

  it('has a welcoming empty stage that points at the ONE top-right QR (V7.1: no central QR)', () => {
    expect(display).toContain('오늘의 노래');
    expect(display).toContain('아직 신청된 곡이 없습니다');
    expect(display).toContain('오른쪽 위 QR을 스캔해 첫 곡을 신청하세요');
    // The true-empty stage no longer renders a second, central QR.
    expect(display).not.toContain('kd-empty-qr');
  });
});

describe('Guest cards — MC greeting, Ready-only (V6)', () => {
  it('greets the singer by name and asks them to Ready (Admin starts)', () => {
    expect(dock).toContain('namePrefix');
    expect(dock).toContain('준비되셨나요?');
    expect(dock).toContain('준비되면 Admin이 TV에서 노래를 시작합니다');
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

describe('Admin console is the SINGLE Player (V6)', () => {
  it('the Player Hero starts the FIRST song (atomic) then hands off to YouTube (V8)', () => {
    expect(dj).toContain('onStartFirst');
    expect(dj).toContain('▶ 첫 곡 시작');
    expect(dj).toContain('onReopen');
  });

  it('pass-turn is a 2-step auto-promotion on the playing song (V8)', () => {
    expect(dj).toContain('차례 넘기기');
    expect(dj).toContain('TV에서 다음 곡이 시작됐나요?');
    expect(dj).toContain('onPassTurn(current.id)');
  });

  it('shows the guest Ready signal from the shared server field', () => {
    expect(dj).toContain('playTarget.ready_at');
    expect(dj).toContain('READY TO PLAY');
  });

  it('keeps reorder + remove (exception tools) and stays on one canonical event', () => {
    expect(dj).toContain('DndContext');
    expect(dj).toContain('applyReorder');
  });
});
