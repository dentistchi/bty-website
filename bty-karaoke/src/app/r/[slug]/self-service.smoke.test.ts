// Source-level guards for the Self-Service Performance UX V3 invariants that
// can't be exercised in the node test env (these are client components). They
// pin the product's hard rules directly to the source so a regression fails CI:
//   - Finish is NEVER automatic (no ended/duration/timer-driven completion).
//   - "I'm Ready" is UI-local (it must not call any mutation route).
//   - Only "Start My Song" hits the start route.
//   - The iPad Display carries no DJ mutation controls and renders QR/NOW/NEXT
//     independently of the (best-effort) embed.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const dock = readFileSync(here + 'MyRequestsDock.tsx', 'utf8');
const display = readFileSync(
  here + 'display/DisplayClient.tsx',
  'utf8',
);

// Forbidden-pattern checks must inspect executable CODE, not prose in comments
// (which naturally mention "auto-finish", "never forced", etc.). Strip block and
// line comments first so an accurate description never trips a guard.
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}
const dockCode = code(dock);
const displayCode = code(display);

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

  it('exposes exactly the three guest mutation routes (cancel / start / finish)', () => {
    const routes = (dock.match(/\/(cancel|start|finish)`/g) ?? []).sort();
    expect(routes).toEqual(['/cancel`', '/finish`', '/start`']);
    // Exactly one call site each — no hidden extra finish path.
    expect((dock.match(/\/finish`/g) ?? []).length).toBe(1);
    expect((dock.match(/\/start`/g) ?? []).length).toBe(1);
  });

  it('"I’m Ready" is a pure local state setter (no server mutation)', () => {
    expect(dock).toContain('onClick={() => setReadyId(stageReq.requestId)}');
  });

  it('only "Start My Song" invokes the start action', () => {
    expect(dock).toContain('onClick={() => doStart(stageReq)}');
    // The start route is fetched only inside doStart.
    const startCall = dock.indexOf('async function doStart');
    const startRoute = dock.indexOf('/start`');
    const finishFn = dock.indexOf('async function doFinish');
    expect(startCall).toBeGreaterThan(-1);
    expect(startRoute).toBeGreaterThan(startCall);
    expect(startRoute).toBeLessThan(finishFn);
  });

  it('gates Finish behind a 2-step inline confirmation (no every-tap modal)', () => {
    expect(dock).toContain('setFinishConfirmId(stageReq.requestId)');
    expect(dock).toContain('이 노래를 끝낼까요?');
  });
});

describe('iPad Display — read-only board, no DJ mutations', () => {
  it('carries no DJ mutation controls', () => {
    expect(displayCode).not.toMatch(/method:\s*'PATCH'/);
    expect(displayCode).not.toMatch(/\/dj\//);
    expect(displayCode).not.toMatch(/reorder|move_next|force|skip/i);
    expect(displayCode).not.toMatch(/Authorization/i);
  });

  it('only reads the public display + guest-qr endpoints', () => {
    const fetched = [...display.matchAll(/\/api\/rooms\/[^`]*`/g)].map((m) => m[0]);
    for (const url of fetched) {
      expect(url).toMatch(/\/(display|guest-qr)`$/);
    }
  });

  it('renders QR / NOW SINGING / NEXT independently of the best-effort embed', () => {
    // The embed is guarded; QR + now-bar + next are their own elements, so a
    // blocked autoplay or bad id never blanks the board.
    expect(display).toContain('embedUrl ?');
    expect(display).toContain('kd-nowbar');
    expect(display).toContain('kd-next');
    expect(display).toContain('kd-qr');
  });
});
