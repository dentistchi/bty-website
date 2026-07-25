import { describe, it, expect } from 'vitest';
import { AASA_APP_ID, APPLE_APP_SITE_ASSOCIATION } from './aasa';

describe('AASA document', () => {
  it('uses the measured Team ID + bundle ID', () => {
    expect(AASA_APP_ID).toBe('CS92W2HFCH.com.bty.BTYNorebangAdmin');
    expect(APPLE_APP_SITE_ASSOCIATION.applinks.details[0].appIDs).toEqual([AASA_APP_ID]);
  });

  it('claims ONLY /app/join/* — never all site routes', () => {
    const comps = APPLE_APP_SITE_ASSOCIATION.applinks.details[0].components;
    expect(comps).toHaveLength(1);
    expect(comps[0]['/']).toBe('/app/join/*');
    // no wildcard-everything entry
    const paths = comps.map((c) => c['/']);
    expect(paths).not.toContain('*');
    expect(paths).not.toContain('/*');
  });

  it('serializes to valid JSON', () => {
    expect(() => JSON.stringify(APPLE_APP_SITE_ASSOCIATION)).not.toThrow();
    const round = JSON.parse(JSON.stringify(APPLE_APP_SITE_ASSOCIATION));
    expect(round.applinks.details[0].appIDs[0]).toBe(AASA_APP_ID);
  });
});
