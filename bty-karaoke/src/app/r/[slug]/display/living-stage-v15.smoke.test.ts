// LIVING STAGE V1.5 — emotional stage direction + celebration moments. The space
// reacts to the singer's moment (curtain-up, ambient bokeh, completion celebration
// with bounded sparks + optional soft applause, joy pulse on a new request). Node
// environment → assert on the client source + globals.css + the audio module.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const display = readFileSync(fileURLToPath(new URL('./DisplayClient.tsx', import.meta.url)), 'utf8');
const sound = readFileSync(fileURLToPath(new URL('./stage-sound.ts', import.meta.url)), 'utf8');
const css = readFileSync(fileURLToPath(new URL('../../../globals.css', import.meta.url)), 'utf8');
const displayCode = display.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const block = (sel: string) => {
  const i = css.indexOf(sel);
  return i === -1 ? '' : css.slice(i, css.indexOf('}', i) + 1);
};

describe('V1.5 — Stage Opening (Curtain Up), once per song', () => {
  it('runs a one-shot curtain + bloom keyed by the playing.id (not every poll)', () => {
    expect(display).toMatch(/js-curtain" key=\{`cur-\$\{playing\.id\}`\}/);
    expect(display).toMatch(/js-bloom" key=\{`bloom-\$\{playing\.id\}`\}/);
  });
  it('the opening settles quickly (≤ ~1.2s) and does not block input', () => {
    expect(block('.js-curtain {')).toMatch(/animation: js-curtain 0\.9s/);
    expect(block('.js-curtain {')).toContain('pointer-events: none');
  });
});

describe('V1.5 — Ambient living stage (CSS-only, slow, no strobe)', () => {
  it('uses slow drift + edge bokeh, no canvas/WebGL, no fast/strobe', () => {
    expect(display).toContain('js-bokeh');
    expect(block('.js-bokeh span {')).toMatch(/animation: js-bokeh-float 24s/); // 18–28s slow
    expect(css).not.toMatch(/WebGLRenderingContext|getContext\(['"]webgl/);
    expect(display).not.toMatch(/requestAnimationFrame|<canvas/);
  });
  it('audience energy is suggested by warm bokeh, never drawn figures', () => {
    expect(display).not.toMatch(/silhouette|stickman|사람\s*그림|crowd-figure/i);
  });
});

describe('V1.5 — Completion celebration (tiers, bounded sparks, non-blocking)', () => {
  it('preserves the finished singer name + song and never blocks the next song', () => {
    expect(display).toMatch(/name: prev\.name, song: prev\.song/);
    expect(display).toMatch(/setCelebrating\(null\), cur \? CELEBRATE_SHORT_MS : CELEBRATE_MS/);
  });
  it('a rapid new song shortens the celebration (never covers the new stage)', () => {
    expect(display).toContain('CELEBRATE_SHORT_MS');
    expect(display).toMatch(/cur \? CELEBRATE_SHORT_MS : CELEBRATE_MS/);
  });
  it('Tier 2 milestone uses ONLY existing event stats (first song / every tenth)', () => {
    expect(display).toMatch(/completed === 1 \|\| \(completed > 0 && completed % 10 === 0\)/);
    expect(displayCode).not.toMatch(/migration|new column|createColumn/i); // code only
  });
  it('sparks are BOUNDED and index-positioned (no rAF, no growing DOM)', () => {
    expect(display).toMatch(/count=\{celebrating\.tier === 2 \? 18 : 10\}/); // explicit cap
    expect(display).toMatch(/Array\.from\(\{ length: count \}/);
    expect(display).not.toMatch(/requestAnimationFrame/);
  });
  it('the light lift is warm gold and never a score/rank/judgment', () => {
    expect(block('.js-celebrate {')).toMatch(/245, 196, 81/);
    expect(displayCode).not.toMatch(/score|점수|승자|winner|rank|순위|별점|judge/i);
  });
});

describe('V1.5 — Applause sound (synthesized, default OFF, fail-safe)', () => {
  it('is Web Audio SYNTHESIS — no asset file, no external provider, no network', () => {
    expect(sound).toMatch(/AudioContext|webkitAudioContext/);
    expect(sound).toMatch(/createBuffer/); // generated, not decoded from a file
    expect(sound).not.toMatch(/fetch\(|import\(|\.mp3|\.wav|new Audio\(/);
  });
  it('defaults OFF and remembers the preference in localStorage', () => {
    expect(display).toMatch(/useState\(false\)/); // soundOn default false
    expect(display).toContain('bty-stage-sound');
    expect(display).toMatch(/getItem\(SOUND_KEY\) === '1'/);
  });
  it('the toggle tap unlocks audio (user gesture) and is labeled (not icon-only meaning)', () => {
    expect(display).toMatch(/onClick=\{toggleSound\}/);
    expect(display).toMatch(/aria-label=\{soundOn \?/); // explicit label, not just an emoji
    expect(sound).toMatch(/enable\(\).*resume/s); // unlock on enable
  });
  it('plays once per completion, and audio failure never affects the UI/queue', () => {
    expect(display).toMatch(/soundRef\.current\?\.applause\(\)/);
    expect(sound).toMatch(/if \(!sound\.enabled.*return/s); // no-op when off
    expect(sound).toMatch(/catch \{[\s\S]*?\}/); // swallow failures
  });
});

describe('V1.5 — Joy Pulse (new request), NEXT contrast, reduced motion', () => {
  it('a quiet one-shot corner note on a NEW request, guarding the initial mount', () => {
    expect(display).toContain('js-joypulse');
    expect(display).toContain('새로운 무대가 준비되었어요');
    expect(display).toMatch(/if \(prev != null && requests > prev\)/); // not on first mount
  });
  it('NEXT footer has readable contrast (a raised pill, ivory body)', () => {
    expect(block('.js-next {')).toMatch(/background: rgba/);
    expect(block('.js-next-body {')).toContain('var(--ivory)');
  });
  it('every new motion honors prefers-reduced-motion', () => {
    const rm = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(rm).toContain('.js-curtain');
    expect(rm).toContain('.js-spark');
    expect(rm).toContain('.js-bokeh span');
  });
  it('preserves polling, wake-lock, fullscreen, lyrics-off (no ?lyrics=1)', () => {
    expect(display).toContain('POLL_MS = 2000');
    expect(display).toContain('wakeLock');
    expect(display).toContain('enterFullscreen');
    expect(displayCode).not.toContain('?lyrics=1');
  });
});
