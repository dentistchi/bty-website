// BUILD 26P-R1.1 — the Apple parity matrix, as an executable document.
//
// TARGET: Apple's `SignedDataVerifier` for transaction JWS with **enableOnlineChecks = false**.
//
// This file exists so the comparison is a thing you can RUN, not a paragraph someone wrote once
// and stopped maintaining. Each row names an Apple behaviour, the BTY implementation, and a probe
// that fails if the behaviour is ever dropped. The one deliberate deviation — no OCSP — is listed
// with the same weight as the matches, because a deviation buried in implementation detail is how
// a security gap survives review.
//
// Apple's library is not importable here: its SignedDataVerifier requires Node's
// `crypto.X509Certificate`, which this Worker's compatibility layer defines as a throwing stub.
// The rows below are therefore behavioural parity, verified against our own implementation.

import { describe, it, expect, beforeAll } from 'vitest';
import {
  verifyAppleSignedTransaction,
  APPLE_LEAF_PURPOSE_OID,
  APPLE_INTERMEDIATE_PURPOSE_OID,
  APPLE_X5C_LENGTH,
} from './apple-iap.server';
import { APPLE_TRUSTED_ROOTS } from './apple-root-ca';
import { validateAppleTransaction } from '@/domain/apple-transaction';
import { buildTestPki, signTransaction, transactionPayload, type TestPki } from './apple-test-pki.fixture';

let pki: TestPki;
const verify = (jws: string, at?: Date) =>
  verifyAppleSignedTransaction(jws, { trustedRootsPem: [pki.rootPem], ...(at ? { at } : {}) });

beforeAll(async () => { pki = await buildTestPki(); });

const OWNER = '11111111-2222-4333-8444-555555555555';

