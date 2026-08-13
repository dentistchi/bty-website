// BUILD 26P — the cryptographic half of Apple transaction verification.
//
// These tests run the REAL verifier against a REAL certificate hierarchy. Nothing is stubbed:
// every rejection below is produced by minting an actual attack — a self-supplied root, a leaf
// signed by the wrong key, a non-CA intermediate — and watching the production code refuse it.
//
// The failure this file exists to prevent is the comfortable one: "the JWS signature verified,
// therefore the transaction is genuine". A signature verifies against whatever key the attacker
// put in the header. Only anchoring the chain to a root WE supply makes it mean anything.

import { describe, it, expect, beforeAll } from 'vitest';
import {
  verifyAppleSignedTransaction,
  signedTransactionDigest,
  APPLE_LEAF_PURPOSE_OID,
  APPLE_INTERMEDIATE_PURPOSE_OID,
  APPLE_X5C_LENGTH,
  MAX_SIGNED_TRANSACTION_BYTES,
} from './apple-iap.server';
import { APPLE_ROOT_CA_G3_PEM, APPLE_ROOT_CA_G3_SHA256, APPLE_TRUSTED_ROOTS } from './apple-root-ca';
import {
  buildTestPki, signTransaction, transactionPayload,
  INTERMEDIATE_PURPOSE_OID, type TestPki,
} from './apple-test-pki.fixture';

let pki: TestPki;
const roots = () => [pki.rootPem];

async function verify(jws: string, opts: Parameters<typeof verifyAppleSignedTransaction>[1] = {}) {
  return verifyAppleSignedTransaction(jws, { trustedRootsPem: roots(), ...opts });
}

beforeAll(async () => {
  pki = await buildTestPki();
});

describe('BUILD 26P — the trust anchor', () => {
  it('pins Apple Root CA G3 by value, and the bytes have not drifted', async () => {
    const der = Uint8Array.from(
      atob(APPLE_ROOT_CA_G3_PEM.replace(/-----[^-]+-----|\s/g, '')),
      (c) => c.charCodeAt(0),
    );
    const digest = await crypto.subtle.digest('SHA-256', der);
    const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    expect(hex).toBe(APPLE_ROOT_CA_G3_SHA256);
  });

  it('ships Apple\'s DOCUMENTED root set, G3 first', () => {
    // R1.2: three roots, per Apple's App Store Server Library README. G3 leads because it is the
    // anchor the real chain uses today; order is efficiency only — see apple-real-chain.test.ts,
    // which proves a wider set does not widen what is accepted.
    expect(APPLE_TRUSTED_ROOTS).toHaveLength(3);
    expect(APPLE_TRUSTED_ROOTS[0]).toBe(APPLE_ROOT_CA_G3_PEM);
  });

  it('a real Apple-rooted verifier rejects our TEST chain — the anchor is doing the work', async () => {
    // Same JWS, default (real Apple) roots: it must fail. If this ever passes, the anchor is
    // not being consulted and every other test in this file is meaningless.
    const jws = await signTransaction(pki, transactionPayload());
    const out = await verifyAppleSignedTransaction(jws);
    expect(out.ok).toBe(false);
    expect(out.ok === false && out.code).toBe('untrusted_certificate_chain');
  });
});

describe('BUILD 26P — a well-formed, correctly signed transaction', () => {
  it('verifies and returns the claims', async () => {
    const jws = await signTransaction(pki, transactionPayload());
    const out = await verify(jws);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.claims.transactionId).toBe('2000000900000001');
    expect(out.environment).toBe('Sandbox');
  });

  it('reads Production as Production', async () => {
    const jws = await signTransaction(pki, transactionPayload({ environment: 'Production' }));
    const out = await verify(jws);
    expect(out.ok && out.environment).toBe('Production');
  });

  it('digests the exact compact JWS', async () => {
    const jws = await signTransaction(pki, transactionPayload());
    expect(await signedTransactionDigest(jws)).toMatch(/^[0-9a-f]{64}$/);
    expect(await signedTransactionDigest(jws)).toBe(await signedTransactionDigest(jws));
  });
});

