// @vitest-environment jsdom
// BUILD 26T-R1B-R6-R1B-R9 §I — the web Guest history renders the unavailable state.
//
// The rule under test: unavailability describes the CONTENT, never what historically happened to
// the request. A cancelled request stays cancelled; a host-removed one stays host-removed.

import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { unavailableCopy } from '@/domain/youtube-unavailable';
import { resolutionCopy } from '@/domain/request-resolution';

afterEach(cleanup);

describe('§I unavailable history preserves BTY outcome', () => {
  it('M23/M24/U-M7: the resolution copy is independent of availability', () => {
    // The renderer reads `resolutionCode` for the outcome and `youtubeUnavailable` for the
    // content — two separate axes. This pins that the outcome vocabulary never learned about
    // availability, which is what would let an unavailable row look retroactively different.
    for (const locale of ['ko', 'en'] as const) {
      const cancelled = resolutionCopy(locale, 'guest_cancelled');
      const removed = resolutionCopy(locale, 'host_removed');
      expect(cancelled).toBeTruthy();
      expect(removed).toBeTruthy();
      expect(cancelled).not.toBe(removed);
      // No outcome sentence mentions availability at all.
      expect(cancelled.toLowerCase()).not.toContain('unavailable');
      expect(removed.toLowerCase()).not.toContain('unavailable');
      expect(cancelled).not.toContain(unavailableCopy(locale).title);
    }
  });

  it('M22: the approved copy is what an unavailable history row shows', () => {
    expect(unavailableCopy('en').title).toBe('YouTube video unavailable');
    expect(unavailableCopy('ko').title).toBe('YouTube 동영상을 사용할 수 없음');
  });

  it('M25/U-M8: the dock reads the explicit marker, never a null title', () => {
    const src = require('node:fs').readFileSync('src/app/r/[slug]/MyRequestsDock.tsx', 'utf8');
    expect(src).toMatch(/const gone = v\.youtubeUnavailable === true;/);
    // A null-title inference would also catch legacy rows, which is a different and wrong rule.
    expect(src).not.toMatch(/const gone = !v\.title/);
    // The stale identity is not rendered for such a row.
    expect(src).toMatch(/gone\s*\n?\s*\? \{ title: '', artist: null as string \| null \}/);
    expect(src).toMatch(/\? unavailableCopy\(locale\)\.title/);
  });

  it('M27: an ordinary history row still renders its real song title', () => {
    const src = require('node:fs').readFileSync('src/app/r/[slug]/MyRequestsDock.tsx', 'utf8');
    expect(src).toMatch(/: songDisplay\(v\.title \?\? '', v\.channelTitle \?\? ''\)/);
  });

  it('M26: no playback CTA exists in the resolved-history list at all', () => {
    const src = require('node:fs').readFileSync('src/app/r/[slug]/MyRequestsDock.tsx', 'utf8');
    const list = src.slice(src.indexOf('dock-resolved-list'), src.indexOf('</ul>', src.indexOf('dock-resolved-list')));
    expect(list).not.toMatch(/onPlay|watchUrl|<button/i);
  });
});
