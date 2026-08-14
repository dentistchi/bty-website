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

  // EVOLVED by BUILD 26T-R1A-R2. This test previously asserted `409 product_inactive`, and under
  // the contract of BUILD 26L/26P/26R/26S that was correct: there was no shipping purchase path,
  // so the gate could only ever refuse a transaction we had no way to have originated. BUILD 26T
  // shipped that path, and the same refusal became a post-charge veto — it stranded money Apple
  // had already taken. `is_active` is now the authority to START a charge, not to settle one.
  it('INACTIVE product -> 200: the money was already taken, so it settles', async () => {
    state.product = { productCode: 'PASS_1H', isActive: false };
    const res = await POST(req(GOOD));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true, verified: true, recorded: true, entitlementIssued: false, replayed: false,
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

  // EVOLVED by BUILD 26T-R1A-R2 — see the note above. A replay of a genuine transaction whose
  // product is now switched off converges rather than being refused; this is the exact shape the
  // existing Sandbox transaction takes on production, where PASS_1H is inactive.
  it('inactive-product replay -> 200 with replayed:true', async () => {
    state.record = { ok: true, purchaseId: 'p-1', productCode: 'PASS_1H', replayed: true };
    const res = await POST(req(GOOD));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, recorded: true, replayed: true, purchaseId: 'p-1' });
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

// BUILD 26T-R1A-R1 — production fulfil addressability.
//
// A verified purchase that cannot be named cannot be settled. `/fulfil` and `/fulfilment` both
// take the durable `karaoke_apple_purchases.id`, and until now `/verify` computed it and threw it
// away. These tests pin the additive disclosure AND its boundary: accepted transactions become
// addressable, refused ones do not.
describe('BUILD 26T-R1A-R1 — the accepted purchase is addressable', () => {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ROW = '28ab7288-ed3b-43b6-acef-484d1f635032';

  it('a first successful verification returns the durable row id', async () => {
    state.product = { productCode: 'PASS_1H', isActive: true };
    state.record = { ok: true, purchaseId: ROW, productCode: 'PASS_1H', replayed: false };
    const res = await POST(req(GOOD));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.purchaseId).toBe(ROW);
    expect(body.purchaseId).toMatch(UUID_RE);
    // Additive: every BUILD 26P field keeps its name and meaning.
    expect(body).toMatchObject({
      ok: true, verified: true, recorded: true, entitlementIssued: false,
      replayed: false, productCode: 'PASS_1H',
    });
  });

  it('a replay returns the IDENTICAL id — the second call addresses the first row', async () => {
    state.product = { productCode: 'PASS_1H', isActive: true };
    state.record = { ok: true, purchaseId: ROW, productCode: 'PASS_1H', replayed: false };
    const first = await (await POST(req(GOOD))).json();
    // What the ledger reports on a conflict: the durable winner, flagged as a replay.
    state.record = { ok: true, purchaseId: ROW, productCode: 'PASS_1H', replayed: true };
    const second = await (await POST(req(GOOD))).json();
    expect(second.replayed).toBe(true);
    expect(second.purchaseId).toBe(first.purchaseId);
  });

  it('it is the ledger row id, never anything derived from Apple', async () => {
    // C.5: the identifier must not be the transaction id, the original transaction id, the
    // appAccountToken or the product — those are Apple's values and are not ours to hand back as
    // an address.
    state.product = { productCode: 'PASS_1H', isActive: true };
    state.record = { ok: true, purchaseId: ROW, productCode: 'PASS_1H', replayed: false };
    const body = await (await POST(req(GOOD))).json();
    expect(body.purchaseId).not.toBe('2000000900000001');
    expect(body.purchaseId).not.toBe(OWNER);
    expect(body.purchaseId).not.toBe('com.btydaily.norebang.pass.1hour');
    // And exactly one internal field is disclosed — no account id, no row internals.
    expect(Object.keys(body).sort()).toEqual(
      ['entitlementIssued', 'ok', 'productCode', 'purchaseId', 'recorded', 'replayed', 'verified']);
  });

  it('NO refusal discloses a purchase id', async () => {
    // C.8. Each case is a refusal the endpoint already had; none of them gains addressability.
    const cases: Array<[string, () => void]> = [
      ['unverifiable JWS', () => { state.verify = { ok: false, code: 'invalid_apple_signature' }; }],
      ['wrong appAccountToken', () => {
        state.verify = { ok: true, claims: claims({ appAccountToken: '99999999-2222-4333-8444-555555555555' }), environment: 'Sandbox' };
      }],
      ['missing appAccountToken', () => {
        state.verify = { ok: true, claims: claims({ appAccountToken: undefined }), environment: 'Sandbox' };
      }],
      ['environment mismatch', () => {
        state.verify = { ok: true, claims: claims({ environment: 'Production' }), environment: 'Sandbox' };
      }],
      ['unknown product', () => { state.product = null; }],
      ['revoked transaction', () => {
        state.product = { productCode: 'PASS_1H', isActive: true };
        state.verify = { ok: true, claims: claims({ revocationDate: 1_760_000_500_000, revocationReason: 1 }), environment: 'Sandbox' };
      }],
      ['claimed by another account', () => { state.record = { ok: false, code: 'transaction_already_claimed' }; }],
      ['ledger invariant conflict', () => { state.record = { ok: false, code: 'ledger_invariant_conflict' }; }],
    ];
    for (const [name, set] of cases) {
      state.account = { id: 'acct-1' };
      state.ownerRef = OWNER;
      state.verify = { ok: true, claims: claims(), environment: 'Sandbox' };
      state.product = { productCode: 'PASS_1H', isActive: true };
      state.record = { ok: true, purchaseId: ROW, productCode: 'PASS_1H', replayed: false };
      set();
      const res = await POST(req(GOOD));
      const body = await res.json();
      expect(res.status, name).not.toBe(200);
      expect(body.ok, name).toBe(false);
      expect(body.purchaseId, name).toBeUndefined();
      expect(JSON.stringify(body), name).not.toContain(ROW);
    }
  });

  // EVOLVED by BUILD 26T-R1A-R2. R1A-R1 deliberately left the inactive branch alone and recorded
  // that making it addressable was R1A-R2's decision to take. R1A-R2 took it: an inactive product
  // no longer vetoes settlement, so the transaction is accepted and therefore addressable — which
  // is precisely what lets the existing production Sandbox transaction be used as evidence while
  // PASS_1H stays inactive.
  it('an INACTIVE product is now settleable, and therefore addressable', async () => {
    state.product = { productCode: 'PASS_1H', isActive: false };
    state.record = { ok: true, purchaseId: ROW, productCode: 'PASS_1H', replayed: false };
    const res = await POST(req(GOOD));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true, verified: true, recorded: true, entitlementIssued: false, replayed: false,
    });
    expect(body.purchaseId).toBe(ROW);
  });

  it('addressability is not fulfilment — the route still grants nothing', async () => {
    state.product = { productCode: 'PASS_1H', isActive: true };
    state.record = { ok: true, purchaseId: ROW, productCode: 'PASS_1H', replayed: false };
    const body = await (await POST(req(GOOD))).json();
    expect(body.entitlementIssued).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/passGrantId|grantedSeconds|fulfil/i);
    // Structural: this endpoint calls no fulfilment path and no pass issuer.
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync(`${process.cwd()}/src/app/api/host/purchases/apple/verify/route.ts`, 'utf8'));
    expect(src).not.toMatch(/fulfilApplePurchase|fulfil_apple_purchase|readApplePurchaseFulfilment/);
    // And it reads the id it already had — no second query invented to produce one.
    expect(src).toMatch(/purchaseId: outcome\.purchaseId/);
    expect(src.match(/recordVerifiedApplePurchase\(/g) ?? []).toHaveLength(1);
  });
});

