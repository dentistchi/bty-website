import { describe, it, expect } from 'vitest';
import { adminInitFromProbe } from './admin-init';

describe('adminInitFromProbe (Admin page session restore)', () => {
  it('shows the PIN form only when there is no stored credential', () => {
    expect(adminInitFromProbe(false, null)).toBe('need-auth');
    expect(adminInitFromProbe(false, 'ok')).toBe('need-auth');
  });

  it('enters the console when a valid admin session is confirmed', () => {
    expect(adminInitFromProbe(true, 'ok')).toBe('authed');
  });

  it('returns to the PIN form ONLY on a definitive 401 (revoked/invalid)', () => {
    expect(adminInitFromProbe(true, 'unauth')).toBe('need-auth');
  });

  it('never shows the PIN form on a transient error — it retries', () => {
    expect(adminInitFromProbe(true, 'neterr')).toBe('retry');
    expect(adminInitFromProbe(true, null)).toBe('retry'); // probe not yet done
  });
});
