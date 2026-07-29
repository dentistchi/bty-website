// BUILD 20B-WEB7-R4 — the pure reload decision for the guest freshness guard.

import { describe, it, expect } from 'vitest';
import { shouldReload, FRESHNESS_RELOAD_KEY } from './build-freshness';

describe('shouldReload', () => {
  it('reloads when the running bundle is older than the served build', () => {
    expect(shouldReload({ running: 'aaaa', served: 'bbbb' })).toBe(true);
  });

  it('does NOT reload when running matches served (fresh client)', () => {
    expect(shouldReload({ running: 'aaaa', served: 'aaaa' })).toBe(false);
  });

  it('never reloads on unknown ids (missing env / failed fetch) — no blip bounce', () => {
    expect(shouldReload({ running: null, served: 'bbbb' })).toBe(false);
    expect(shouldReload({ running: 'aaaa', served: null })).toBe(false);
    expect(shouldReload({ running: undefined, served: undefined })).toBe(false);
  });

  it('loop guard: does not reload twice for the same served build', () => {
    expect(shouldReload({ running: 'aaaa', served: 'bbbb', reloadedFor: 'bbbb' })).toBe(false);
    // but a NEWER served build still triggers one reload
    expect(shouldReload({ running: 'aaaa', served: 'cccc', reloadedFor: 'bbbb' })).toBe(true);
  });

  it('exposes a stable sessionStorage key', () => {
    expect(FRESHNESS_RELOAD_KEY).toBe('bty-karaoke:freshness:reloaded-for');
  });
});
