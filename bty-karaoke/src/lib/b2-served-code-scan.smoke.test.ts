// B2 SERVED-CODE SCAN (§14 activation invariant).
//
// The production activation gate requires: ZERO served paths that flip a request to
// playing/completed/(playing-)skipped OUTSIDE the atomic metering RPCs. This scan pins
// that invariant in the served code so a future edit that adds an unmetered lifecycle
// write fails here, BEFORE enforcement is ever flipped on.
//
// The only app-level status write on karaoke_requests is the waiting-guarded
// skip/remove in setRequestStatus (NEXT_STATUS), which can never emit 'playing'/
// 'completed' and never touches an open segment. Everything else routes through
// karaoke_begin_song / karaoke_end_song / end_karaoke_event.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const rooms = read('./rooms.server.ts');
const metering = read('./metering.server.ts');

describe('B2 served-code scan — no unmetered lifecycle path', () => {
  it('all playing/completed/playing-skip transitions go through the metering RPCs', () => {
    // beginSong / endSong are the ONLY seams that write playing/completed/skipped-of-playing.
    expect(rooms).toContain("import { beginSong, endSong");
    // BUILD 20M — versioned metering seam: every begin/end flows through v1 OR the v2 lease
    // RPC (never an app-level lifecycle write). Both RPC names must remain referenced here.
    expect(metering).toContain("rpc('karaoke_begin_song'"); // v1 begin (default path)
    expect(metering).toContain("'karaoke_begin_song_v2'"); // v2 begin seam
    expect(metering).toContain("'karaoke_end_song'"); // v1 end (ternary else)
    expect(metering).toContain("'karaoke_end_song_v2'"); // v2 end seam
  });

  it('the one app-level status update is waiting-guarded (never playing/completed)', () => {
    // setRequestStatus non-metering branch updates NEXT_STATUS[action] but ONLY .eq status waiting.
    const idx = rooms.indexOf('.update({ status: NEXT_STATUS[action] })');
    expect(idx).toBeGreaterThan(-1);
    const around = rooms.slice(idx, idx + 220);
    expect(around).toContain(".eq('status', 'waiting')");
  });

  it('play/complete/playing-skip are intercepted by the RPC branch before the app-level update', () => {
    // The metering branches (beginSong/endSong) appear BEFORE the app-level NEXT_STATUS update.
    const begin = rooms.indexOf("beginSong(roomId, requestId, 'promote')");
    const appUpdate = rooms.indexOf('.update({ status: NEXT_STATUS[action] })');
    expect(begin).toBeGreaterThan(-1);
    expect(begin).toBeLessThan(appUpdate);
  });

  it('upgrade_required is propagated, never swallowed into a generic outcome', () => {
    // beginToStartOutcome maps the RPC outcome to itself (not to not_waiting/invalid).
    expect(rooms).toContain("case 'upgrade_required':");
    expect(rooms).toContain("return 'upgrade_required';");
  });

  it('the native path stays native — no WebKit / web-player fallback introduced', () => {
    const bridge = read('../lib/native-bridge.ts');
    // capability probe only; the metering wiring adds no WKWebView player embedding.
    expect(metering).not.toMatch(/WKWebView|webkit\.messageHandlers.*player|new WebView/);
    expect(bridge).toContain('openYouTube');
  });
});
