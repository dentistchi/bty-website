// POST /api/host/purchases/apple/verify — BUILD 26P, Track B Slice 3.
//
// The contract under test is VERIFY + RECORD. The single most important assertion in this file is
// the negative one: no path, on any outcome, creates a Timed Pass grant or reports
// entitlementIssued: true. A verification endpoint that quietly started granting access would be
// the whole trust boundary collapsing into one function.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  account: { id: 'acct-1' } as { id: string } | null,
  ownerRef: '11111111-2222-4333-8444-555555555555' as string | null,
  verify: null as unknown,
  product: { productCode: 'PASS_1H', isActive: false } as { productCode: string; isActive: boolean } | null,
  record: { ok: true, purchaseId: 'p-1', productCode: 'PASS_1H', replayed: false } as unknown,
};

vi.mock('@/lib/dj-auth.server', () => ({ bearerFromHeader: () => 'tok' }));
vi.mock('@/lib/host-web-session.server', () => ({ hostTokenFromRequest: () => null }));
vi.mock('@/lib/host-auth.server', () => ({ authorizeHost: async () => state.account }));
vi.mock('@/lib/env.server', () => ({ optionalEnv: () => undefined }));

const verifyAppleSignedTransaction = vi.fn(async (..._a: unknown[]) => state.verify);
const signedTransactionDigest = vi.fn(async () => 'd'.repeat(64));
vi.mock('@/lib/apple-iap.server', () => ({
  verifyAppleSignedTransaction: (...a: unknown[]) => verifyAppleSignedTransaction(...a),
  signedTransactionDigest: () => signedTransactionDigest(),
}));

const recordVerifiedApplePurchase = vi.fn(async (..._a: unknown[]) => state.record);
vi.mock('@/lib/apple-purchase-ledger.server', () => ({
  recordVerifiedApplePurchase: (...a: unknown[]) => recordVerifiedApplePurchase(...a),
  resolveCatalogProduct: async () => state.product,
  readPurchaseOwnerRef: async () => state.ownerRef,
}));

import { POST } from './route';

const OWNER = '11111111-2222-4333-8444-555555555555';

function claims(o: Record<string, unknown> = {}) {
  return {
    transactionId: '2000000900000001',
    originalTransactionId: '2000000900000001',
    bundleId: 'com.bty.BTYNorebangAdmin',
    productId: 'com.btydaily.norebang.pass.1hour',
    purchaseDate: 1_760_000_000_000,
    quantity: 1,
    type: 'Consumable',
    environment: 'Sandbox',
    appAccountToken: OWNER,
    ...o,
  };
}

function req(body: unknown) {
  return new Request('https://x/api/host/purchases/apple/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}

const GOOD = { signedTransaction: 'aaa.bbb.ccc' };

beforeEach(() => {
  state.account = { id: 'acct-1' };
  state.ownerRef = OWNER;
  state.verify = { ok: true, claims: claims(), environment: 'Sandbox' };
  state.product = { productCode: 'PASS_1H', isActive: false };
  state.record = { ok: true, purchaseId: 'p-1', productCode: 'PASS_1H', replayed: false };
  recordVerifiedApplePurchase.mockClear();
  verifyAppleSignedTransaction.mockClear();
});

describe('auth and request shape', () => {
  it('unauthenticated -> 401, nothing verified, nothing recorded', async () => {
    state.account = null;
    const res = await POST(req(GOOD));
    expect(res.status).toBe(401);
    expect(verifyAppleSignedTransaction).not.toHaveBeenCalled();
    expect(recordVerifiedApplePurchase).not.toHaveBeenCalled();
  });

  it('rejects extra keys — the body cannot carry Apple facts', async () => {
    // The strict schema is the structural half of the trust boundary: there is no accountId,
    // appAccountToken, transactionId, productId or environment to prefer over the payload.
    for (const extra of [
      { accountId: 'acct-2' },
      { appAccountToken: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' },
      { transactionId: '999' },
      { productId: 'com.btydaily.norebang.pass.24hour' },
      { environment: 'Production' },
      { bundleId: 'com.someone.else' },
      { purchaseOwnerRef: OWNER },
    ]) {
      const res = await POST(req({ ...GOOD, ...extra }));
      expect(res.status).toBe(400);
    }
    expect(recordVerifiedApplePurchase).not.toHaveBeenCalled();
  });

  it('rejects a missing or empty signedTransaction', async () => {
    expect((await POST(req({}))).status).toBe(400);
    expect((await POST(req({ signedTransaction: '' }))).status).toBe(400);
  });

  it('rejects a non-JSON body', async () => {
    const bad = new Request('https://x/api/host/purchases/apple/verify', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: 'not json',
    }) as unknown as import('next/server').NextRequest;
    expect((await POST(bad)).status).toBe(400);
  });
});

describe('cryptographic failure writes nothing', () => {
  it.each([
    'invalid_apple_signature',
    'untrusted_certificate_chain',
    'unsupported_algorithm',
    'certificate_expired',
    'intermediate_not_ca',
    'leaf_missing_apple_purpose',
    'malformed_signed_transaction',
  ])('%s -> 422, recorded:false', async (code) => {
    state.verify = { ok: false, code };
    const res = await POST(req(GOOD));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, error: code, verified: false, recorded: false, entitlementIssued: false });
    expect(recordVerifiedApplePurchase).not.toHaveBeenCalled();
  });
});

