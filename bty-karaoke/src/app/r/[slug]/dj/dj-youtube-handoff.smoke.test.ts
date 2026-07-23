// Gate A — the Admin hands off to ONE same-origin BTY Player tab, never the youtube.com
// popup (whose COOP severed the named handle and spawned a tab per song). playNext ensures
// the single Player tab exists (reuse live handle, else open the same-origin Player route in
// a stable Room-scoped named context), runs exactly one lifecycle op, then pushes the video
// over the Room BroadcastChannel — it NEVER navigates the Admin tab, never opens youtube.com,
// and no navigation/visibility/unload/Back/remount path completes or skips a song. The
// metering/lifecycle behaviour is proven on real Postgres by the B1 gate + model tests; the
// browser reuse + iframe playback is proven in the real-Chromium harness.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const src = read('./DjConsole.tsx');
const playNext = src.slice(src.indexOf('async function playNext'), src.indexOf('async function reorder'));
const restore = src.slice(src.indexOf('const restoreView'), src.indexOf('const restoreView') + 400);

describe('Platform split — native external YouTube vs web BTY Player (capability-detected)', () => {
  it('detects the environment via the native bridge capability, NOT user-agent', () => {
    expect(playNext).toContain('const native = isNativeHost()');
    expect(src).toContain("from '@/lib/native-bridge'");
    // no user-agent sniffing in the handoff (detection is capability-based)
    expect(playNext).not.toContain('navigator.userAgent');
    expect(playNext).not.toContain('navigator.platform');
  });

  it('NATIVE branch calls the external YouTube handoff — no Player tab, no channel command', () => {
    const nativeBranch = playNext.slice(
      playNext.indexOf('if (native) {', playNext.indexOf('EXACTLY ONE lifecycle op ran')),
      playNext.indexOf('} else {', playNext.indexOf('EXACTLY ONE lifecycle op ran')),
    );
    expect(nativeBranch).toContain('nativeOpenYouTube({ videoId: nextVideoId, url: watchUrl })');
    expect(nativeBranch).not.toContain('window.open(');
    expect(nativeBranch).not.toContain('BroadcastChannel');
    expect(nativeBranch).not.toContain('setShowPlayerFallback');
  });

  it('WEB acquisition of the Player tab is GATED behind !native (never opened on native)', () => {
    // the only window.open is inside the `if (!native)` block
    expect(playNext).toMatch(/if \(!native\) \{[\s\S]*window\.open\(playerHref\(slug\), playerWindowName\(slug\)\)/);
    expect((playNext.match(/window\.open\(/g) ?? []).length).toBe(1);
  });
});

describe('Web branch — hands off to ONE same-origin Player tab (never youtube.com nav)', () => {
  it('opens the SAME-ORIGIN Player route in a stable Room-scoped named context', () => {
    expect(playNext).toContain('window.open(playerHref(slug), playerWindowName(slug))');
    // never the cross-origin youtube popup, never _blank, never a top-level youtube nav
    expect(playNext).not.toContain("'_blank'");
    expect(playNext).not.toContain('"_blank"');
    // the only youtube reference is the validated watch URL handed to the NATIVE bridge
    expect(playNext).not.toContain('window.location');
    expect(playNext).not.toContain('.location.replace');
  });

  it('reuses the retained WindowProxy when open; opens only when there is no live handle', () => {
    expect(playNext).toMatch(/ytWinRef\.current && !ytWinRef\.current\.closed \? ytWinRef\.current : null/);
    expect(playNext).toMatch(/if \(!playerWin[\s\S]*window\.open\(playerHref\(slug\), playerWindowName\(slug\)\)/);
    expect(playNext).toContain('ytWinRef.current = playerWin');
  });

  it('acquires the Player tab SYNCHRONOUSLY (popup-safe) before any await', () => {
    const openIdx = playNext.indexOf('window.open(playerHref(slug)');
    const firstAwait = playNext.indexOf('await ');
    expect(openIdx).toBeGreaterThan(-1);
    expect(openIdx).toBeLessThan(firstAwait);
  });

  it('NEVER navigates the Admin tab (no location.assign / href / router in playNext)', () => {
    expect(playNext).not.toContain('window.location.assign');
    expect(playNext).not.toContain('location.href');
    expect(playNext).not.toContain('router.push');
    expect(playNext).not.toContain('router.replace');
  });

  it('pushes a VALIDATED play command over the Room BroadcastChannel only AFTER server success', () => {
    expect(playNext).toContain('buildPlayCommand(nextVideoId, nextId, null)');
    expect(playNext).toContain('new BroadcastChannel(playerChannelName(slug))');
    expect(playNext).toContain('ch.postMessage(command)');
    expect(playNext).toContain('ch.close()');
    // the push happens after the queue is reloaded (i.e. after the server mutation)
    expect(playNext.indexOf('ch.postMessage(command)')).toBeGreaterThan(playNext.indexOf('await loadQueue(cred)'));
    // and only for a validated command
    expect(playNext).toMatch(/if \(command && typeof BroadcastChannel/);
  });

  it('does NOT accumulate tabs: exactly one window.open site; focuses the reused Player', () => {
    expect((playNext.match(/window\.open\(/g) ?? []).length).toBe(1);
    expect(playNext).toContain('playerWin.focus()');
  });

  it('lifecycle failure closes ONLY a freshly-created Player tab, never a reused one', () => {
    expect(playNext).toContain('let createdFresh = false');
    expect(playNext).toMatch(/playerWin = window\.open\([\s\S]*if \(playerWin\) \{\s*createdFresh = true/);
    expect(playNext).toMatch(/const closePlayerOnFailure = \(\) => \{[\s\S]*if \(!native && createdFresh && playerWin && !playerWin\.closed\)[\s\S]*playerWin\.close\(\)[\s\S]*ytWinRef\.current = null/);
    expect((playNext.match(/closePlayerOnFailure\(\)/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it('lifecycle SUCCESS with a blocked popup shows the same-named Player fallback link', () => {
    const success = playNext.slice(playNext.indexOf('buildPlayCommand'), playNext.indexOf('// Network error'));
    expect(success).toContain('setShowPlayerFallback(true)');
    expect(success).not.toContain('closePlayerOnFailure()');
    // the fallback anchor opens the same-origin Player in the SAME named tab (not _blank)
    expect(src).toContain('href={playerHref(slug)}');
    expect(src).toContain('target={playerWindowName(slug)}');
    expect(src).not.toContain('target="_blank"');
  });

  it('runs exactly one lifecycle op per click and never completes/skips directly', () => {
    expect((playNext.match(/\/dj\/pass-turn/g) ?? []).length).toBe(1);
    expect((playNext.match(/\/dj\/start/g) ?? []).length).toBe(1);
    expect(playNext).not.toMatch(/end_song|'complete'|'skip'/);
  });
});

describe('No navigation/visibility/unload/Back path completes or skips a song', () => {
  it('return-from-Player handlers (visibilitychange/focus/pageshow) only refresh (read-only)', () => {
    const effect = src.slice(src.indexOf('const onVisible'), src.indexOf('}, [phase, restoreView]'));
    expect(effect).toContain('restoreView()');
    expect(effect).not.toMatch(/mutate\(|\/dj\/pass-turn|\/dj\/start|end_song|'complete'|'skip'/);
    expect(restore).toContain('void refresh()');
    expect(restore).not.toMatch(/mutate|pass-turn|end_song|complete|skip|endEvent/);
  });

  it('there is NO pagehide/beforeunload/unmount completion handler', () => {
    expect(src).not.toContain('pagehide');
    expect(src).not.toContain('beforeunload');
    expect(src).not.toContain('onbeforeunload');
    const effect = src.slice(src.indexOf('const onVisible'), src.indexOf('}, [phase, restoreView]'));
    const cleanup = effect.slice(effect.indexOf('return () => {'));
    expect(cleanup).toContain('removeEventListener');
    expect(cleanup).not.toMatch(/mutate|complete|skip|pass-turn|end_song/);
  });

  it('auto-next completion happens ONLY via an explicit operator terminal (pass-turn=complete)', () => {
    expect(playNext).toContain('/dj/pass-turn');
    expect(playNext).toContain("(data?.requests ?? []).find((r) => r.status === 'playing')");
  });
});
