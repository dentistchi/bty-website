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
  MAX_SIGNED_TRANSACTION_BYTES,
} from './apple-iap.server';
import { APPLE_ROOT_CA_G3_PEM, APPLE_ROOT_CA_G3_SHA256, APPLE_TRUSTED_ROOTS } from './apple-root-ca';
import { buildTestPki, signTransaction, transactionPayload, type TestPki } from './apple-test-pki.fixture';

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

  it('ships exactly one trusted root, and it is Apple G3', () => {
    expect(APPLE_TRUSTED_ROOTS).toHaveLength(1);
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

  it('REJECTS a leaf the intermediate did not sign', async () => {
    const forged = await buildTestPki({ leafSignedByRoot: true });
    // Present the forged leaf with OUR intermediate/root, so only the leaf link is broken.
    const jws = await signTransaction(forged, transactionPayload(), {
      x5c: [forged.x5c[0], pki.x5c[1], pki.x5c[2]],
    });
    const out = await verify(jws);
    expect(out.ok === false && out.code).toBe('untrusted_certificate_chain');
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
});

describe('BUILD 26P — certificate validity uses an explicit effective date', () => {
  it('REJECTS an expired leaf', async () => {
    // +150d is deliberately INSIDE the test root (365d) and intermediate (200d) windows but
    // OUTSIDE the leaf's (100d), so this isolates leaf expiry. At +400d the root itself would be
    // expired and anchoring would fail first with untrusted_certificate_chain — correct, but a
    // different assertion; the next test pins that ordering explicitly.
    const jws = await signTransaction(pki, transactionPayload());
    const out = await verify(jws, { at: new Date(Date.now() + 150 * 86_400_000) });
    expect(out.ok === false && out.code).toBe('certificate_expired');
  });

  it('REJECTS everything once the trust ANCHOR itself has expired', async () => {
    // An expired root must stop anchoring the chain at all — it must not fall through to a
    // leaf-level complaint that implies the anchor was still doing its job.
    const jws = await signTransaction(pki, transactionPayload());
    const out = await verify(jws, { at: new Date(Date.now() + 400 * 86_400_000) });
    expect(out.ok === false && out.code).toBe('untrusted_certificate_chain');
  });

  it('REJECTS a not-yet-valid leaf', async () => {
    const future = await buildTestPki({ leafNotBeforeDays: 10, leafNotAfterDays: 100 });
    const jws = await signTransaction(future, transactionPayload());
    const out = await verifyAppleSignedTransaction(jws, { trustedRootsPem: [future.rootPem] });
    expect(out.ok === false && out.code).toBe('certificate_expired');
  });

  it('accepts a leaf inside its window', async () => {
    const jws = await signTransaction(pki, transactionPayload());
    expect((await verify(jws, { at: new Date() })).ok).toBe(true);
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

  it('REJECTS a one-certificate chain (no intermediate to anchor)', async () => {
    const jws = await signTransaction(pki, transactionPayload(), { x5c: [pki.x5c[0]] });
    const out = await verify(jws);
    expect(out.ok === false && out.code).toBe('missing_certificate_chain');
  });

  it('REJECTS an over-long chain', async () => {
    const jws = await signTransaction(pki, transactionPayload(), {
      x5c: [pki.x5c[0], pki.x5c[1], pki.x5c[2], pki.x5c[2], pki.x5c[2]],
    });
    const out = await verify(jws);
    expect(out.ok === false && out.code).toBe('malformed_certificate_chain');
  });

  it('REJECTS garbage certificates in x5c', async () => {
    const jws = await signTransaction(pki, transactionPayload(), { x5c: ['not-a-cert', 'also-not'] });
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
