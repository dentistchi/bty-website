// Gate A blocker fix — YouTube handoff must NOT replace the Admin tab, and no
// navigation/visibility/unload/Back/remount path may complete or skip a song. Pins the
// wiring at the source level (the metering/lifecycle behaviour — start opens exactly one
// segment; only explicit Complete/Skip closes it; auto-next only after a real terminal —
// is proven on real Postgres by the B1 gate + karaoke-metering.model.test.ts).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const src = read('./DjConsole.tsx');
const playNext = src.slice(src.indexOf('async function playNext'), src.indexOf('async function reorder'));
const restore = src.slice(src.indexOf('const restoreView'), src.indexOf('const restoreView') + 400);

describe('YouTube handoff opens a SEPARATE tab (never replaces Admin)', () => {
  it('playNext opens a blank secondary tab SYNCHRONOUSLY (popup-blocker-safe)', () => {
    expect(playNext).toContain("window.open('', '_blank')");
    // opened before any await so the click gesture authorizes the popup
    const openIdx = playNext.indexOf("window.open('', '_blank')");
    const firstAwait = playNext.indexOf('await ');
    expect(openIdx).toBeGreaterThan(-1);
    expect(openIdx).toBeLessThan(firstAwait);
  });

  it('NEVER navigates the Admin tab (no window.location.assign / location.href in playNext)', () => {
    expect(playNext).not.toContain('window.location.assign');
    expect(playNext).not.toContain('location.href');
    expect(playNext).not.toContain('router.push');
    expect(playNext).not.toContain('router.replace');
  });

  it('navigates the SECONDARY tab to YouTube only AFTER Start succeeds', () => {
    // the video URL is applied to the opened window, not the current document
    expect(playNext).toContain('ytWin.location.replace(url)');
    // success navigation occurs after loadQueue (i.e. after the server mutation)
    expect(playNext.indexOf('ytWin.location.replace(url)')).toBeGreaterThan(playNext.indexOf('await loadQueue(cred)'));
  });

  it('detaches the secondary tab opener (reverse-tabnabbing defense), and does NOT use noopener', () => {
    // opener is nulled right after opening so the YouTube tab can never script Admin back.
    expect(playNext).toContain('ytWin.opener = null');
    const openerIdx = playNext.indexOf('ytWin.opener = null');
    const openIdx = playNext.indexOf("window.open('', '_blank')");
    expect(openerIdx).toBeGreaterThan(openIdx); // detached immediately after opening
    // 'noopener' would make window.open return null and lose the handle we navigate.
    expect(playNext).not.toContain("'_blank', 'noopener'");
    expect(playNext).not.toMatch(/window\.open\([^)]*noopener/);
  });

  it('secondary tab closed BEFORE navigation → fallback link, Admin kept, no re-Start / terminal', () => {
    // ytWin.closed is checked before location.replace; the closed branch only sets the
    // fallback url — it never re-fetches /dj/start or /dj/pass-turn, never completes/skips.
    expect(playNext).toContain('!ytWin.closed');
    const success = playNext.slice(playNext.indexOf('if (url) {'));
    // the closed/blocked branch sets the fallback and nothing else terminal
    expect(success).toContain('setPendingYoutubeUrl(url)');
    expect(success).not.toMatch(/\/dj\/start|\/dj\/pass-turn|end_song|'complete'|'skip'/);
  });

  it('location.replace exception → close stray tab, fallback link, request untouched', () => {
    // The replace() call is guarded; on throw we closeYt() + setPendingYoutubeUrl and stop.
    const nav = playNext.slice(playNext.indexOf('ytWin.location.replace(url)'), playNext.indexOf('ytWin.location.replace(url)') + 420);
    expect(nav).toMatch(/catch\s*\{[\s\S]*closeYt\(\)[\s\S]*setPendingYoutubeUrl\(url\)/);
    // no lifecycle mutation inside the catch
    expect(nav).not.toMatch(/\/dj\/start|\/dj\/pass-turn|end_song|'complete'|'skip'/);
  });

  it('closes the blank tab on every Start failure path', () => {
    // 401, !res.ok (start), !res.ok (pass-turn), needs-ready, and catch all close it
    const closes = (playNext.match(/closeYt\(\)/g) ?? []).length;
    expect(closes).toBeGreaterThanOrEqual(5);
  });

  it('popup-blocked fallback keeps Admin open and exposes an explicit "Open YouTube" link', () => {
    // when window.open returns null (or throws) we set pendingYoutubeUrl instead of navigating
    expect(playNext).toContain('setPendingYoutubeUrl(url)');
    expect(src).toContain('pendingYoutubeUrl && (');
    expect(src).toContain('YouTube에서 열기');
    expect(src).toMatch(/href=\{pendingYoutubeUrl\}[\s\S]*target="_blank"[\s\S]*rel="noreferrer"/);
  });
});

describe('No navigation/visibility/unload/Back path completes or skips a song', () => {
  it('return-from-YouTube handlers (visibilitychange/focus/pageshow) only refresh (read-only)', () => {
    // The whole return-path effect region (handlers + register + cleanup) never mutates.
    const effect = src.slice(src.indexOf('const onVisible'), src.indexOf('}, [phase, restoreView]'));
    expect(effect).toContain('restoreView()');
    expect(effect).not.toMatch(/mutate\(|\/dj\/pass-turn|\/dj\/start|end_song|'complete'|'skip'/);
    // restoreView only blurs + refreshes; it never mutates lifecycle.
    expect(restore).toContain('void refresh()');
    expect(restore).not.toMatch(/mutate|pass-turn|end_song|complete|skip|endEvent/);
  });

  it('there is NO pagehide/beforeunload/unmount completion handler', () => {
    expect(src).not.toContain('pagehide');
    expect(src).not.toContain('beforeunload');
    expect(src).not.toContain('onbeforeunload');
    // The only unmount cleanup in the return-path effect is removeEventListener (no mutation).
    const effect = src.slice(src.indexOf('const onVisible'), src.indexOf('}, [phase, restoreView]'));
    const cleanup = effect.slice(effect.indexOf('return () => {'));
    expect(cleanup).toContain('removeEventListener');
    expect(cleanup).not.toMatch(/mutate|complete|skip|pass-turn|end_song/);
  });

  it('auto-next completion happens ONLY via an explicit operator terminal (pass-turn=complete)', () => {
    // playNext promotes the next song ONLY through /dj/pass-turn when a song is playing;
    // never as a side effect of a page/tab lifecycle event.
    expect(playNext).toContain('/dj/pass-turn');
    expect(playNext).toContain("(data?.requests ?? []).find((r) => r.status === 'playing')");
  });
});
