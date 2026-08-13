// BUILD 26P-R1.2 — the REAL Apple certificate chain must PASS our verifier.
//
// R1.1's Apple root had only ever been shown to REJECT our synthetic chain. That proves the
// anchor is consulted; it does not prove we can accept a genuine Apple chain. This file proves
// the second claim, which is the one production actually depends on.
//
// SCOPE, stated exactly: certificate-chain validation only. We hold no Apple private key, so a
// genuine Apple-signed transaction JWS still requires a Sandbox purchase and remains deferred.

import { describe, it, expect } from 'vitest';
import {
  verifyAppleCertificateChain,
  verifyAppleSignedTransaction,
  APPLE_LEAF_PURPOSE_OID,
  APPLE_INTERMEDIATE_PURPOSE_OID,
} from './apple-iap.server';
import {
  APPLE_TRUSTED_ROOTS,
  APPLE_ROOT_CA_G1_PEM,
  APPLE_ROOT_CA_G2_PEM,
  APPLE_ROOT_CA_G3_PEM,
  APPLE_ROOT_CA_G1_SHA256,
  APPLE_ROOT_CA_G2_SHA256,
  APPLE_ROOT_CA_G3_SHA256,
} from './apple-root-ca';
import {
  REAL_APPLE_X5C,
  REAL_APPLE_ROOT_B64,
  REAL_APPLE_CHAIN_EFFECTIVE_DATE_MS,
} from './apple-real-chain.fixture';
import { buildTestPki, signTransaction, transactionPayload } from './apple-test-pki.fixture';

const AT = new Date(REAL_APPLE_CHAIN_EFFECTIVE_DATE_MS);

async function der(pem: string): Promise<Uint8Array<ArrayBuffer>> {
  const bin = atob(pem.replace(/-----[^-]+-----|\s/g, ''));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}
async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('R1.2 — the documented Apple root set', () => {
  it('pins all THREE roots Apple directs SignedDataVerifier users to obtain', () => {
    expect(APPLE_TRUSTED_ROOTS).toHaveLength(3);
    expect(APPLE_TRUSTED_ROOTS).toContain(APPLE_ROOT_CA_G3_PEM);
    expect(APPLE_TRUSTED_ROOTS).toContain(APPLE_ROOT_CA_G2_PEM);
    expect(APPLE_TRUSTED_ROOTS).toContain(APPLE_ROOT_CA_G1_PEM);
  });

  it('each root matches its recorded SHA-256 — an edit cannot silently change who we trust', async () => {
    expect(await sha256Hex(await der(APPLE_ROOT_CA_G1_PEM))).toBe(APPLE_ROOT_CA_G1_SHA256);
    expect(await sha256Hex(await der(APPLE_ROOT_CA_G2_PEM))).toBe(APPLE_ROOT_CA_G2_SHA256);
    expect(await sha256Hex(await der(APPLE_ROOT_CA_G3_PEM))).toBe(APPLE_ROOT_CA_G3_SHA256);
  });

  it('our pinned G3 is byte-identical to the root in Apple\'s own test suite', async () => {
    const mine = await der(APPLE_ROOT_CA_G3_PEM);
    const apple = Uint8Array.from(atob(REAL_APPLE_ROOT_B64), (c) => c.charCodeAt(0));
    expect(mine.length).toBe(apple.length);
    expect(Array.from(mine)).toEqual(Array.from(apple));
  });
});

