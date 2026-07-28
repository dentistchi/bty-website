// BUILD 20B-R1 — the guest-facing QR / share origin is ALWAYS the canonical production host in a
// Release build; a workers.dev / pages.dev / staging value can never leak into a scanned QR.
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { canonicalGuestOrigin, canonicalGuestRoomUrl, CANONICAL_GUEST_HOST } from './guest-origin';

const saved = process.env.KARAOKE_PUBLIC_ORIGIN;
beforeEach(() => { delete process.env.KARAOKE_PUBLIC_ORIGIN; });
afterEach(() => { if (saved === undefined) delete process.env.KARAOKE_PUBLIC_ORIGIN; else process.env.KARAOKE_PUBLIC_ORIGIN = saved; });

describe('canonicalGuestOrigin (Release contract)', () => {
  it('(1) defaults to the canonical production origin when no override is set', () => {
    expect(canonicalGuestOrigin()).toBe('https://norebang.btydaily.com');
    expect(new URL(canonicalGuestOrigin()).host).toBe(CANONICAL_GUEST_HOST);
  });

  it('(3) a workers.dev override is REJECTED → falls back to the canonical host (no dev leak)', () => {
    process.env.KARAOKE_PUBLIC_ORIGIN = 'https://bty-karaoke.ywamer2022.workers.dev';
    expect(canonicalGuestOrigin()).toBe('https://norebang.btydaily.com');
  });

  it('(3b) pages.dev / staging overrides are rejected', () => {
    process.env.KARAOKE_PUBLIC_ORIGIN = 'https://bty.pages.dev';
    expect(canonicalGuestOrigin()).toBe('https://norebang.btydaily.com');
    process.env.KARAOKE_PUBLIC_ORIGIN = 'https://staging.norebang.btydaily.com';
    expect(canonicalGuestOrigin()).toBe('https://norebang.btydaily.com');
  });

  it('a DEV http://localhost override is allowed (never in Release, unset there)', () => {
    process.env.KARAOKE_PUBLIC_ORIGIN = 'http://localhost:3002';
    expect(canonicalGuestOrigin()).toBe('http://localhost:3002');
  });

  it('a malformed override falls back to the canonical host', () => {
    process.env.KARAOKE_PUBLIC_ORIGIN = 'not a url';
    expect(canonicalGuestOrigin()).toBe('https://norebang.btydaily.com');
  });
});

describe('canonicalGuestRoomUrl', () => {
  it('builds the canonical /r/<slug> guest URL', () => {
    expect(canonicalGuestRoomUrl('chi-norebang')).toBe('https://norebang.btydaily.com/r/chi-norebang');
  });
  it('appends the event id when present', () => {
    expect(canonicalGuestRoomUrl('chi-norebang', 'evt-1')).toBe('https://norebang.btydaily.com/r/chi-norebang?e=evt-1');
  });
  it('(3) never emits a workers.dev / localhost host in the default (Release) build', () => {
    const url = canonicalGuestRoomUrl('room', 'e');
    expect(url).not.toMatch(/workers\.dev|localhost|127\.0\.0\.1|pages\.dev|staging/);
    expect(new URL(url).host).toBe(CANONICAL_GUEST_HOST);
  });
});
