// Lyrics V1.1 — served-code invariants for the discoverability fix (manual entry
// reachable whether or not a song is playing) and the auto-resolver wiring.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const djBoard = read('./DjBoard.tsx');
const actionSheet = read('./DjActionSheet.tsx');
const displayClient = read('../display/DisplayClient.tsx');
const displayRoute = read('../../../api/rooms/[slug]/display/route.ts');
const resolver = read('../../../../lib/lyrics-resolver.server.ts');

describe('Lyrics V1.1 — discoverability', () => {
  it('offers the lyrics editor from the NOW SINGING (playing) stage', () => {
    // Inside the `current ?` branch: setLyricsFor(current).
    expect(djBoard).toMatch(/setLyricsFor\(current\)/);
  });

  it('ALSO offers it from the UP NEXT stage (fixes the V1 "only while playing" gap)', () => {
    expect(djBoard).toMatch(/setLyricsFor\(playTarget\)/);
  });

  it('offers it from each queue item action sheet', () => {
    expect(djBoard).toMatch(/onEditLyrics=/);
    expect(actionSheet).toMatch(/onEditLyrics\(request\.id\)/);
  });

  it('frames manual entry as an override of automatic search', () => {
    expect(djBoard).toContain('가사 수정');
    expect(djBoard).toContain('가사 직접 입력');
  });
});

describe('Lyrics V1.1 — automatic resolver wiring', () => {
  it('V1.4: the Display no longer opts into automatic resolution (?lyrics=1 removed)', () => {
    // The iPad shows no lyrics (the TV does), so it triggers no provider resolution.
    // The resolver + routes remain, gated off by default (autoLyricsEnabled).
    const code = displayClient.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toContain('?lyrics=1');
  });

  it('the display route schedules a non-blocking resolve only when opted in AND not already available', () => {
    expect(displayRoute).toMatch(/searchParams\.get\('lyrics'\) === '1'/);
    expect(displayRoute).toMatch(/lyrics\?\.status !== 'available'/);
    // Non-blocking (void schedule), NOT an awaited resolve that hangs the poll.
    expect(displayRoute).toMatch(/void scheduleLyricsResolve\(room\.id, state\.playing\.id\)/);
    expect(displayRoute).not.toMatch(/await resolvePlayingLyrics/);
  });

  it('resolution is triggered server-side at the playing transition (client-independent)', () => {
    const startRoute = read('../../../api/rooms/[slug]/dj/start/route.ts');
    const passTurn = read('../../../api/rooms/[slug]/dj/pass-turn/route.ts');
    const legacyPlay = read('../../../api/rooms/[slug]/requests/[id]/route.ts');
    expect(startRoute).toMatch(/scheduleLyricsResolve\(auth\.room\.id, requestId\)/);
    expect(passTurn).toMatch(/scheduleLyricsResolve\(auth\.room\.id, result\.promoted\.id\)/);
    expect(legacyPlay).toMatch(/action === 'play'.*scheduleLyricsResolve/s);
  });

  it('separates transient provider failure (failed, retry soon) from genuine no-match (unavailable)', () => {
    expect(resolver).toMatch(/resolved\.transient \? 'failed' : 'unavailable'/);
    // Transient errors must NOT be negative-cached; only a real no-match is.
    expect(resolver).toMatch(/no-match', false/);
    expect(resolver).toMatch(/miss\(reason, true\)/); // timeout/provider-error → transient
  });

  it('uses LRCLIB and never scrapes Genius/Google/YouTube/lyric sites', () => {
    expect(resolver).toContain('lrclib.net');
    expect(resolver).not.toMatch(/genius\.com|google\.com\/search|azlyrics|musixmatch\.com\/lyrics/i);
  });

  it('keeps provider calls server-side (a .server module)', () => {
    // The resolver module name ends in .server and the display route imports it.
    expect(displayRoute).toContain("@/lib/lyrics-resolver.server");
  });

  it('manual admin lyrics always win — resolver skips lyrics_source = admin', () => {
    expect(resolver).toMatch(/lyrics_source === 'admin'.*return null/s);
  });

  it('persists the resolved result over its OWN loading claim (not a NULL-excluding neq)', () => {
    // Regression: guarding the final write with .neq('lyrics_source','admin') matches
    // 0 rows when source is NULL (the normal auto case) → the row sticks on 'loading'.
    expect(resolver).toMatch(/\.eq\('lyrics_status', 'loading'\)/);
    expect(resolver).not.toMatch(/\.neq\('lyrics_source', 'admin'\)/);
  });
});