describe('BUILD 26P — chain trust cannot be self-supplied', () => {
  it('REJECTS an attacker chain whose own root is offered in x5c', async () => {
    // The whole attack: mint a complete hierarchy, sign a perfectly consistent JWS, and ship the
    // root inside the header. Self-consistency must not be trust.
    const attacker = await buildTestPki();
    const jws = await signTransaction(attacker, transactionPayload());
    const out = await verify(jws); // anchored to OUR root, not the attacker's
    expect(out.ok).toBe(false);
    expect(out.ok === false && out.code).toBe('untrusted_certificate_chain');
  });

  it('REJECTS a chain anchored to the wrong root', async () => {
    const other = await buildTestPki();
    const jws = await signTransaction(pki, transactionPayload());
    const out = await verifyAppleSignedTransaction(jws, { trustedRootsPem: [other.rootPem] });
    expect(out.ok === false && out.code).toBe('untrusted_certificate_chain');
  });

  it('REJECTS a leaf the intermediate did not sign (correct DN, wrong signing key)', async () => {
    // Issuer DN is the intermediate's subject, so the linkage check PASSES and only the signature
    // check can reject it. This keeps the signature path covered now that linkage exists.
    const forged = await buildTestPki({ leafSignedByWrongKey: true });
    const jws = await signTransaction(forged, transactionPayload());
    const out = await verifyAppleSignedTransaction(jws, { trustedRootsPem: [forged.rootPem] });
    expect(out.ok === false && out.code).toBe('untrusted_certificate_chain');
  });

  it('REJECTS a leaf issued by the ROOT rather than the intermediate', async () => {
    // Here the issuer DN itself is wrong, so linkage rejects it first — a distinct, earlier failure.
    const forged = await buildTestPki({ leafSignedByRoot: true });
    const jws = await signTransaction(forged, transactionPayload());
    const out = await verifyAppleSignedTransaction(jws, { trustedRootsPem: [forged.rootPem] });
    expect(out.ok === false && out.code).toBe('certificate_issuer_mismatch');
  });

  it('REJECTS an intermediate that is not a CA', async () => {
    const nonCa = await buildTestPki({ intermediateNotCa: true });
    const jws = await signTransaction(nonCa, transactionPayload());
    const out = await verifyAppleSignedTransaction(jws, { trustedRootsPem: [nonCa.rootPem] });
    expect(out.ok === false && out.code).toBe('intermediate_not_ca');
  });

  it('REJECTS a leaf without Apple\'s signed-data purpose OID', async () => {
    const noOid = await buildTestPki({ leafWithoutPurposeOid: true });
    const jws = await signTransaction(noOid, transactionPayload());
    const out = await verifyAppleSignedTransaction(jws, { trustedRootsPem: [noOid.rootPem] });
    expect(out.ok === false && out.code).toBe('leaf_missing_apple_purpose');
    expect(APPLE_LEAF_PURPOSE_OID).toBe('1.2.840.113635.100.6.11.1');
  });

  // R1.1 — Apple requires the INTERMEDIATE marker too. R1 enforced only the leaf, so a chain
  // whose every signature was valid but whose intermediate was issued for a different Apple
  // purpose would have been accepted.
  it('REJECTS an intermediate without Apple\'s WWDR purpose OID', async () => {
    const noOid = await buildTestPki({ intermediateWithoutPurposeOid: true });
    const jws = await signTransaction(noOid, transactionPayload());
    const out = await verifyAppleSignedTransaction(jws, { trustedRootsPem: [noOid.rootPem] });
    expect(out.ok === false && out.code).toBe('intermediate_missing_apple_purpose');
    expect(APPLE_INTERMEDIATE_PURPOSE_OID).toBe('1.2.840.113635.100.6.2.1');
    expect(INTERMEDIATE_PURPOSE_OID).toBe(APPLE_INTERMEDIATE_PURPOSE_OID);
  });
});