describe('account binding', () => {
  it('a transaction bound to another account -> 403, no write, no disclosure', async () => {
    state.verify = { ok: true, claims: claims({ appAccountToken: '99999999-9999-4999-8999-999999999999' }), environment: 'Sandbox' };
    const res = await POST(req(GOOD));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, error: 'account_binding_mismatch', recorded: false });
    // Nothing about the account it DOES belong to.
    expect(JSON.stringify(body)).not.toContain('99999999');
    expect(recordVerifiedApplePurchase).not.toHaveBeenCalled();
  });

  it('a missing appAccountToken -> 422, no write', async () => {
    state.verify = { ok: true, claims: claims({ appAccountToken: undefined }), environment: 'Sandbox' };
    const res = await POST(req(GOOD));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('missing_app_account_token');
    expect(recordVerifiedApplePurchase).not.toHaveBeenCalled();
  });

  it('the owner ref comes from the SESSION account, never the body', async () => {
    await POST(req(GOOD));
    const arg = recordVerifiedApplePurchase.mock.calls[0][0] as { accountId: string; purchaseOwnerRef: string };
    expect(arg.accountId).toBe('acct-1');
    expect(arg.purchaseOwnerRef).toBe(OWNER);
  });
});

describe('environment stays distinct', () => {
  it('a payload/verifier environment mismatch -> 422, no write', async () => {
    state.verify = { ok: true, claims: claims({ environment: 'Production' }), environment: 'Sandbox' };
    const res = await POST(req(GOOD));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('environment_mismatch');
    expect(recordVerifiedApplePurchase).not.toHaveBeenCalled();
  });

  it('records Sandbox as Sandbox', async () => {
    await POST(req(GOOD));
    const arg = recordVerifiedApplePurchase.mock.calls[0][0] as { transaction: { environment: string } };
    expect(arg.transaction.environment).toBe('Sandbox');
  });

  it('records Production as Production', async () => {
    state.verify = { ok: true, claims: claims({ environment: 'Production' }), environment: 'Production' };
    await POST(req(GOOD));
    const arg = recordVerifiedApplePurchase.mock.calls[0][0] as { transaction: { environment: string } };
    expect(arg.transaction.environment).toBe('Production');
  });
});

describe('catalog authority', () => {
  it('unknown product -> 422, no write, and no catalog row is invented', async () => {
    state.product = null;
    const res = await POST(req(GOOD));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('unknown_product');
    expect(recordVerifiedApplePurchase).not.toHaveBeenCalled();
  });

  it('INACTIVE product -> 409 product_inactive, but the purchase IS recorded', async () => {
    // Apple already charged the customer. Discarding a genuine transaction because our product is
    // switched off would lose their money silently, so it is recorded and preserved.
    state.product = { productCode: 'PASS_1H', isActive: false };
    const res = await POST(req(GOOD));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      ok: false, error: 'product_inactive', verified: true, recorded: true,
      entitlementIssued: false, replayed: false,
    });
    expect(recordVerifiedApplePurchase).toHaveBeenCalledTimes(1);
  });

  it('ACTIVE product -> 200, recorded, and STILL no entitlement in 26P', async () => {
    state.product = { productCode: 'PASS_1H', isActive: true };
    const res = await POST(req(GOOD));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true, verified: true, recorded: true, entitlementIssued: false, replayed: false,
    });
  });
});

