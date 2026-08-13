// BUILD 26P — the domain half: what a VERIFIED Apple transaction must say before we record it.
//
// Everything here assumes the signature and chain already verified. These rules are the second
// half of the gate: a genuine Apple transaction for someone else's app, someone else's account,
// or a product we do not sell is still not ours to record as this Host's purchase.

import { describe, it, expect } from 'vitest';
import {
  validateAppleTransaction,
  ACCEPTED_TRANSACTION_TYPES,
  type AppleTransactionClaims,
} from './apple-transaction';

const OWNER = '11111111-2222-4333-8444-555555555555';
const BUNDLE = 'com.bty.BTYNorebangAdmin';

const claims = (o: Partial<AppleTransactionClaims> = {}): AppleTransactionClaims => ({
  transactionId: '2000000900000001',
  originalTransactionId: '2000000900000001',
  bundleId: BUNDLE,
  productId: 'com.btydaily.norebang.pass.1hour',
  purchaseDate: 1_760_000_000_000,
  quantity: 1,
  type: 'Consumable',
  environment: 'Sandbox',
  appAccountToken: OWNER,
  ...o,
});

const run = (o: Partial<AppleTransactionClaims> = {}, over: Partial<Parameters<typeof validateAppleTransaction>[0]> = {}) =>
  validateAppleTransaction({
    claims: claims(o),
    expectedBundleId: BUNDLE,
    verifiedEnvironment: 'Sandbox',
    expectedAppAccountToken: OWNER,
    ...over,
  });

describe('BUILD 26P domain — acceptance', () => {
  it('accepts a well-formed transaction and normalises it', () => {
    const out = run();
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.transaction.transactionId).toBe('2000000900000001');
    expect(out.transaction.environment).toBe('Sandbox');
    expect(out.transaction.quantity).toBe(1);
    expect(out.transaction.purchaseDate).toBe(new Date(1_760_000_000_000).toISOString());
    expect(out.transaction.revoked).toBe(false);
  });

  it('defaults originalTransactionId to transactionId on a first purchase', () => {
    const out = run({ originalTransactionId: undefined });
    expect(out.ok && out.transaction.originalTransactionId).toBe('2000000900000001');
  });

  it('ships consumables only — that is the BUILD 18C product contract', () => {
    expect([...ACCEPTED_TRANSACTION_TYPES]).toEqual(['Consumable']);
  });
});

describe('BUILD 26P domain — this app, this environment', () => {
  it('REJECTS another app\'s bundle id', () => {
    const out = run({ bundleId: 'com.someone.else' });
    expect(out.ok === false && out.code).toBe('wrong_bundle_id');
  });

  it('accepts Production down a Production-verified path', () => {
    const out = run({ environment: 'Production' }, { verifiedEnvironment: 'Production' });
    expect(out.ok && out.transaction.environment).toBe('Production');
  });

  it('REJECTS a Sandbox payload down a Production-verified path', () => {
    const out = run({ environment: 'Sandbox' }, { verifiedEnvironment: 'Production' });
    expect(out.ok === false && out.code).toBe('environment_mismatch');
  });

  it('REJECTS a Production payload down a Sandbox-verified path', () => {
    const out = run({ environment: 'Production' }, { verifiedEnvironment: 'Sandbox' });
    expect(out.ok === false && out.code).toBe('environment_mismatch');
  });

  it('REJECTS an environment Apple never issues', () => {
    const out = run({ environment: 'Staging' });
    expect(out.ok === false && out.code).toBe('environment_not_accepted');
  });

  it('never normalises Sandbox and Production together', () => {
    // The two are separate ID spaces (BUILD 26L FD-3). If this ever collapsed, a sandbox
    // transaction could be mistaken for a paid one.
    expect((run({ environment: 'Production' }, { verifiedEnvironment: 'Sandbox' }) as { code: string }).code)
      .toBe('environment_mismatch');
  });
});

describe('BUILD 26P domain — account binding is mandatory', () => {
  it('accepts a matching appAccountToken', () => {
    expect(run({ appAccountToken: OWNER }).ok).toBe(true);
  });

  it('matches case-insensitively and ignores surrounding whitespace', () => {
    expect(run({ appAccountToken: `  ${OWNER.toUpperCase()}  ` }).ok).toBe(true);
  });

  it('REJECTS a missing appAccountToken — there is NO legacy bypass', () => {
    // There are zero legacy Apple purchases, so a bypass would serve no real population and
    // would only create a way to land a payment on the wrong account.
    const out = run({ appAccountToken: undefined });
    expect(out.ok === false && out.code).toBe('missing_app_account_token');
  });

  it('REJECTS a non-UUID appAccountToken', () => {
    const out = run({ appAccountToken: 'not-a-uuid' });
    expect(out.ok === false && out.code).toBe('missing_app_account_token');
  });

  it('REJECTS another account\'s appAccountToken', () => {
    const out = run({ appAccountToken: '99999999-9999-4999-8999-999999999999' });
    expect(out.ok === false && out.code).toBe('account_binding_mismatch');
  });
});

describe('BUILD 26P domain — product contract', () => {
  it('REJECTS an auto-renewable subscription', () => {
    const out = run({ type: 'Auto-Renewable Subscription' });
    expect(out.ok === false && out.code).toBe('unsupported_transaction_type');
  });

  it('REJECTS quantity 0 and negative quantities', () => {
    expect((run({ quantity: 0 }) as { code: string }).code).toBe('invalid_quantity');
    expect((run({ quantity: -1 }) as { code: string }).code).toBe('invalid_quantity');
  });

  it('defaults a missing quantity to 1', () => {
    expect(run({ quantity: undefined }).ok && (run({ quantity: undefined }) as never as { transaction: { quantity: number } }).transaction.quantity).toBe(1);
  });

  it('REJECTS a malformed transaction id or product id', () => {
    expect((run({ transactionId: '' }) as { code: string }).code).toBe('malformed_transaction');
    expect((run({ productId: undefined }) as { code: string }).code).toBe('malformed_transaction');
    expect((run({ bundleId: undefined }) as { code: string }).code).toBe('malformed_transaction');
  });
});

describe('BUILD 26P domain — revocation is classified, never granted', () => {
  it('marks a revoked transaction as revoked', () => {
    const out = run({ revocationDate: 1_760_000_500_000, revocationReason: 1 });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.transaction.revoked).toBe(true);
    expect(out.transaction.revocationDate).toBe(new Date(1_760_000_500_000).toISOString());
    expect(out.transaction.revocationReason).toBe(1);
  });

  it('a non-revoked transaction carries no revocation fields', () => {
    const out = run();
    expect(out.ok && out.transaction.revocationDate).toBeNull();
  });
});
