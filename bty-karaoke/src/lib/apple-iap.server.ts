// Server-only verification of an Apple StoreKit 2 signed transaction (BUILD 26P, Slice 3).
//
// NON-NEGOTIABLE, and the same rule apple-auth.server.ts states for identity tokens: the device's
// claim is never trusted. A JWS carries its own `x5c` chain, so an attacker can mint a root, an
// intermediate and a leaf, sign whatever payload they like, and present a chain that is perfectly
// self-consistent. Self-consistency proves nothing. Only anchoring to a root WE supply does.
//
// WHY NOT @apple/app-store-server-library. It is the security behaviour reference for this file,
// but it cannot run here: its SignedDataVerifier needs Node's `crypto.X509Certificate`, and this
// Worker's compatibility layer defines that as `notImplementedClass` — it throws at runtime
// (measured in unenv/dist/runtime/node/internal/crypto/node.mjs). So the checks are reproduced
// with WebCrypto-native libraries, deliberately NOT weakened into "the JWS signature verified,
// therefore trusted".
//
// WHAT IS ENFORCED, in order — every step can reject, and none is skippable:
//   A  compact JWS structure (exactly three parts, decodable header)
//   B  algorithm PINNED to ES256 — never `none`, never a substituted alg
//   C  x5c present, structurally valid, plausible length
//   D  chain shape: leaf → intermediate → root
//   E  leaf signed by the intermediate
//   F  intermediate signed by a root WE supply
//   G  a root offered inside x5c can never become a trust anchor
//   H  validity windows checked at an explicit effective date
//   I  intermediate must actually be a CA (basicConstraints)
//   J  Apple's signed-data purpose OID required on the leaf
//   K  JWS signature verified with the leaf's public key
//   L+ bundle / environment / claims — validated by domain/apple-transaction.ts AFTER all of this
//
// VERIFICATION IS NOT FULFILMENT. A success here means the transaction is genuine. It does not
// grant entitlement and is not a signal for a future native client to call Transaction.finish().

import 'reflect-metadata'; // @peculiar/x509 -> tsyringe requires this before first use.
import * as x509 from '@peculiar/x509';
import { compactVerify, importX509 } from 'jose';
import { APPLE_TRUSTED_ROOTS } from './apple-root-ca';
import type { AppleEnvironment, AppleTransactionClaims } from '@/domain/apple-transaction';

x509.cryptoProvider.set(crypto);

/** Apple's "signed data" leaf marker. Apple's own verifier requires it; so do we. */
export const APPLE_LEAF_PURPOSE_OID = '1.2.840.113635.100.6.11.1';

/** Longest JWS we will even attempt to parse — a cheap guard before any crypto work. */
export const MAX_SIGNED_TRANSACTION_BYTES = 16 * 1024;

export type AppleJwsRejection =
  | 'malformed_signed_transaction'
  | 'signed_transaction_too_large'
  | 'unsupported_algorithm'
  | 'missing_certificate_chain'
  | 'malformed_certificate_chain'
  | 'untrusted_certificate_chain'
  | 'certificate_expired'
  | 'intermediate_not_ca'
  | 'leaf_missing_apple_purpose'
  | 'invalid_apple_signature';

export type AppleJwsResult =
  | { ok: true; claims: AppleTransactionClaims; environment: AppleEnvironment }
  | { ok: false; code: AppleJwsRejection };

interface VerifyOptions {
  /** Effective date for certificate validity. Injectable so expiry is testable without waiting. */
  at?: Date;
  /** Trust anchors. Defaults to Apple's published roots; tests pass their own controlled root. */
  trustedRootsPem?: readonly string[];
}