describe('ledger outcomes', () => {
  it('same-account replay -> replayed:true, stable result', async () => {
    state.product = { productCode: 'PASS_1H', isActive: true };
    state.record = { ok: true, purchaseId: 'p-1', productCode: 'PASS_1H', replayed: true };
    const res = await POST(req(GOOD));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, replayed: true, entitlementIssued: false });
  });

  it('inactive-product replay -> 409 with replayed:true', async () => {
    state.record = { ok: true, purchaseId: 'p-1', productCode: 'PASS_1H', replayed: true };
    const res = await POST(req(GOOD));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ ok: false, error: 'product_inactive', recorded: true, replayed: true });
  });

  it('another account already owns the transaction -> 409, no disclosure', async () => {
    state.record = { ok: false, code: 'transaction_already_claimed' };
    const res = await POST(req(GOOD));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, error: 'transaction_already_claimed', entitlementIssued: false });
    expect(JSON.stringify(body)).not.toMatch(/acct-|account_id|purchaseId/);
  });

  it('a ledger invariant conflict -> 500, never a silent rewrite', async () => {
    state.record = { ok: false, code: 'ledger_invariant_conflict' };
    expect((await POST(req(GOOD))).status).toBe(500);
  });
});

describe('revoked transactions are recorded, never granted', () => {
  it('-> 422 revoked_transaction with recorded:true', async () => {
    state.verify = { ok: true, claims: claims({ revocationDate: 1_760_000_500_000, revocationReason: 1 }), environment: 'Sandbox' };
    state.product = { productCode: 'PASS_1H', isActive: true };
    const res = await POST(req(GOOD));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      ok: false, error: 'revoked_transaction', verified: true, recorded: true, entitlementIssued: false,
    });
  });
});

describe('BUILD 26P grants NOTHING, on every path', () => {
  it('no response ever reports entitlementIssued: true', async () => {
    const cases: Array<() => void> = [
      () => { state.product = { productCode: 'PASS_1H', isActive: true }; },
      () => { state.product = { productCode: 'PASS_1H', isActive: false }; },
      () => { state.record = { ok: true, purchaseId: 'p-1', productCode: 'PASS_1H', replayed: true }; },
      () => { state.verify = { ok: true, claims: claims({ revocationDate: 1_760_000_500_000 }), environment: 'Sandbox' }; },
      () => { state.verify = { ok: false, code: 'invalid_apple_signature' }; },
      () => { state.record = { ok: false, code: 'transaction_already_claimed' }; },
    ];
    for (const set of cases) {
      set();
      const body = await (await POST(req(GOOD))).json();
      if ('entitlementIssued' in body) expect(body.entitlementIssued).toBe(false);
      expect(JSON.stringify(body)).not.toContain('passGrantId');
    }
  });

  it('the route never asks anything to issue a pass', async () => {
    // Structural: the module imports no pass-issuance helper at all.
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync(`${process.cwd()}/src/app/api/host/purchases/apple/verify/route.ts`, 'utf8'));
    expect(src).not.toMatch(/issueTimedPass|issue_timed_access_pass|selectTimedPass/);
    expect(src).not.toMatch(/timed_access_pass_grants/);
  });

  it('NO response is an authorization to call Transaction.finish()', async () => {
    // BUILD 26P delivers no entitlement, so nothing here may be encoded as a fulfilment signal.
    // A future native slice must define its own durable fulfilment gate.
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync(`${process.cwd()}/src/app/api/host/purchases/apple/verify/route.ts`, 'utf8'));
    // No response field or flag may be readable as "you may finish now".
    expect(src).not.toMatch(/shouldFinish|canFinish|mayFinish|finishTransaction|fulfilled/);
    // And it is documented in the file, so the next reader cannot infer the opposite.
    expect(src).toMatch(/NO RESPONSE HERE AUTHORIZES `Transaction\.finish\(\)`/);
  });
});
