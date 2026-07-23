// Gate A — the YouTube handoff must reuse EXACTLY ONE dedicated player tab per Room/Admin
// session (a stable Room-scoped named browsing context), never spawn a tab per song, and
// never navigate the Admin tab. No navigation/visibility/unload/Back/remount path may
// complete or skip a song. Pinned at the source level (the metering/lifecycle behaviour —
// start opens exactly one segment; only explicit Complete/Skip closes it; auto-next only
// after a real terminal — is proven on real Postgres by the B1 gate + the model tests; the
// live browser reuse behaviour is proven separately in the Playwright named-window spec).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const src = read('./DjConsole.tsx');
const playNext = src.slice(src.indexOf('async function playNext'), src.indexOf('async function reorder'));
const restore = src.slice(src.indexOf('const restoreView'), src.indexOf('const restoreView') + 400);

describe('YouTube handoff reuses ONE stable named player tab (never Admin, never a tab-per-song)', () => {
  it('uses a stable Room-scoped window NAME (not _blank) so subsequent songs reuse the same tab', () => {
    // The name is derived from the room slug and retained across the mount via a ref.
    expect(src).toContain('const ytWindowName = `bty-norebang-youtube-${slug}`');
    expect(src).toContain('const ytWinRef = useRef<Window | null>(null)');
    // The player tab is opened with the stable NAME, never the anonymous _blank target.
    expect(playNext).toContain("window.open('', ytWindowName)");
    expect(playNext).not.toContain("'_blank'");
    expect(playNext).not.toContain('"_blank"');
  });

  it('reuses the retained WindowProxy when still open; only opens when there is no live handle', () => {
    // Live handle → reuse it; closed/absent → acquire-or-create the named context.
    expect(playNext).toMatch(/ytWinRef\.current && !ytWinRef\.current\.closed \? ytWinRef\.current : null/);
    expect(playNext).toMatch(/if \(!ytWin[\s\S]*window\.open\('', ytWindowName\)/);
    // The (re)acquired handle is stored back on the ref for the next click to reuse.
    expect(playNext).toContain('ytWinRef.current = ytWin');
  });

  it('acquires the player window SYNCHRONOUSLY (popup-safe) before any await', () => {
    const openIdx = playNext.indexOf("window.open('', ytWindowName)");
    const firstAwait = playNext.indexOf('await ');
    expect(openIdx).toBeGreaterThan(-1);
    expect(openIdx).toBeLessThan(firstAwait);
  });

  it('NEVER navigates the Admin tab (no window.location.assign / location.href / router in playNext)', () => {
    expect(playNext).not.toContain('window.location.assign');
    expect(playNext).not.toContain('location.href');
    expect(playNext).not.toContain('router.push');
    expect(playNext).not.toContain('router.replace');
  });

  it('navigates the SAME player tab to the new URL only AFTER Start succeeds, then focuses it', () => {
    // The video URL replaces the previous one in the reused window (not the Admin document),
    // and we bring the existing player tab forward.
    expect(playNext).toContain('ytWin.location.replace(url)');
    expect(playNext).toContain('ytWin.focus()');
    expect(playNext.indexOf('ytWin.location.replace(url)')).toBeGreaterThan(playNext.indexOf('await loadQueue(cred)'));
    // Validation is preserved — we never navigate to an unvalidated URL.
    expect(playNext).toContain('safeYoutubeWatchUrl(nextVideoId)');
  });

  it('detaches the player-tab opener (reverse-tabnabbing) and does NOT use noopener', () => {
    expect(playNext).toContain('ytWin.opener = null');
    // 'noopener' would make window.open return null and lose the handle we navigate.
    expect(playNext).not.toMatch(/window\.open\([^)]*noopener/);
  });

  it('does NOT accumulate a tab per song: exactly one window.open acquire site', () => {
    // One stable named window is reused; there is a single acquire site → one player tab.
    expect((playNext.match(/window\.open\(/g) ?? []).length).toBe(1);
    expect(playNext).not.toContain('closeYt');
  });

  it('lifecycle failure closes ONLY a freshly-created blank tab, never a reused player', () => {
    // createdFresh is set true ONLY when we opened a new blank this click.
    expect(playNext).toContain('let createdFresh = false');
    expect(playNext).toMatch(/ytWin = window\.open\('', ytWindowName\);\s*if \(ytWin\) \{\s*createdFresh = true/);
    // the cleanup is GATED on createdFresh, so a reused player (with a prior video) is
    // never closed; and it clears the ref so the next click recreates exactly one.
    expect(playNext).toMatch(/const closeFreshBlankOnFailure = \(\) => \{[\s\S]*if \(createdFresh && ytWin && !ytWin\.closed\)[\s\S]*ytWin\.close\(\)[\s\S]*ytWinRef\.current = null/);
    // it runs on EVERY lifecycle-failure return path (401 ×2, !ok ×2, needs-ready, catch).
    expect((playNext.match(/closeFreshBlankOnFailure\(\)/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it('lifecycle SUCCESS + navigation failure keeps the tab (never closes on nav failure)', () => {
    // The success branch (after loadQueue) navigates the reused tab; on a nav throw it only
    // sets the fallback url — it must NOT call the fresh-blank cleanup.
    // Bound the success block by the unique outer-catch marker (network-error comment).
    const success = playNext.slice(playNext.indexOf('if (url) {'), playNext.indexOf('// Network error'));
    expect(success).toContain('ytWin.location.replace(url)');
    expect(success).toContain('setPendingYoutubeUrl(url)');
    expect(success).not.toContain('closeFreshBlankOnFailure()');
  });

  it('popup-blocked / navigation-failure fallback targets the SAME named window, not _blank', () => {
    // when the window can't be acquired/navigated we set the url and expose an explicit link
    expect(playNext).toContain('setPendingYoutubeUrl(url)');
    expect(src).toContain('pendingYoutubeUrl && (');
    expect(src).toContain('YouTube에서 열기');
    // the fallback anchor reuses the stable player name — never _blank
    expect(src).toMatch(/href=\{pendingYoutubeUrl\}[\s\S]*target=\{ytWindowName\}[\s\S]*rel="noreferrer"/);
    expect(src).not.toContain('target="_blank"');
  });

  it('a Start/pass-turn failure never re-runs the transition and never completes/skips', () => {
    // exactly one pass-turn fetch and one start fetch (no duplicate / retry on failure)
    expect((playNext.match(/\/dj\/pass-turn/g) ?? []).length).toBe(1);
    expect((playNext.match(/\/dj\/start/g) ?? []).length).toBe(1);
    // no direct terminal mutation anywhere in the handoff
    expect(playNext).not.toMatch(/end_song|'complete'|'skip'/);
  });
});

describe('No navigation/visibility/unload/Back path completes or skips a song', () => {
  it('return-from-YouTube handlers (visibilitychange/focus/pageshow) only refresh (read-only)', () => {
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
