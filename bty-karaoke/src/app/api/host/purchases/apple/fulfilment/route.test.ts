// GET /api/host/purchases/apple/fulfilment — BUILD 26S-R1 durable read-back.
//
// This endpoint is the last clause of the BUILD 26S-R2 finish predicate, so the assertions that
// matter are about what makes `authorizesFinish` TRUE — and, far more importantly, all the ways it
// must stay FALSE. A read-back that returned true on a partially-linked ledger would authorize
// destroying a customer's re-presentable purchase evidence.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const state = {
  account: { id: 'acct-1' } as { id: string } | null,
  readback: null as unknown,
};

vi.mock('@/lib/dj-auth.server', () => ({ bearerFromHeader: () => 'tok' }));
vi.mock('@/lib/host-web-session.server', () => ({ hostTokenFromRequest: () => null }));
vi.mock('@/lib/host-auth.server', () => ({ authorizeHost: async () => state.account }));

const readApplePurchaseFulfilment = vi.fn(async (..._a: unknown[]) => state.readback);
vi.mock('@/lib/apple-fulfilment.server', () => ({
  readApplePurchaseFulfilment: (...a: unknown[]) => readApplePurchaseFulfilment(...a),
}));

import { GET } from './route';

const PURCHASE = '28ab7288-ed3b-43b6-acef-484d1f635032';
const GRANT = '99999999-8888-4777-8666-555555555555';

const LINKED = {
  purchaseId: PURCHASE,
  accountMatches: true,
  verificationStatus: 'VERIFIED',
  grantStatus: 'GRANTED',
  passGrantId: GRANT,
  grantedSeconds: 3600,
  environment: 'Sandbox',
  storekitProductId: 'com.btydaily.norebang.pass.1hour',
  productCode: 'PASS_1H',
  transactionFingerprint: '9a4eafea51f2…',
  appAccountTokenFingerprint: '8107d5628079…',
  grant: {
    id: GRANT,
    accountMatches: true,
    applePurchaseIdMatches: true,
    sourceType: 'PAID',
    isPaid: true,
    passType: 'ONE_HOUR',
    durationSeconds: 3600,
    status: 'AVAILABLE',
  },
  linkageVerified: true,
};

const req = (qs: string) =>
  new NextRequest(`https://x/api/host/purchases/apple/fulfilment${qs}`);

beforeEach(() => {
  state.account = { id: 'acct-1' };
  state.readback = { ...LINKED };
  readApplePurchaseFulfilment.mockClear();
});

describe('GET /api/host/purchases/apple/fulfilment', () => {
  it('a fully linked fulfilment reads back and authorizes finish', async () => {
    const res = await GET(req(`?purchaseId=${PURCHASE}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      purchaseId: PURCHASE,
      verificationStatus: 'VERIFIED',
      grantStatus: 'GRANTED',
      passGrantId: GRANT,
      grantedSeconds: 3600,
      linkageVerified: true,
      authorizesFinish: true,
      grant: { sourceType: 'PAID', isPaid: true, status: 'AVAILABLE' },
    });
  });

  it('scopes the read to the SESSION account', async () => {
    await GET(req(`?purchaseId=${PURCHASE}`));
    expect(readApplePurchaseFulfilment).toHaveBeenCalledWith({
      accountId: 'acct-1',
      purchaseId: PURCHASE,
    });
  });

  it('an unlinked purchase does NOT authorize finish', async () => {
    state.readback = {
      ...LINKED,
      grantStatus: 'NOT_GRANTED',
      passGrantId: null,
      grantedSeconds: null,
      grant: null,
      linkageVerified: false,
    };
    const res = await GET(req(`?purchaseId=${PURCHASE}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ linkageVerified: false, authorizesFinish: false });
  });

  it.each([
    ['the grant is not PAID', { grant: { ...LINKED.grant, sourceType: 'MANUAL_PROMOTIONAL', isPaid: false } }],
    ['the grant belongs elsewhere', { grant: { ...LINKED.grant, accountMatches: false } }],
    ['the grant points at another purchase', { grant: { ...LINKED.grant, applePurchaseIdMatches: false } }],
    ['the duration disagrees', { grant: { ...LINKED.grant, durationSeconds: 999 } }],
    ['verification is not VERIFIED', { verificationStatus: 'REVOKED' }],
  ])('%s -> finish is NOT authorized', async (_label, override) => {
    // The service computes linkageVerified; the route must never re-derive a friendlier answer.
    state.readback = { ...LINKED, ...override, linkageVerified: false };
    const res = await GET(req(`?purchaseId=${PURCHASE}`));
    expect(await res.json()).toMatchObject({ authorizesFinish: false });
  });

  it('unauthenticated -> 401', async () => {
    state.account = null;
    const res = await GET(req(`?purchaseId=${PURCHASE}`));
    expect(res.status).toBe(401);
    expect(readApplePurchaseFulfilment).not.toHaveBeenCalled();
  });

  it('a malformed or missing purchaseId never reaches the database', async () => {
    for (const qs of ['', '?purchaseId=', '?purchaseId=nope', '?purchaseId=1234']) {
      const res = await GET(req(qs));
      expect(res.status).toBe(400);
    }
    expect(readApplePurchaseFulfilment).not.toHaveBeenCalled();
  });

  it("another account's purchase reads as 404, not as a permission error", async () => {
    state.readback = null;
    const res = await GET(req(`?purchaseId=${PURCHASE}`));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ ok: false, error: 'purchase_not_found' });
  });

  it('is read-only: it exports no mutating verb', async () => {
    const mod = await import('./route');
    expect(Object.keys(mod).sort()).toEqual(['GET', 'dynamic', 'runtime']);
  });
});