describe('R1.2 — the REAL Apple chain PASSES', () => {
  it('real leaf -> real WWDR G6 intermediate -> pinned real G3 root', async () => {
    const out = await verifyAppleCertificateChain(REAL_APPLE_X5C, {
      at: AT,
      trustedRootsPem: APPLE_TRUSTED_ROOTS,
    });
    expect(out.ok).toBe(true);
  });

  it('every individual production constraint holds on the real chain', async () => {
    const out = await verifyAppleCertificateChain(REAL_APPLE_X5C, { at: AT, trustedRootsPem: APPLE_TRUSTED_ROOTS });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    // The requirements R1.1 introduced are confirmed against REAL Apple material, not only fixtures.
    expect(out.leaf.getExtension(APPLE_LEAF_PURPOSE_OID)).toBeTruthy();
    expect(out.intermediate.getExtension(APPLE_INTERMEDIATE_PURPOSE_OID)).toBeTruthy();
    expect(out.leaf.subject).toContain('Receipt Signing');
    expect(out.intermediate.subject).toContain('Apple Worldwide Developer Relations');
    // DN linkage: the real chain satisfies our byte-exact DER comparison.
    expect(out.leaf.issuer).toBe(out.intermediate.subject);
  });

  it('the real chain reaches the JWS step — a chain error is NOT what stops it', async () => {
    // We cannot sign as Apple, so the transaction signature must fail. What matters is WHERE it
    // fails: `invalid_apple_signature` proves every chain check upstream of it passed.
    const header = { alg: 'ES256', x5c: REAL_APPLE_X5C };
    const b64 = (o: unknown) =>
      btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o))))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const jws = `${b64(header)}.${b64({ ...transactionPayload(), signedDate: REAL_APPLE_CHAIN_EFFECTIVE_DATE_MS })}.AAAA`;
    const out = await verifyAppleSignedTransaction(jws);
    expect(out.ok).toBe(false);
    expect(out.ok === false && out.code).toBe('invalid_apple_signature');
  });

  it('the real chain is REJECTED when its own root is not in the trusted set', async () => {
    // G3 removed; G1 and G2 remain. Anchoring must fail — the verifier stops because one of OUR
    // roots validated the intermediate, not because the names look Apple-like.
    const out = await verifyAppleCertificateChain(REAL_APPLE_X5C, {
      at: AT,
      trustedRootsPem: [APPLE_ROOT_CA_G1_PEM, APPLE_ROOT_CA_G2_PEM],
    });
    expect(out.ok === false && out.code).toBe('untrusted_certificate_chain');
  });

  it('the real chain is REJECTED at a date outside the leaf window', async () => {
    const out = await verifyAppleCertificateChain(REAL_APPLE_X5C, {
      at: new Date('2020-01-01T00:00:00Z'),
      trustedRootsPem: APPLE_TRUSTED_ROOTS,
    });
    expect(out.ok).toBe(false);
  });

  it('an EMPTY trusted set fails closed', async () => {
    const out = await verifyAppleCertificateChain(REAL_APPLE_X5C, { at: AT, trustedRootsPem: [] });
    expect(out.ok === false && out.code).toBe('untrusted_certificate_chain');
  });
});

describe('R1.2 — a wider root set does NOT widen the attack surface', () => {
  it('an attacker hierarchy still fails with ALL THREE Apple roots loaded', async () => {
    const attacker = await buildTestPki();
    const out = await verifyAppleCertificateChain(attacker.x5c, {
      at: new Date(),
      trustedRootsPem: APPLE_TRUSTED_ROOTS,
    });
    expect(out.ok === false && out.code).toBe('untrusted_certificate_chain');
  });

  it('an attacker root supplied in x5c[2] remains irrelevant with three roots loaded', async () => {
    const attacker = await buildTestPki();
    const jws = await signTransaction(attacker, transactionPayload());
    const out = await verifyAppleSignedTransaction(jws); // real Apple roots
    expect(out.ok === false && out.code).toBe('untrusted_certificate_chain');
  });

  it('a chain signed by an unrelated key is rejected even with multiple roots trusted', async () => {
    const a = await buildTestPki();
    const b = await buildTestPki();
    // b's leaf presented under a's intermediate/root — signature cannot verify.
    const out = await verifyAppleCertificateChain([b.x5c[0], a.x5c[1], a.x5c[2]], {
      at: new Date(),
      trustedRootsPem: [...APPLE_TRUSTED_ROOTS, a.rootPem],
    });
    expect(out.ok).toBe(false);
  });

  it('every extra Apple root is still subject to the SAME chain constraints', async () => {
    // A synthetic chain that would satisfy linkage against a bogus "Apple-looking" root must not
    // pass merely because our trusted set grew.
    const attacker = await buildTestPki();
    for (const roots of [
      [APPLE_ROOT_CA_G1_PEM],
      [APPLE_ROOT_CA_G2_PEM],
      [APPLE_ROOT_CA_G3_PEM],
      [...APPLE_TRUSTED_ROOTS],
    ]) {
      const out = await verifyAppleCertificateChain(attacker.x5c, { at: new Date(), trustedRootsPem: roots });
      expect(out.ok).toBe(false);
    }
  });
});
