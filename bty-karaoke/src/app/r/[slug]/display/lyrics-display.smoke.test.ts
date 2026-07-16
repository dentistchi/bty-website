// Lyrics V1 — Display invariants locked as served-code guarantees (the suite runs
// in a Node environment, so we assert on the client source the way the repo's other
// smoke tests do, not via a DOM render). These encode the product rules from the
// spec: reset on song change, no stale carry-over, honest states, text-only render.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const displayClient = readFileSync(
  fileURLToPath(new URL('./DisplayClient.tsx', import.meta.url)),
  'utf8',
);
const roomsServer = readFileSync(
  fileURLToPath(new URL('../../../../lib/rooms.server.ts', import.meta.url)),
  'utf8',
);

describe('Display lyrics — source invariants', () => {
  it('renders a LyricsPanel for the song on stage', () => {
    expect(displayClient).toMatch(/<LyricsPanel\b/);
    expect(displayClient).toMatch(/function LyricsPanel/);
  });

  it('keys the lyrics panel by the playing request id so a song change RESETS it', () => {
    // A per-request key remounts the panel → previous song's words are dropped and
    // the scroll returns to the top when the singer changes.
    expect(displayClient).toMatch(/key=\{`lyr-\$\{playing\.id\}`\}/);
  });

  it('shows lyrics text ONLY when status is available (never a guessed/stale match)', () => {
    expect(displayClient).toMatch(/status === 'available' && lyrics\?\.text/);
  });

  it('renders lyrics as plain text — NEVER via dangerouslySetInnerHTML', () => {
    const panel = displayClient.slice(displayClient.indexOf('function LyricsPanel'));
    expect(panel).toMatch(/\{lyrics\.text\}/); // JSX text node
    expect(panel).not.toMatch(/dangerouslySetInnerHTML/);
  });

  it('has an honest unavailable state and a static (non-spinner) loading state', () => {
    expect(displayClient).toContain('가사가 아직 없어요');
    expect(displayClient).toContain('불러오는 중');
  });

  it('scrolls long lyrics within their own box (NOW/NEXT stay put)', () => {
    expect(displayClient).toMatch(/kd-lyrics-scroll/);
  });

  it('attaches lyrics to the playing row only — waiting rows stay lean', () => {
    expect(roomsServer).toMatch(/toDisplayRequest\(playingRow, \{ withLyrics: true \}\)/);
    // The waiting projection must NOT request lyrics text (no withLyrics flag).
    expect(roomsServer).toMatch(/waitingRows\.map\(\(r\) => toDisplayRequest\(r\)\)/);
  });
});