describe('BUILD 26P-R1.1 — issuer/subject linkage, not just signature maths', () => {
  // Both fixtures below are signed by the CORRECT private keys, so every signature verifies.
  // Only the semantic DN linkage can reject them.
  it('REJECTS an intermediate whose issuer is not the trusted root\'s subject', async () => {
    const bad = await buildTestPki({ intermediateWrongIssuerName: true });
    const jws = await signTransaction(bad, transactionPayload());
    const out = await verifyAppleSignedTransaction(jws, { trustedRootsPem: [bad.rootPem] });
    expect(out.ok).toBe(false);
    expect(out.ok === false && out.code).toBe('untrusted_certificate_chain');
  });

  it('REJECTS a leaf whose issuer is not the intermediate\'s subject', async () => {
    const bad = await buildTestPki({ leafWrongIssuerName: true });
    const jws = await signTransaction(bad, transactionPayload());
    const out = await verifyAppleSignedTransaction(jws, { trustedRootsPem: [bad.rootPem] });
    expect(out.ok).toBe(false);
    expect(out.ok === false && out.code).toBe('certificate_issuer_mismatch');
  });
});

describe('BUILD 26P — certificate validity uses an explicit effective date', () => {
  it('REJECTS a leaf expired AT ITS OWN signedDate', async () => {
    // +150d is INSIDE the root (365d) and intermediate (200d) windows but OUTSIDE the leaf's
    // (100d), isolating leaf expiry.
    const jws = await signTransaction(pki, transactionPayload({ signedDate: Date.now() + 150 * 86_400_000 }));
    const out = await verify(jws);
    expect(out.ok === false && out.code).toBe('certificate_expired');
  });

  it('REJECTS a leaf not yet valid at signedDate', async () => {
    const future = await buildTestPki({ leafNotBeforeDays: 10, leafNotAfterDays: 100 });
    const jws = await signTransaction(future, transactionPayload({ signedDate: Date.now() }));
    const out = await verifyAppleSignedTransaction(jws, { trustedRootsPem: [future.rootPem] });
    expect(out.ok === false && out.code).toBe('certificate_expired');
  });

  it('REJECTS everything once the trust ANCHOR is invalid at signedDate', async () => {
    const jws = await signTransaction(pki, transactionPayload({ signedDate: Date.now() + 400 * 86_400_000 }));
    const out = await verify(jws);
    expect(out.ok === false && out.code).toBe('untrusted_certificate_chain');
  });

  it('ACCEPTS a certificate valid at signedDate even though it is expired TODAY', async () => {
    // This is the whole reason Apple's offline mode dates the chain by signedDate: a genuine old
    // transaction must stay verifiable after its signing certificate has rotated out. Leaf window
    // is [-1d, +2d]; signedDate sits inside it; "now" for the test is far past it.
    const shortLived = await buildTestPki({ leafNotBeforeDays: -1, leafNotAfterDays: 2 });
    const signedDate = Date.now() + 1 * 86_400_000;   // inside the leaf window
    const jws = await signTransaction(shortLived, transactionPayload({ signedDate }));
    const out = await verifyAppleSignedTransaction(jws, { trustedRootsPem: [shortLived.rootPem] });
    expect(out.ok).toBe(true);
    // ... and the SAME transaction evaluated at a later instant is rejected, proving the date
    // used above was signedDate rather than the clock.
    const later = await verifyAppleSignedTransaction(jws, {
      trustedRootsPem: [shortLived.rootPem], at: new Date(Date.now() + 30 * 86_400_000),
    });
    expect(later.ok === false && later.code).toBe('certificate_expired');
  });

  it('REJECTS a transaction with no signedDate — offline mode has no other effective date', async () => {
    const jws = await signTransaction(pki, transactionPayload({ signedDate: undefined }));
    const out = await verify(jws);
    expect(out.ok === false && out.code).toBe('missing_signed_date');
  });

  it('REJECTS a non-numeric signedDate', async () => {
    const jws = await signTransaction(pki, transactionPayload({ signedDate: '2026-08-13' }));
    const out = await verify(jws);
    expect(out.ok === false && out.code).toBe('missing_signed_date');
  });
});

describe('BUILD 26P — the algorithm is pinned', () => {
  it('REJECTS alg:none', async () => {
    const jws = await signTransaction(pki, transactionPayload(), { alg: 'none' });
    expect((await verify(jws)).ok === false && ((await verify(jws)) as { code: string }).code)
      .toBe('unsupported_algorithm');
  });

  it('REJECTS a substituted algorithm (HS256)', async () => {
    const jws = await signTransaction(pki, transactionPayload(), { alg: 'HS256' });
    const out = await verify(jws);
    expect(out.ok === false && out.code).toBe('unsupported_algorithm');
  });

  it('REJECTS RS256 even with an otherwise valid chain', async () => {
    const jws = await signTransaction(pki, transactionPayload(), { alg: 'RS256' });
    const out = await verify(jws);
    expect(out.ok === false && out.code).toBe('unsupported_algorithm');
  });
});

