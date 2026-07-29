// BUILD 20B-WEB7-R4 — served-build proof endpoint + guest-document freshness contract.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GET } from './route';

afterEach(() => vi.unstubAllEnvs());

describe('/api/karaoke-build', () => {
  it('returns the live build id, no-store, with an x-karaoke-build header', async () => {
    vi.stubEnv('NEXT_PUBLIC_KARAOKE_BUILD', 'buildXYZ');
    const res = GET();
    expect(await res.json()).toEqual({ build: 'buildXYZ' });
    expect(res.headers.get('x-karaoke-build')).toBe('buildXYZ');
    expect(res.headers.get('Cache-Control')).toMatch(/no-store/);
  });

  it('never leaks secrets — only a short build id field', async () => {
    vi.stubEnv('NEXT_PUBLIC_KARAOKE_BUILD', 'abc123');
    const body = await GET().json();
    expect(Object.keys(body)).toEqual(['build']);
  });
});

describe('guest document freshness contract', () => {
  it('the /r/[slug] document route is force-dynamic (never statically cached)', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../../r/[slug]/page.tsx', import.meta.url)),
      'utf8',
    );
    expect(src).toMatch(/export const dynamic\s*=\s*'force-dynamic'/);
    // The freshness guard is mounted on the guest document.
    expect(src).toContain('GuestFreshnessGuard');
  });

  it('the served-build route is force-dynamic', () => {
    const src = readFileSync(fileURLToPath(new URL('./route.ts', import.meta.url)), 'utf8');
    expect(src).toMatch(/export const dynamic\s*=\s*'force-dynamic'/);
  });
});