describe('PARITY: SignedDataVerifier(enableOnlineChecks = false)', () => {
  it('x5c must be EXACTLY 3 — Apple requires three', async () => {
    expect(APPLE_X5C_LENGTH).toBe(3);
    for (const n of [1, 2, 4]) {
      const jws = await signTransaction(pki, transactionPayload(), {
        x5c: Array.from({ length: n }, (_, i) => pki.x5c[Math.min(i, 2)]),
      });
      expect((await verify(jws)).ok).toBe(false);
    }
    expect((await verify(await signTransaction(pki, transactionPayload()))).ok).toBe(true);
  });

  it('trusted roots are SERVER-supplied — x5c[2] is never an anchor', async () => {
    const attacker = await buildTestPki();
    // A complete, self-consistent attacker chain including its own root in x5c[2].
    const out = await verifyAppleSignedTransaction(await signTransaction(attacker, transactionPayload()), {
      trustedRootsPem: [pki.rootPem],
    });
    expect(out.ok === false && out.code).toBe('untrusted_certificate_chain');
  });

  it('leaf is signed by the intermediate', async () => {
    const bad = await buildTestPki({ leafSignedByWrongKey: true });
    const out = await verifyAppleSignedTransaction(await signTransaction(bad, transactionPayload()), {
      trustedRootsPem: [bad.rootPem],
    });
    expect(out.ok === false && out.code).toBe('untrusted_certificate_chain');
  });

  it('intermediate is signed by a trusted root', async () => {
    const other = await buildTestPki();
    const out = await verifyAppleSignedTransaction(await signTransaction(pki, transactionPayload()), {
      trustedRootsPem: [other.rootPem],
    });
    expect(out.ok === false && out.code).toBe('untrusted_certificate_chain');
  });

  it('issuer/subject LINKAGE is enforced, not just signature maths', async () => {
    const badInter = await buildTestPki({ intermediateWrongIssuerName: true });
    expect((await verifyAppleSignedTransaction(await signTransaction(badInter, transactionPayload()),
      { trustedRootsPem: [badInter.rootPem] })).ok).toBe(false);
    const badLeaf = await buildTestPki({ leafWrongIssuerName: true });
    const out = await verifyAppleSignedTransaction(await signTransaction(badLeaf, transactionPayload()),
      { trustedRootsPem: [badLeaf.rootPem] });
    expect(out.ok === false && out.code).toBe('certificate_issuer_mismatch');
  });

  it('intermediate must be a CA', async () => {
    const nonCa = await buildTestPki({ intermediateNotCa: true });
    const out = await verifyAppleSignedTransaction(await signTransaction(nonCa, transactionPayload()),
      { trustedRootsPem: [nonCa.rootPem] });
    expect(out.ok === false && out.code).toBe('intermediate_not_ca');
  });

  it('leaf carries Apple OID .6.11.1', async () => {
    expect(APPLE_LEAF_PURPOSE_OID).toBe('1.2.840.113635.100.6.11.1');
    const bad = await buildTestPki({ leafWithoutPurposeOid: true });
    const out = await verifyAppleSignedTransaction(await signTransaction(bad, transactionPayload()),
      { trustedRootsPem: [bad.rootPem] });
    expect(out.ok === false && out.code).toBe('leaf_missing_apple_purpose');
  });

  it('intermediate carries Apple OID .6.2.1', async () => {
    expect(APPLE_INTERMEDIATE_PURPOSE_OID).toBe('1.2.840.113635.100.6.2.1');
    const bad = await buildTestPki({ intermediateWithoutPurposeOid: true });
    const out = await verifyAppleSignedTransaction(await signTransaction(bad, transactionPayload()),
      { trustedRootsPem: [bad.rootPem] });
    expect(out.ok === false && out.code).toBe('intermediate_missing_apple_purpose');
  });

  it('certificate dates are evaluated at signedDate — leaf, intermediate AND root', async () => {
    // leaf window [-1d, +2d]; a signedDate inside it verifies even though "now" is outside.
    const shortLived = await buildTestPki({ leafNotBeforeDays: -1, leafNotAfterDays: 2 });
    const inside = await signTransaction(shortLived, transactionPayload({ signedDate: Date.now() + 86_400_000 }));
    expect((await verifyAppleSignedTransaction(inside, { trustedRootsPem: [shortLived.rootPem] })).ok).toBe(true);

    // leaf out of window at signedDate
    const outsideLeaf = await signTransaction(pki, transactionPayload({ signedDate: Date.now() + 150 * 86_400_000 }));
    expect((await verify(outsideLeaf) as { code: string }).code).toBe('certificate_expired');

    // root out of window at signedDate -> cannot anchor at all
    const outsideRoot = await signTransaction(pki, transactionPayload({ signedDate: Date.now() + 400 * 86_400_000 }));
    expect((await verify(outsideRoot) as { code: string }).code).toBe('untrusted_certificate_chain');
  });

  it('ES256 is pinned', async () => {
    for (const alg of ['none', 'HS256', 'RS256', 'ES384']) {
      const out = await verify(await signTransaction(pki, transactionPayload(), { alg }));
      expect(out.ok === false && out.code).toBe('unsupported_algorithm');
    }
  });

  it('the JWS signature is verified under the leaf key', async () => {
    const out = await verify(await signTransaction(pki, transactionPayload(), { tamperSignature: true }));
    expect(out.ok === false && out.code).toBe('invalid_apple_signature');
  });

  it('bundleId and environment are enforced AFTER verification, from the verified payload', async () => {
    const jws = await signTransaction(pki, transactionPayload());
    const v = await verify(jws);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(validateAppleTransaction({
      claims: v.claims, expectedBundleId: 'com.someone.else',
      verifiedEnvironment: v.environment, expectedAppAccountToken: OWNER,
    })).toMatchObject({ ok: false, code: 'wrong_bundle_id' });
    expect(validateAppleTransaction({
      claims: v.claims, expectedBundleId: 'com.bty.BTYNorebangAdmin',
      verifiedEnvironment: 'Production', expectedAppAccountToken: OWNER,
    })).toMatchObject({ ok: false, code: 'environment_mismatch' });
  });
});

describe('PARITY: deliberate deviations, stated not buried', () => {
  it('OCSP is OFF — and it is off in the Apple mode we target too', () => {
    // enableOnlineChecks=false is the comparison mode. We do NOT claim parity with Apple's
    // enableOnlineChecks=true path: no revocation lookup happens here, so a certificate revoked
    // by Apple mid-life would still verify offline. Apple's own offline mode behaves the same.
    // Transaction-level revocation (refunds) IS handled — from the payload's revocationDate.
    const src = String(verifyAppleSignedTransaction);
    expect(src).not.toMatch(/ocsp|crl/i);
  });

  it('no Apple credential of any kind is required or present', () => {
    // Offline verification needs only Apple's PUBLIC root. This is why the deployment holds no
    // issuer id, key id or private key — the same property apple-auth.server.ts documents.
    expect(APPLE_TRUSTED_ROOTS).toHaveLength(1);
    const src = String(verifyAppleSignedTransaction);
    expect(src).not.toMatch(/issuerId|keyId|privateKey|Bearer/);
  });

  it('App Store Server API is NOT called during verification', () => {
    const src = String(verifyAppleSignedTransaction);
    expect(src).not.toMatch(/fetch\(|api\.storekit|appstoreconnect/i);
  });
});