describe('BUILD 26P — signature and payload integrity', () => {
  it('REJECTS a tampered signature', async () => {
    const jws = await signTransaction(pki, transactionPayload(), { tamperSignature: true });
    const out = await verify(jws);
    expect(out.ok === false && out.code).toBe('invalid_apple_signature');
  });

  it('REJECTS a tampered payload under an intact signature', async () => {
    const jws = await signTransaction(pki, transactionPayload(), { tamperPayload: true });
    const out = await verify(jws);
    expect(out.ok === false && out.code).toBe('invalid_apple_signature');
  });

  it('REJECTS a JWS signed by a key that is not the leaf', async () => {
    const other = await buildTestPki();
    const jws = await signTransaction(pki, transactionPayload(), { signWith: other.leafKey.privateKey });
    const out = await verify(jws);
    expect(out.ok === false && out.code).toBe('invalid_apple_signature');
  });
});

describe('BUILD 26P — malformed input never reaches the crypto', () => {
  it.each([
    ['empty', ''],
    ['two parts', 'aaa.bbb'],
    ['four parts', 'aaa.bbb.ccc.ddd'],
    ['empty segment', 'aaa..ccc'],
    ['not base64url json header', '!!!.bbb.ccc'],
  ])('REJECTS %s', async (_label, jws) => {
    const out = await verify(jws);
    expect(out.ok).toBe(false);
  });

  it('REJECTS a missing x5c', async () => {
    const jws = await signTransaction(pki, transactionPayload(), { x5c: [] });
    const out = await verify(jws);
    expect(out.ok === false && out.code).toBe('missing_certificate_chain');
  });

  // R1.1 — Apple requires EXACTLY three. R1 accepted 2..4, which was looser than Apple.
  it('REJECTS a one-certificate chain', async () => {
    const jws = await signTransaction(pki, transactionPayload(), { x5c: [pki.x5c[0]] });
    const out = await verify(jws);
    expect(out.ok === false && out.code).toBe('malformed_certificate_chain');
  });

  it('REJECTS a TWO-certificate chain (R1 accepted this)', async () => {
    const jws = await signTransaction(pki, transactionPayload(), { x5c: [pki.x5c[0], pki.x5c[1]] });
    const out = await verify(jws);
    expect(out.ok === false && out.code).toBe('malformed_certificate_chain');
  });

  it('ACCEPTS exactly three', async () => {
    const jws = await signTransaction(pki, transactionPayload(), { x5c: pki.x5c });
    expect((await verify(jws)).ok).toBe(true);
  });

  it('REJECTS a FOUR-certificate chain (R1 accepted this)', async () => {
    const jws = await signTransaction(pki, transactionPayload(), {
      x5c: [pki.x5c[0], pki.x5c[1], pki.x5c[2], pki.x5c[2]],
    });
    const out = await verify(jws);
    expect(out.ok === false && out.code).toBe('malformed_certificate_chain');
  });

  it('REJECTS garbage certificates in x5c', async () => {
    const jws = await signTransaction(pki, transactionPayload(), { x5c: ['not-a-cert', 'also-not', 'nope'] });
    const out = await verify(jws);
    expect(out.ok === false && out.code).toBe('malformed_certificate_chain');
  });

  it('REJECTS a chain in the wrong order (root first)', async () => {
    const jws = await signTransaction(pki, transactionPayload(), {
      x5c: [pki.x5c[2], pki.x5c[1], pki.x5c[0]],
    });
    const out = await verify(jws);
    expect(out.ok).toBe(false);
  });

  it('REJECTS an oversized blob before doing crypto work', async () => {
    const out = await verify('a.'.repeat(MAX_SIGNED_TRANSACTION_BYTES) + 'b.c');
    expect(out.ok === false && out.code).toBe('signed_transaction_too_large');
  });

  it('REJECTS a payload whose environment is not an Apple environment', async () => {
    const jws = await signTransaction(pki, transactionPayload({ environment: 'Staging' }));
    const out = await verify(jws);
    expect(out.ok === false && out.code).toBe('malformed_signed_transaction');
  });
});
