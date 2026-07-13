import { describe, expect, it } from 'vitest';
// The QR generator and this test share the same guard module (single source).
import { isPublicGuestUrl } from '../../scripts/url-guard.mjs';

const GUEST = 'https://bty-karaoke.ywamer2022.workers.dev/r/bty-home';

describe('isPublicGuestUrl (QR guard)', () => {
  it('accepts a clean production guest URL', () => {
    expect(isPublicGuestUrl(GUEST)).toBe(true);
  });

  it('rejects any /dj path variant', () => {
    expect(isPublicGuestUrl(`${GUEST}/dj`)).toBe(false);
    expect(isPublicGuestUrl(`${GUEST}/dj/`)).toBe(false);
    expect(isPublicGuestUrl(`${GUEST}/dj?secret=x`)).toBe(false);
    expect(isPublicGuestUrl('https://x.dev/r/bty-home/dj#top')).toBe(false);
  });

  it('rejects secret= and token= bearing URLs', () => {
    expect(isPublicGuestUrl(`${GUEST}?secret=abc`)).toBe(false);
    expect(isPublicGuestUrl(`${GUEST}?token=abc`)).toBe(false);
    expect(isPublicGuestUrl(`${GUEST}#token=abc`)).toBe(false);
  });

  it('rejects empty/non-string', () => {
    expect(isPublicGuestUrl('')).toBe(false);
    expect(isPublicGuestUrl(null as unknown as string)).toBe(false);
  });
});