function decodeBase64UrlJson(segment: string): unknown {
  const b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/**
 * Verify an Apple-signed compact JWS and return its payload claims.
 *
 * The returned `environment` is the verifier's OWN reading of the payload, produced only after
 * the signature chained to a trusted root. The caller compares it against the payload again in
 * the domain validator, so an unverified hint can never cause the check to be skipped.
 */
export async function verifyAppleSignedTransaction(
  signedTransaction: string,
  options: VerifyOptions = {},
): Promise<AppleJwsResult> {
  const at = options.at ?? new Date();
  const roots = options.trustedRootsPem ?? APPLE_TRUSTED_ROOTS;

  // ---- A. structure ------------------------------------------------------------------------
  if (typeof signedTransaction !== 'string' || signedTransaction.length === 0) {
    return { ok: false, code: 'malformed_signed_transaction' };
  }
  if (signedTransaction.length > MAX_SIGNED_TRANSACTION_BYTES) {
    return { ok: false, code: 'signed_transaction_too_large' };
  }
  const parts = signedTransaction.split('.');
  if (parts.length !== 3 || parts.some((p) => p.length === 0)) {
    return { ok: false, code: 'malformed_signed_transaction' };
  }

  let header: { alg?: unknown; x5c?: unknown };
  try {
    header = decodeBase64UrlJson(parts[0]) as { alg?: unknown; x5c?: unknown };
  } catch {
    return { ok: false, code: 'malformed_signed_transaction' };
  }
  if (typeof header !== 'object' || header === null) {
    return { ok: false, code: 'malformed_signed_transaction' };
  }

  // ---- B. algorithm pinned -----------------------------------------------------------------
  // Reading the token's own `alg` and trusting it is the classic forgery: `none` accepts an empty
  // signature, and a substituted symmetric alg lets the verifier's own key material be the
  // "signature". Apple signs StoreKit data with ES256; nothing else is accepted.
  if (header.alg !== 'ES256') return { ok: false, code: 'unsupported_algorithm' };

  // ---- C. x5c present and plausible --------------------------------------------------------
  if (!Array.isArray(header.x5c) || header.x5c.length < 2) {
    return { ok: false, code: 'missing_certificate_chain' };
  }
  if (header.x5c.length > 4 || !header.x5c.every((c) => typeof c === 'string' && c.length > 0)) {
    return { ok: false, code: 'malformed_certificate_chain' };
  }

  let leaf: x509.X509Certificate;
  let intermediate: x509.X509Certificate;
  try {
    // ---- D. chain shape: leaf first, intermediate second (Apple's ordering) ------------------
    leaf = new x509.X509Certificate(header.x5c[0] as string);
    intermediate = new x509.X509Certificate(header.x5c[1] as string);
  } catch {
    return { ok: false, code: 'malformed_certificate_chain' };
  }

  // ---- E/F/G. anchor to OUR root, never to one the JWS supplied ----------------------------
  // Any third element of x5c is IGNORED. That is the whole point: a chain does not become
  // trusted because it shipped its own root. The loop below only ever tries roots from
  // APPLE_TRUSTED_ROOTS (or a test's explicit anchor).
  let anchored = false;
  for (const rootPem of roots) {
    let root: x509.X509Certificate;
    try {
      root = new x509.X509Certificate(rootPem);
    } catch {
      continue; // a malformed pinned root must not make the chain trusted by accident
    }
    let intermediateSignedByRoot = false;
    try {
      intermediateSignedByRoot = await intermediate.verify({
        publicKey: await root.publicKey.export(),
        signatureOnly: true,
      });
    } catch {
      intermediateSignedByRoot = false;
    }
    if (!intermediateSignedByRoot) continue;

    // H. the root's own validity window still has to hold at the effective date.
    if (at < root.notBefore || at > root.notAfter) continue;
    anchored = true;
    break;
  }
  if (!anchored) return { ok: false, code: 'untrusted_certificate_chain' };

  // ---- E. leaf signed by that intermediate --------------------------------------------------
  let leafSigned = false;
  try {
    leafSigned = await leaf.verify({
      publicKey: await intermediate.publicKey.export(),
      signatureOnly: true,
    });
  } catch {
    leafSigned = false;
  }
  if (!leafSigned) return { ok: false, code: 'untrusted_certificate_chain' };

  // ---- H. validity windows -------------------------------------------------------------------
  for (const cert of [leaf, intermediate]) {
    if (at < cert.notBefore || at > cert.notAfter) return { ok: false, code: 'certificate_expired' };
  }

  // ---- I. the intermediate must actually be a CA ---------------------------------------------
  // Without this, a LEAF certificate could be presented in the intermediate slot and be used to
  // sign another leaf — issuing certificates it was never authorised to issue.
  const basicConstraints = intermediate.getExtension(x509.BasicConstraintsExtension);
  if (!basicConstraints?.ca) return { ok: false, code: 'intermediate_not_ca' };

  // ---- J. Apple's signed-data purpose OID on the leaf ------------------------------------------
  // A certificate that chains to Apple's root but was issued for some OTHER Apple purpose must not
  // be able to sign transactions. This is the check that keeps "Apple signed something" from
  // becoming "Apple signed THIS KIND of thing".
  if (!leaf.getExtension(APPLE_LEAF_PURPOSE_OID)) {
    return { ok: false, code: 'leaf_missing_apple_purpose' };
  }

  // ---- K. the JWS signature itself, under the now-trusted leaf key ---------------------------
  let claims: AppleTransactionClaims;
  try {
    const key = await importX509(leaf.toString('pem'), 'ES256');
    const { payload } = await compactVerify(signedTransaction, key, { algorithms: ['ES256'] });
    claims = JSON.parse(new TextDecoder().decode(payload)) as AppleTransactionClaims;
  } catch {
    return { ok: false, code: 'invalid_apple_signature' };
  }

  // The environment is read ONLY now, from a payload whose signature chained to a trusted root.
  const environment = claims.environment;
  if (environment !== 'Sandbox' && environment !== 'Production') {
    return { ok: false, code: 'malformed_signed_transaction' };
  }

  return { ok: true, claims, environment };
}

/** SHA-256 hex of the raw compact JWS — stored so a later re-presentation can be compared. */
export async function signedTransactionDigest(signedTransaction: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signedTransaction));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
