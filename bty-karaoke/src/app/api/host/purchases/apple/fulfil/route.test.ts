// POST /api/host/purchases/apple/fulfil — BUILD 26S-R1, Track B Slice 4.
//
// These tests prove ROUTING and the TRUST BOUNDARY: that the account comes from the session, that
// no entitlement fact can be supplied by a caller, and that each refusal maps to a status a client
// can act on. They deliberately do NOT prove atomicity, idempotency or concurrency — those are
// properties of PostgreSQL and are proven against a real cluster in
// supabase/tests/b26s/fulfilment.pg.test.mjs. A mocked RPC cannot establish any of them, and a
// suite that pretended otherwise would be the most dangerous file in the build.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  account: { id: 'acct-1' } as { id: string } | null,
  outcome: null as unknown,
};

vi.mock('@/lib/dj-auth.server', () => ({ bearerFromHeader: () => 'tok' }));
vi.mock('@/lib/host-web-session.server', () => ({ hostTokenFromRequest: () => null }));
vi.mock('@/lib/host-auth.server', () => ({ authorizeHost: async () => state.account }));

const fulfilApplePurchase = vi.fn(async (..._a: unknown[]) => state.outcome);
vi.mock('@/lib/apple-fulfilment.server', () => ({
  fulfilApplePurchase: (...a: unknown[]) => fulfilApplePurchase(...a),
}));

import { POST } from './route';

const PURCHASE = '28ab7288-ed3b-43b6-acef-484d1f635032';

const FULFILMENT = {
  purchaseId: PURCHASE,
  grantStatus: 'GRANTED',
  passGrantId: '99999999-8888-4777-8666-555555555555',
  grantedSeconds: 3600,
  environment: 'Sandbox',
  storekitProductId: 'com.btydaily.norebang.pass.1hour',
  productCode: 'PASS_1H',
  passType: 'ONE_HOUR',
  sourceType: 'PAID',
  isPaid: true,
  passStatus: 'AVAILABLE',
  transactionFingerprint: '9a4eafea51f2…',
  appAccountTokenFingerprint: '8107d5628079…',
  replayed: false,
};

function req(body: unknown) {
  return new Request('https://x/api/host/purchases/apple/fulfil', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  state.account = { id: 'acct-1' };
  state.outcome = { ok: true, fulfilment: { ...FULFILMENT } };
  fulfilApplePurchase.mockClear();
});

describe('POST /api/host/purchases/apple/fulfil', () => {
  it('settles a purchase and returns the durable grant facts', async () => {
    const res = await POST(req({ purchaseId: PURCHASE }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      purchaseId: PURCHASE,
      grantStatus: 'GRANTED',
      passGrantId: FULFILMENT.passGrantId,
      grantedSeconds: 3600,
      sourceType: 'PAID',
      isPaid: true,
      passStatus: 'AVAILABLE',
      replayed: false,
    });
  });

  it('NO success response authorizes Transaction.finish()', async () => {
    const res = await POST(req({ purchaseId: PURCHASE }));
    expect(await res.json()).toMatchObject({ authorizesFinish: false });

    state.outcome = { ok: true, fulfilment: { ...FULFILMENT, replayed: true } };
    const replay = await POST(req({ purchaseId: PURCHASE }));
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ replayed: true, authorizesFinish: false });
  });

  it('the account comes from the SESSION — a body accountId is rejected outright', async () => {
    const res = await POST(req({ purchaseId: PURCHASE, accountId: 'someone-else' }));
    expect(res.status).toBe(400);
    expect(fulfilApplePurchase).not.toHaveBeenCalled();
  });

  it.each([
    ['durationSeconds', 86400],
    ['grantedSeconds', 86400],
    ['passType', 'TWENTY_FOUR_HOURS'],
    ['productCode', 'PASS_24H'],
    ['storekitProductId', 'com.btydaily.norebang.pass.24hour'],
    ['sourceType', 'MANUAL_PROMOTIONAL'],
    ['isPaid', false],
    ['grantStatus', 'GRANTED'],
    ['passGrantId', '99999999-8888-4777-8666-555555555555'],
    ['actorType', 'MANAGER'],
    ['environment', 'Production'],
    ['appleTransactionId', '2000000900000001'],
  ])('no caller may supply %s', async (key, value) => {
    const res = await POST(req({ purchaseId: PURCHASE, [key]: value }));
    expect(res.status).toBe(400);
    expect(fulfilApplePurchase).not.toHaveBeenCalled();
  });

  it('passes ONLY the session account and the purchase id to the service', async () => {
    await POST(req({ purchaseId: PURCHASE }));
    expect(fulfilApplePurchase).toHaveBeenCalledWith({ accountId: 'acct-1', purchaseId: PURCHASE });
  });

  it('unauthenticated -> 401, and nothing is attempted', async () => {
    state.account = null;
    const res = await POST(req({ purchaseId: PURCHASE }));
    expect(res.status).toBe(401);
    expect(fulfilApplePurchase).not.toHaveBeenCalled();
  });

  it('a malformed purchaseId never reaches the database', async () => {
    const res = await POST(req({ purchaseId: 'not-a-uuid' }));
    expect(res.status).toBe(400);
    expect(fulfilApplePurchase).not.toHaveBeenCalled();
  });

  it.each([
    ['purchase_not_found', 404],
    ['purchase_not_verified', 409],
    ['purchase_product_unresolved', 409],
    ['grant_revoked', 409],
    ['fulfilment_conflict', 409],
    ['catalog_product_not_found', 500],
    ['product_identity_mismatch', 500],
    ['ledger_invariant_conflict', 500],
  ])('%s -> %i, and never claims entitlement', async (error, status) => {
    state.outcome = { ok: false, error };
    const res = await POST(req({ purchaseId: PURCHASE }));
    expect(res.status).toBe(status);
    expect(await res.json()).toMatchObject({ ok: false, error, entitlementIssued: false });
  });

  it('a wrong-account purchase is indistinguishable from an absent one', async () => {
    state.outcome = { ok: false, error: 'purchase_not_found' };
    const res = await POST(req({ purchaseId: PURCHASE }));
    const body = await res.json();
    expect(res.status).toBe(404);
    // Nothing about the real owner leaks — no account, no grant, no product.
    expect(JSON.stringify(body)).not.toMatch(/acct|owner|grant_id|PASS_/i);
  });

  it('never returns a raw Apple transaction id, appAccountToken or JWS', async () => {
    const res = await POST(req({ purchaseId: PURCHASE }));
    const body = JSON.stringify(await res.json());
    expect(body).not.toMatch(/2000000900000001/);
    expect(body).toMatch(/9a4eafea51f2…/); // the fingerprint, which is what R2 compares
    expect(body).not.toMatch(/signedTransaction|jws/i);
  });
});
