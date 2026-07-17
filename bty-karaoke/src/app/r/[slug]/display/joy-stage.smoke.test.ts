// LIVING JOY STAGE V1.4 — served-code + CSS invariants. The iPad Display is an
// emotional stage, NOT a lyrics screen: no lyrics surface, a full-bleed artwork
// ambient, singer-first text, a brief completion celebration. Node environment, so
// we assert on the client source + globals.css (as the repo's other UI smoke tests).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const display = readFileSync(fileURLToPath(new URL('./DisplayClient.tsx', import.meta.url)), 'utf8');
const displayCode = display.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // code only
const css = readFileSync(fileURLToPath(new URL('../../../globals.css', import.meta.url)), 'utf8');
const resolver = readFileSync(fileURLToPath(new URL('../../../../lib/lyrics-resolver.server.ts', import.meta.url)), 'utf8');
const block = (sel: string) => {
  const i = css.indexOf(sel);
  return i === -1 ? '' : css.slice(i, css.indexOf('}', i) + 1);
};

describe('Joy Stage V1.4 — no lyrics surface; TV shows lyrics', () => {
  it('does NOT render a lyrics surface on the default Display', () => {
    expect(display).not.toContain('js-lyrics-scroll');
    expect(display).not.toContain('js-lyrics-body');
    expect(display).not.toMatch(/playing\.lyrics/); // Display no longer reads lyrics
    expect(display).not.toContain('LyricsStage');
  });

  it('the Display no longer triggers provider resolution (no ?lyrics=1)', () => {
    expect(displayCode).not.toContain('?lyrics=1'); // code only (comments may mention it)
    expect(display).toContain('/display`'); // plain display endpoint
  });

  it('automatic-lyrics INFRASTRUCTURE remains intact (default OFF, not deleted)', () => {
    // The resolver, routes, and manual override stay; the auto path is gated off.
    expect(resolver).toContain('export async function scheduleLyricsResolve');
    expect(resolver).toContain('export async function resolvePlayingLyrics');
    expect(resolver).toMatch(/if \(!autoLyricsEnabled\(\)\) return/); // no-op when off
    expect(resolver).toMatch(/optionalEnv\('KARAOKE_AUTO_LYRICS'\) === '1'/); // re-enable flag
  });
});

