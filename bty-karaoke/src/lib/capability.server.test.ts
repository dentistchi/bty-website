import { describe, it, expect, beforeAll } from 'vitest';

// Deterministic secret so the test doesn't depend on .dev.vars.
beforeAll(() => {
  process.env.KARAOKE_CAP_SECRET = 'unit-test-cap-secret';
});

const { signCancelCapability, verifyCancelCapability, CANCEL_CAP_TTL_MS } = await import(
  './capability.server'
);

const RID = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';

describe('cancel capability', () => {
  it('verifies a freshly signed token for its own request', async () => {
    const t = await signCancelCapability(RID);
    expect(await verifyCancelCapability(t, RID)).toBe(true);
  });

  it('rejects the token for a different request id (id alone is insufficient)', async () => {
    const t = await signCancelCapability(RID);
    expect(await verifyCancelCapability(t, OTHER)).toBe(false);
  });

  it('rejects a tampered signature', async () => {
    const t = await signCancelCapability(RID);
    const tampered = t.slice(0, -2) + (t.endsWith('aa') ? 'bb' : 'aa');
    expect(await verifyCancelCapability(tampered, RID)).toBe(false);
  });

  it('rejects a tampered payload', async () => {
    const t = await signCancelCapability(RID);
    const [, sig] = t.split('.');
    const forged = `${btoa('{"r":"' + OTHER + '","e":9999999999}').replace(/=+$/, '')}.${sig}`;
    expect(await verifyCancelCapability(forged, OTHER)).toBe(false);
  });

  it('rejects an expired token', async () => {
    const past = Date.now() - CANCEL_CAP_TTL_MS - 1000;
    const t = await signCancelCapability(RID, past);
    expect(await verifyCancelCapability(t, RID)).toBe(false);
  });

  it('rejects empty / malformed tokens', async () => {
    expect(await verifyCancelCapability('', RID)).toBe(false);
    expect(await verifyCancelCapability('garbage', RID)).toBe(false);
    expect(await verifyCancelCapability(null, RID)).toBe(false);
  });
});
