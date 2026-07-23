// The BTY Player must: create exactly ONE YT.Player via the official IFrame API and only
// call loadVideoById on it; take instant commands over the Room BroadcastChannel (strictly
// validated) AND recover from the canonical /display poll (the DB playing request is the
// authority — never localStorage); ignore the YT 'ended' event (no lifecycle mutation); and
// offer an "Open on YouTube" fallback for non-embeddable videos that never starts a song.
// Behaviour that depends on the real browser + iframe API is proven separately in the
// real-Chromium harness; this pins the wiring/invariants at the source level.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
// Strip comments so "no lifecycle mutation / no private field" assertions test CODE, not the
// prose in our own comments (which legitimately name those things to explain the invariant).
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const src = read('./PlayerClient.tsx');
const srcCode = strip(src);
const page = read('./page.tsx');
const pageCode = strip(page);

describe('PlayerClient — one same-origin YT.Player, driven by channel + canonical poll', () => {
  it('loads the OFFICIAL YouTube IFrame Player API', () => {
    expect(src).toContain('https://www.youtube.com/iframe_api');
    expect(src).toContain('onYouTubeIframeAPIReady');
    expect(src).toContain('new window.YT.Player(');
  });

  it('creates the player at most once (guarded on an existing instance)', () => {
    // create() bails if playerRef.current already exists → a single YT.Player instance.
    expect(src).toMatch(/if \(cancelled \|\| playerRef\.current[\s\S]*return;/);
    expect((src.match(/new window\.YT\.Player\(/g) ?? []).length).toBe(1);
  });

  it('only ever calls loadVideoById (never navigates the tab or opens new tabs)', () => {
    expect(src).toContain('loadVideoById');
    expect(src).not.toContain('window.open(');
    expect(src).not.toContain('location.replace');
    expect(src).not.toContain('location.href');
    // dedupes a redundant reload of the same id so the recovery poll never interrupts playback
    expect(src).toMatch(/if \(loadedRef\.current === videoId\) return/);
  });

  it('takes instant commands over the Room BroadcastChannel, STRICTLY validated', () => {
    expect(src).toContain('new BroadcastChannel(playerChannelName(slug))');
    expect(src).toContain('isPlayerPlayCommand(msg)');
    // ignores anything that is not a valid command, and stale cross-event commands
    expect(src).toMatch(/if \(!isPlayerPlayCommand\(msg\)\) return/);
    expect(src).toMatch(/msg\.eventId !== eventRef\.current\) return/);
  });

  it('RECOVERS from the canonical /display poll (DB playing request is the authority)', () => {
    expect(src).toContain('/api/rooms/${encodeURIComponent(slug)}/display');
    expect(src).toContain('data.playing?.videoId');
    expect(src).toMatch(/setInterval\(poll/);
    // never trusts localStorage as an authority (no actual usage in code)
    expect(srcCode).not.toContain('localStorage');
    // validates the canonical id before loading
    expect(src).toMatch(/isValidVideoId\(canonical\)/);
  });

  it('IGNORES the video-ended event — the Player never completes a request', () => {
    // no lifecycle mutation anywhere in the Player: it only ever GETs /display.
    expect(srcCode).not.toContain('/dj/');
    expect(srcCode).not.toContain('end_song');
    expect(srcCode).not.toMatch(/method:\s*'POST'/);
    // the ENDED branch is explicitly a no-op (comment marks the invariant)
    expect(src).toContain('ENDED is intentionally ignored');
  });

  it('shows a manual gesture control when autoplay is blocked', () => {
    expect(src).toContain('setNeedsGesture');
    expect(src).toContain('playVideo()');
    expect(src).toContain('▶ 재생');
  });

  it('non-embeddable video → "Open on YouTube" fallback that does NOT start a song', () => {
    // YT embed-disabled / removed error codes surface the fallback
    expect(src).toMatch(/e\.data === 101 \|\| e\.data === 150 \|\| e\.data === 100/);
    expect(src).toContain('safeYoutubeWatchUrl(unplayable)');
    expect(src).toContain('YouTube에서 열기');
    // the fallback is a plain external link — it triggers no lifecycle fetch
    const fallback = src.slice(src.indexOf('fallbackUrl && ('));
    expect(fallback).not.toMatch(/\/dj\/pass-turn|\/dj\/start/);
  });
});

describe('Player route (page.tsx) — public, canonical, no private data', () => {
  it('renders only server-validated canonical video id (no session/secret/private fields)', () => {
    expect(page).toContain('getDisplayState');
    expect(page).toContain('isValidVideoId(rawInitial)');
    for (const secret of ['session_id', 'dj_secret', 'passcode', 'email', 'provider_subject', 'token']) {
      expect(pageCode).not.toContain(secret);
    }
  });
});
