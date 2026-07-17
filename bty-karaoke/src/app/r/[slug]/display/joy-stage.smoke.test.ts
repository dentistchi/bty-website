// JOY STAGE V1.3 — served-code + CSS invariants for the warm, human-first Display.
// Node environment, so we assert on the client source + globals.css (as the repo's
// other UI smoke tests do) rather than rendering the layout.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const display = readFileSync(fileURLToPath(new URL('./DisplayClient.tsx', import.meta.url)), 'utf8');
const css = readFileSync(fileURLToPath(new URL('../../../globals.css', import.meta.url)), 'utf8');
const block = (sel: string) => {
  const i = css.indexOf(sel);
  return i === -1 ? '' : css.slice(i, css.indexOf('}', i) + 1);
};

describe('Joy Stage — compact human-first NOW header', () => {
  it('leads with the singer (protagonist), then normalized song + artist — not raw YouTube metadata', () => {
    expect(display).toContain('NOW SINGING');
    expect(display).toMatch(/\{playing\.guestName\}의 무대/);
    expect(display).toMatch(/\{playing\.songTitle\}/); // NORMALIZED title
    expect(display).toMatch(/\{playing\.songArtist\}/); // NORMALIZED artist
    // Never renders the raw youtube title / channel / karaoke-badge on the Display.
    expect(display).not.toMatch(/\{playing\.title\}/);
    expect(display).not.toMatch(/badgeForKind|videoKind|vk-badge/);
  });

  it('reveals the header in staged, brief (<1.2s) motion keyed by the song', () => {
    expect(display).toMatch(/<div className="js-now" key=\{playing\.id\}>/);
    // Each line rises with a small stagger; the last starts ≤ ~0.4s so total < 1.2s.
    expect(block('.js-now-eyebrow {')).toMatch(/animation: js-rise 0\.5s 0s/);
    expect(block('.js-now-artist {')).toMatch(/animation: js-rise 0\.6s 0\.4s/);
  });
});

describe('Joy Stage — lyrics as a living reading surface', () => {
  it('lyrics dominate as one large centered surface, no hard card border', () => {
    expect(display).toContain('js-lyrics-scroll');
    expect(block('.js-lyrics-scroll {')).toContain('flex: 1 1 auto');
    expect(block('.js-lyrics-scroll {')).not.toMatch(/border:/); // no hard card
    // Subtle focus glow + soft top/bottom fade.
    expect(block('.js-lyrics-scroll {')).toMatch(/radial-gradient/);
    expect(block('.js-lyrics-scroll {')).toMatch(/mask-image/);
  });

  it('lyric text is a comfortable ~850–1000px column, ivory, generous line-height', () => {
    const body = block('.js-lyrics-body {');
    expect(body).toMatch(/max-width: min\(92vw, 960px\)/);
    expect(body).toContain('var(--ivory)');
    expect(body).toContain('white-space: pre-wrap'); // preserve line breaks
    expect(body).toMatch(/line-height: 1\.7/); // generous
  });
});

describe('Joy Stage — lyrics unavailable = graceful artwork fallback (not a big "unavailable")', () => {
  it('shows artwork from request thumbnail + song/artist + a warm human message', () => {
    expect(display).toContain('js-artwork');
    expect(display).toMatch(/backgroundImage: `url\("\$\{playing\.thumbnailUrl\}"\)`/);
    expect(display).toContain('이 순간을 함께 즐겨주세요'); // warm human message
    expect(display).toContain('js-art-song');
  });

  it('the "no lyrics" fact is only a SMALL honest note, never the centerpiece', () => {
    expect(display).toContain('자동 가사를 찾지 못했어요');
    // The note uses the small muted style, the message uses the large warm style.
    expect(block('.js-art-note {')).toContain('var(--muted-2)');
    expect(block('.js-art-message {')).toContain('var(--joy-coral)');
  });

  it('degrades gracefully with no thumbnail (ambient gradient, no broken image)', () => {
    expect(display).toMatch(/js-artwork\$\{playing\.thumbnailUrl \? '' : ' no-art'\}/);
    expect(block('.js-artwork {')).toMatch(/linear-gradient/);
  });
});

describe('Joy Stage — next-stage invitation + waiting + completion', () => {
  it('NEXT STAGE warmly invites the next singer, compact during singing', () => {
    expect(display).toContain('NEXT STAGE');
    expect(display).toMatch(/잠시 후, <strong>\{next\.guestName\}<\/strong>의 무대가 시작됩니다/);
    expect(block('.js-next {')).toContain('flex: 0 0 auto'); // compact, fixed footer
  });

  it('waiting stage is a warm ambient invitation with a prominent central QR', () => {
    expect(display).toContain('오늘의 무대가 곧 시작됩니다');
    expect(display).toContain('함께 부르고 싶은 노래를 신청해 주세요');
    expect(display).toContain('js-invite-qr'); // QR framed as invitation, not a utility
  });

  it('completion transition briefly celebrates the singer, then clears (non-blocking)', () => {
    expect(display).toMatch(/\{celebrating\.name\}의 무대였습니다/);
    expect(display).toContain('js-celebrate');
    expect(display).toMatch(/setCelebrating\(null\), CELEBRATE_MS/); // auto-dismiss
    // Detected reliably from the playing.id transition — no engine change.
    expect(display).toMatch(/cur\.id !== prev\.id/);
    // No scoring / judgment / competition.
    expect(display).not.toMatch(/score|점수|승자|winner|rank/i);
  });
});

describe('Joy Stage — palette, motion, responsiveness, preserved behavior', () => {
  it('uses the restrained BTY palette (navy / gold / coral / cyan / ivory)', () => {
    const root = block('.js {');
    expect(root).toMatch(/#0b1020|#070b14/); // deep navy foundation
    expect(css).toContain('--joy-coral');
    expect(css).toContain('--ivory');
    // A slow, subtle breathing glow (not constant strobe motion).
    expect(block('.js-aura {')).toMatch(/animation: js-breathe 10s/);
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('handles 100dvh + safe areas and stays lyrics-dominant on phone + portrait', () => {
    expect(block('.js {')).toContain('100dvh');
    expect(block('.js {')).toContain('safe-t');
    expect(css).toContain('@media (max-width: 640px)');
    expect(css).toContain('@media (orientation: portrait)');
  });

  it('preserves lyric scroll across same-song polls, resets only on song change', () => {
    // Keyed by the request id → stable across a 2s poll (scroll kept), remount on change.
    expect(display).toMatch(/<LyricsStage key=\{`lyr-\$\{playing\.id\}`\} playing=\{playing\} \/>/);
    expect(display).not.toMatch(/scrollTo\(|scrollTop\s*=/); // never force to the top
  });

  it('preserves 2s polling, stale-song protection, wake-lock, fullscreen, auto lyrics', () => {
    expect(display).toContain('POLL_MS = 2000');
    expect(display).toMatch(/if \(n !== seq\.current\) return/); // stale-response guard
    expect(display).toContain('wakeLock');
    expect(display).toContain('enterFullscreen');
    expect(display).toContain('display?lyrics=1'); // automatic lyrics preserved
  });
});