// BUILD 26T-R1A-R2 — the money boundary.
//
// `is_active` authorizes STARTING a new Apple charge. Once Apple has charged the customer that
// decision is spent, and a switch must not be able to strand their money. These tests pin the
// evolved contract AND, just as importantly, that nothing else moved with it: every other refusal
// on this route must still refuse an inactive product exactly as it refuses an active one.
describe('BUILD 26T-R1A-R2 — is_active is not a post-charge veto', () => {
  const ROW = '28ab7288-ed3b-43b6-acef-484d1f635032';

  function inactive() {
    state.product = { productCode: 'PASS_1H', isActive: false };
    state.record = { ok: true, purchaseId: ROW, productCode: 'PASS_1H', replayed: false };
  }

  it('the TOCTOU order settles: active at T0, deactivated by the time /verify runs', async () => {
    // T0 the client's just-in-time read said active, so the charge was authorized.
    state.product = { productCode: 'PASS_1H', isActive: true };
    const authorizedAtStart = await (await POST(req(GOOD))).json();
    expect(authorizedAtStart.ok).toBe(true);

    // T1 Apple charges. T2 an operator deactivates the product. T3/T4 the SAME transaction is
    // verified — and must still converge, because the money has already moved.
    state.product = { productCode: 'PASS_1H', isActive: false };
    state.record = { ok: true, purchaseId: ROW, productCode: 'PASS_1H', replayed: true };
    const res = await POST(req(GOOD));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, verified: true, recorded: true, replayed: true });
    expect(body.purchaseId).toBe(ROW);
    expect(body.error).toBeUndefined();
  });

  it('no response says product_inactive any more, on any inactive path', async () => {
    for (const replayed of [false, true]) {
      inactive();
      state.record = { ok: true, purchaseId: ROW, productCode: 'PASS_1H', replayed };
      const body = await (await POST(req(GOOD))).json();
      expect(JSON.stringify(body)).not.toContain('product_inactive');
    }
  });

  it('a replay while inactive returns the identical purchaseId', async () => {
    inactive();
    const first = await (await POST(req(GOOD))).json();
    state.record = { ok: true, purchaseId: ROW, productCode: 'PASS_1H', replayed: true };
    const second = await (await POST(req(GOOD))).json();
    expect(second.replayed).toBe(true);
    expect(second.purchaseId).toBe(first.purchaseId);
  });

  it('settlement is still NOT granted here — /verify remains VERIFY + RECORD', async () => {
    inactive();
    const body = await (await POST(req(GOOD))).json();
    expect(body.entitlementIssued).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/passGrantId|grantedSeconds/);
  });

  // ---- what did NOT change: every other refusal, measured against an INACTIVE product ----------
  it('an UNKNOWN product is still refused — identity is not activation', async () => {
    // The distinction the whole slice rests on: a known product that is switched off is still a
    // known product, and an unknown one is still unknown. Only the second is a refusal.
    inactive();
    state.product = null;
    const res = await POST(req(GOOD));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('unknown_product');
    expect(recordVerifiedApplePurchase).not.toHaveBeenCalled();
  });

  it('every non-activation refusal still fires while the product is inactive', async () => {
    const cases: Array<[string, number, string, () => void]> = [
      ['invalid JWS', 422, 'invalid_apple_signature',
        () => { state.verify = { ok: false, code: 'invalid_apple_signature' }; }],
      ['owner/appAccountToken mismatch', 403, 'account_binding_mismatch',
        () => { state.verify = { ok: true, claims: claims({ appAccountToken: '99999999-2222-4333-8444-555555555555' }), environment: 'Sandbox' }; }],
      ['environment mismatch', 422, 'environment_mismatch',
        () => { state.verify = { ok: true, claims: claims({ environment: 'Production' }), environment: 'Sandbox' }; }],
      ['claimed by another account', 409, 'transaction_already_claimed',
        () => { state.record = { ok: false, code: 'transaction_already_claimed' }; }],
      ['revoked transaction', 422, 'revoked_transaction',
        () => { state.verify = { ok: true, claims: claims({ revocationDate: 1_760_000_500_000, revocationReason: 1 }), environment: 'Sandbox' }; }],
    ];
    for (const [name, status, error, set] of cases) {
      state.account = { id: 'acct-1' };
      state.ownerRef = OWNER;
      state.verify = { ok: true, claims: claims(), environment: 'Sandbox' };
      inactive();
      set();
      const res = await POST(req(GOOD));
      const body = await res.json();
      expect(res.status, name).toBe(status);
      expect(body.ok, name).toBe(false);
      if (error !== 'environment_mismatch') expect(body.error, name).toBe(error);
      // And a refusal still discloses no durable address.
      expect(body.purchaseId, name).toBeUndefined();
    }
  });

  it('the veto is gone from the source, and its absence is documented', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync(`${process.cwd()}/src/app/api/host/purchases/apple/verify/route.ts`, 'utf8'));
    // No branch may refuse on the current activation flag.
    expect(src).not.toMatch(/if \(!product\.isActive\)/);
    expect(src).not.toMatch(/'product_inactive'/);
    // Identity resolution stays — an unknown product is still refused.
    expect(src).toMatch(/unknown_product/);
    // And the omission is stated, so it cannot be "tidied" back in by a future reader.
    expect(src).toMatch(/THERE IS NO `is_active` CHECK HERE ANY MORE, AND ITS ABSENCE IS THE CONTRACT/);
  });
});