describe('Joy Stage V1.4 — singer-first playing stage', () => {
  it('leads with the singer, then normalized song + artist — never raw YouTube metadata', () => {
    expect(display).toContain('NOW SINGING');
    expect(display).toMatch(/\{playing\.guestName\}의 무대/);
    expect(display).toMatch(/\{playing\.songTitle\}/);
    expect(display).toMatch(/\{playing\.songArtist\}/);
    expect(display).not.toMatch(/\{playing\.title\}/); // raw title never shown
    expect(display).not.toMatch(/badgeForKind|videoKind|vk-badge/); // no MR/karaoke badge
  });

  it('shows a warm human moment message (not an operational card)', () => {
    expect(display).toContain('이 순간을 함께 즐겨주세요');
  });

  it('reveals singer/song in brief (<1.2s) staged motion, keyed per song', () => {
    expect(display).toMatch(/js-vstage-content" key=\{`c-\$\{playing\.id\}`\}/);
    expect(block('.js-now-eyebrow {')).toMatch(/animation: js-rise 0\.5s 0s/);
    // .js-moment reveals last at 0.52s (+0.6s ≈ 1.12s < 1.2s). (Match the rule, not
    // the reduced-motion selector list that also names .js-moment.)
    expect(css).toMatch(/\.js-moment \{[^}]*js-rise 0\.6s 0\.52s/);
  });
});

describe('Joy Stage V1.4 — living visual stage (artwork as ambient, not a card)', () => {
  it('uses a full-bleed blurred artwork ambient + veil + one warm bloom', () => {
    expect(display).toContain('js-vstage-ambient');
    expect(display).toContain('js-vstage-veil');
    expect(display).toContain('js-bloom');
    expect(block('.js-vstage-ambient {')).toMatch(/filter: blur/);
    expect(block('.js-vstage-ambient {')).toContain('js-kenburns'); // slow living drift
  });

  it('derives artwork from the video id via CSS background (no broken-image icon)', () => {
    expect(display).toMatch(/i\.ytimg\.com\/vi\/\$\{encodeURIComponent\(r\.videoId\)\}\/hqdefault\.jpg/);
    expect(display).toMatch(/backgroundImage: `url\("\$\{art\}"\)`/);
    // A missing thumbnail degrades to an intentional gradient, never a black screen.
    expect(display).toMatch(/js-vstage-ambient\$\{art \? '' : ' no-art'\}/);
    expect(block('.js-vstage-ambient.no-art,')).toMatch(/gradient/);
  });

  it('a central medallion is a soft, borderless cinematic crop (feathered, haloed)', () => {
    expect(display).toContain('js-art-medallion');
    const med = block('.js-art-medallion {');
    expect(med).toMatch(/mask-image: radial-gradient/); // feathered edges, no hard border
    expect(med).toMatch(/box-shadow/); // warm halo
  });
});

describe('Joy Stage V1.4 — NEXT, QR, completion, waiting', () => {
  it('NEXT STAGE is a compact warm invitation (footer)', () => {
    expect(display).toContain('NEXT STAGE');
    expect(display).toMatch(/잠시 후, <strong>\{next\.guestName\}<\/strong>의 무대가 시작됩니다/);
    expect(block('.js-next {')).toContain('flex: 0 0 auto');
  });

  it('QR is compact while singing, a prominent central invitation while waiting', () => {
    expect(display).toMatch(/js-qr\$\{playing \? ' compact' : ''\}/); // compact when singing
    expect(display).toMatch(/mode !== 'waiting'/); // top-right QR suppressed while waiting
    expect(display).toContain('js-invite-qr'); // prominent central invitation
    expect(display).toContain('카메라로 스캔해 노래를 신청하세요');
  });

  it('waiting is a warm invitation, not an empty dashboard', () => {
    expect(display).toContain('오늘의 무대가 곧 시작됩니다');
    expect(display).toContain('함께 부르고 싶은 노래를 신청해 주세요');
  });

  it('completion briefly celebrates the singer with a warm light lift — no scoring', () => {
    expect(display).toMatch(/\{celebrating\.name\}의 무대였습니다/);
    expect(display).toMatch(/setCelebrating\(null\)/); // auto-dismiss, non-blocking
    expect(display).toMatch(/const ms = cur \? CELEBRATE_SHORT_MS/); // shortens on a rapid new song
    expect(display).toMatch(/cur\.id === prev\.id/); // reliable via playing.id transition (early-return guard)
    // Deterministic rotation of approved lines — never AI-generated, never a score.
    expect(display).toContain('CELEBRATE_LINES');
    expect(displayCode).not.toMatch(/score|점수|승자|winner|rank|순위|별점|judge/i); // code only
    expect(block('.js-celebrate {')).toMatch(/196, 81/); // warm gold light lift
  });
});

describe('Joy Stage V1.4 — motion, responsiveness, preserved behavior', () => {
  it('slow living motion, and every animation honors reduced-motion', () => {
    expect(block('.js-aura {')).toMatch(/animation: js-breathe 10s/);
    const rm = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce) {\n  .js-aura,'));
    expect(rm).toContain('.js-vstage-ambient');
    expect(rm).toContain('.js-bloom');
  });

  it('handles 100dvh + safe areas, iPad portrait, and phone fallback', () => {
    expect(block('.js {')).toContain('100dvh');
    expect(block('.js {')).toContain('safe-t');
    expect(css).toContain('@media (max-width: 640px)');
    expect(css).toContain('@media (orientation: portrait)');
  });

  it('a song change resets the visual scene atomically; a same-song poll does not', () => {
    // Keyed by the request id → new song remounts the scene, a 2s poll keeps it.
    expect(display).toMatch(/js-vstage-ambient[^]{0,80}key=\{playing\.id\}/);
    expect(display).not.toMatch(/scrollTo\(|scrollTop\s*=/);
  });

  it('preserves 2s polling, stale-song protection, wake-lock, fullscreen, queue reads', () => {
    expect(display).toContain('POLL_MS = 2000');
    expect(display).toMatch(/if \(n !== seq\.current\) return/);
    expect(display).toContain('wakeLock');
    expect(display).toContain('enterFullscreen');
  });
});
