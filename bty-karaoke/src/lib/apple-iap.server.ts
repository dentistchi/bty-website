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
// PARITY TARGET (BUILD 26P-R1.1): Apple's `SignedDataVerifier` with **enableOnlineChecks = false**,
// for transaction JWS. Offline is a deliberate choice, not an omission — see §"OFFLINE" below.
//
// WHAT IS ENFORCED, in order — every step can reject, and none is skippable:
//   A  compact JWS structure (exactly three parts, decodable header)
//   B  algorithm PINNED to ES256 — never `none`, never a substituted alg
//   C  x5c present and EXACTLY THREE entries (Apple's requirement)
//   D  chain shape: x5c[0] leaf, x5c[1] intermediate, x5c[2] supplied root material
//   E  effective date taken from the transaction's `signedDate` (Apple's offline semantics)
//   F  intermediate signed by a root WE supply, and issuer/subject linkage to it
//   G  a root offered inside x5c[2] can NEVER become a trust anchor — it is never read as one
//   H  leaf signed by the intermediate, and leaf.issuer == intermediate.subject
//   I  validity windows for leaf, intermediate AND root, all at the effective date
//   J  intermediate must actually be a CA (basicConstraints)
//   K  Apple purpose OIDs required on BOTH the leaf (.6.11.1) and the intermediate (.6.2.1)
//   L  JWS signature verified with the leaf's public key
//   M+ bundle / environment / claims — validated by domain/apple-transaction.ts AFTER all of this
//
// OFFLINE. `enableOnlineChecks = false` means no OCSP and no App Store Server API call. That is
// why this deployment needs no Apple private key, issuer id or key id. In that mode Apple uses the
// transaction's own `signedDate` as the effective date for certificate validity, so a genuine
// transaction stays verifiable after its signing certificate has rotated out. We do the same.
//
// Reading `signedDate` before the signature is verified is not a trust leak: the payload it comes
// from must still pass the JWS signature under a leaf that chains to Apple's root, so an attacker
// cannot move the effective date without Apple's key. It is used ONLY to date the chain, and NO
// decoded claim reaches domain processing until step L succeeds.
//
// VERIFICATION IS NOT FULFILMENT. A success here means the transaction is genuine. It does not
// grant entitlement and is not a signal for a future native client to call Transaction.finish().

import 'reflect-metadata'; // @peculiar/x509 -> tsyringe requires this before first use.
import * as x509 from '@peculiar/x509';
import { compactVerify, importX509 } from 'jose';
import { APPLE_TRUSTED_ROOTS } from './apple-root-ca';
import type { AppleEnvironment, AppleTransactionClaims } from '@/domain/apple-transaction';

x509.cryptoProvider.set(crypto);

/** Apple's "signed data" LEAF marker. Apple's own verifier requires it; so do we. */
export const APPLE_LEAF_PURPOSE_OID = '1.2.840.113635.100.6.11.1';

/**
 * Apple's WWDR INTERMEDIATE marker. Apple's verifier requires this too, and R1 did not — a
 * certificate issued by Apple for some other purpose could otherwise stand in the intermediate
 * slot. Requiring it is what keeps "Apple signed something" from becoming "Apple authorised THIS
 * chain to sign App Store data".
 */
export const APPLE_INTERMEDIATE_PURPOSE_OID = '1.2.840.113635.100.6.2.1';

/** Apple requires exactly three: leaf, intermediate, and the chain's own root material. */
export const APPLE_X5C_LENGTH = 3;

/** Longest JWS we will even attempt to parse — a cheap guard before any crypto work. */
export const MAX_SIGNED_TRANSACTION_BYTES = 16 * 1024;

export type AppleJwsRejection =
  | 'malformed_signed_transaction'
  | 'signed_transaction_too_large'
  | 'unsupported_algorithm'
  | 'missing_certificate_chain'
  | 'malformed_certificate_chain'
  | 'untrusted_certificate_chain'
  | 'certificate_issuer_mismatch'
  | 'certificate_expired'
  | 'intermediate_not_ca'
  | 'leaf_missing_apple_purpose'
  | 'intermediate_missing_apple_purpose'
  | 'missing_signed_date'
  | 'invalid_apple_signature';

export type AppleJwsResult =
  | { ok: true; claims: AppleTransactionClaims; environment: AppleEnvironment }
  | { ok: false; code: AppleJwsRejection };

interface VerifyOptions {
  /**
   * OVERRIDE for the effective date. Apple's offline semantics use the transaction's own
   * `signedDate`, which is the default; this exists only so tests can pin "what if it were
   * evaluated now / at some other instant" without forging a payload.
   */
  at?: Date;
  /** Trust anchors. Defaults to Apple's published roots; tests pass their own controlled root. */
  trustedRootsPem?: readonly string[];
}

/**
 * DER-exact comparison of two Distinguished Names. **Deliberately STRICTER than Apple's.**
 *
 * MEASURED, R1.2 — not assumed:
 *
 *   Apple (Node)  `intermediate.issuer === root.subject` — string equality over Node's FORMATTED
 *                 DN (jws_verification.ts:279,284). Text-level, so it is insensitive to the ASN.1
 *                 string type an attribute was encoded with.
 *   RFC 5280      name matching allows more still: case-insensitive matching for several string
 *                 types, and PrintableString/UTF8String are comparable when the text agrees.
 *   BTY           byte equality over the DER serialization of the ASN.1 Name.
 *
 * So two RFC-EQUIVALENT DNs CAN differ in DER — same text encoded as PrintableString in one
 * certificate and UTF8String in the other would match for Apple and for RFC 5280, and would be
 * REJECTED here. That is a real difference and it is recorded rather than glossed: it can only
 * ever cause a false REJECTION, never a false acceptance, so it fails closed.
 *
 * It is kept for 26P because the REAL Apple chain passes it — proven in apple-real-chain.test.ts
 * against Apple's own published leaf/intermediate/root — and because @peculiar/x509 exposes no
 * RFC-aware name comparator (`AsnData.equal` is itself ASN.1 byte equality; there is no
 * caseIgnore/RFC-4518 canonicalisation anywhere in the package). Hand-writing a DN canonicaliser
 * to close a documentation gap would add a subtle new attack surface to remove a difference that
 * currently costs nothing. Predictable failure beats a cosmetic parity claim.
 *
 * If Apple ever re-encodes a DN mid-chain, this rejects genuine transactions and the fix is to
 * adopt a reviewed comparator — not to loosen this into a string compare.
 */
function sameDistinguishedName(a: x509.Name, b: x509.Name): boolean {
  const x = new Uint8Array(a.toArrayBuffer());
  const y = new Uint8Array(b.toArrayBuffer());
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= x[i] ^ y[i];
  return diff === 0;
}

function decodeBase64UrlJson(segment: string): unknown {
  const b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export type AppleChainResult =
  | { ok: true; leaf: x509.X509Certificate; intermediate: x509.X509Certificate }
  | { ok: false; code: AppleJwsRejection };

/**
 * Verify an Apple certificate chain: leaf -> intermediate -> a root WE supply.
 *
 * Exported so the REAL Apple chain can be proved without a JWS. `verifyAppleSignedTransaction` is
 * the only caller in the application, so this is the production path rather than a test-only echo.
 *
 * `x5c[2]` — the chain's own root material — is NEVER parsed here and never becomes an anchor.
 */
export async function verifyAppleCertificateChain(
  x5c: readonly string[],
  options: { at: Date; trustedRootsPem: readonly string[] },
): Promise<AppleChainResult> {
  const { at, trustedRootsPem: roots } = options;

  if (x5c.length !== APPLE_X5C_LENGTH) return { ok: false, code: 'malformed_certificate_chain' };

  let leaf: x509.X509Certificate;
  let intermediate: x509.X509Certificate;
  try {
    // D. chain shape: leaf first, intermediate second (Apple's ordering).
    leaf = new x509.X509Certificate(x5c[0]);
    intermediate = new x509.X509Certificate(x5c[1]);
  } catch {
    return { ok: false, code: 'malformed_certificate_chain' };
  }

  // ---- F/G. anchor to OUR root, never to one the JWS supplied ------------------------------
  // The loop only ever tries roots from APPLE_TRUSTED_ROOTS (or a test's explicit anchor), and
  // requires BOTH the signature and the issuer/subject linkage.
  let anchored = false;
  for (const rootPem of roots) {
    let root: x509.X509Certificate;
    try {
      root = new x509.X509Certificate(rootPem);
    } catch {
      continue; // a malformed pinned root must not make the chain trusted by accident
    }
    // Semantic linkage, not just signature mathematics.
    if (!sameDistinguishedName(intermediate.issuerName, root.subjectName)) continue;

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

    // I. the root's own validity window at the effective date.
    if (at < root.notBefore || at > root.notAfter) continue;
    anchored = true;
    break;
  }
  if (!anchored) return { ok: false, code: 'untrusted_certificate_chain' };

  // ---- H. leaf issued BY that intermediate ---------------------------------------------------
  if (!sameDistinguishedName(leaf.issuerName, intermediate.subjectName)) {
    return { ok: false, code: 'certificate_issuer_mismatch' };
  }
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

  // ---- I. validity windows for leaf and intermediate, at the effective date -------------------
  for (const cert of [leaf, intermediate]) {
    if (at < cert.notBefore || at > cert.notAfter) return { ok: false, code: 'certificate_expired' };
  }

  // ---- J. the intermediate must actually be a CA ---------------------------------------------
  // Without this, a LEAF certificate could be presented in the intermediate slot and be used to
  // sign another leaf — issuing certificates it was never authorised to issue.
  const basicConstraints = intermediate.getExtension(x509.BasicConstraintsExtension);
  if (!basicConstraints?.ca) return { ok: false, code: 'intermediate_not_ca' };

  // ---- K. Apple's purpose OIDs on BOTH certificates -------------------------------------------
  // A certificate that chains to Apple's root but was issued for some OTHER Apple purpose must not
  // be able to sign transactions. These are the checks that keep "Apple signed something" from
  // becoming "Apple authorised THIS chain to sign App Store data".
  if (!leaf.getExtension(APPLE_LEAF_PURPOSE_OID)) {
    return { ok: false, code: 'leaf_missing_apple_purpose' };
  }
  if (!intermediate.getExtension(APPLE_INTERMEDIATE_PURPOSE_OID)) {
    return { ok: false, code: 'intermediate_missing_apple_purpose' };
  }

  return { ok: true, leaf, intermediate };
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

  // ---- C. x5c present and EXACTLY three ------------------------------------------------------
  // Apple's verifier requires exactly three. R1 accepted 2–4, which is looser than Apple and
  // would admit chain shapes Apple never produces.
  if (!Array.isArray(header.x5c) || header.x5c.length === 0) {
    return { ok: false, code: 'missing_certificate_chain' };
  }
  if (
    header.x5c.length !== APPLE_X5C_LENGTH ||
    !header.x5c.every((c) => typeof c === 'string' && c.length > 0)
  ) {
    return { ok: false, code: 'malformed_certificate_chain' };
  }

  // ---- E. the effective date, Apple's offline way --------------------------------------------
  // Apple dates the chain by the transaction's own `signedDate` when online checks are disabled.
  // Parsed from the UNVERIFIED payload, which is safe because the payload must still survive the
  // JWS signature check in step L: an attacker cannot move this date without Apple's key.
  let unverifiedPayload: { signedDate?: unknown };
  try {
    unverifiedPayload = decodeBase64UrlJson(parts[1]) as { signedDate?: unknown };
  } catch {
    return { ok: false, code: 'malformed_signed_transaction' };
  }
  const signedDate = unverifiedPayload?.signedDate;
  if (options.at === undefined) {
    if (typeof signedDate !== 'number' || !Number.isFinite(signedDate)) {
      return { ok: false, code: 'missing_signed_date' };
    }
  }
  const at =
    options.at ??
    (() => {
      const d = new Date(signedDate as number);
      return Number.isNaN(d.getTime()) ? null : d;
    })();
  if (!at) return { ok: false, code: 'missing_signed_date' };

  // ---- F..K. the certificate chain, extracted so it is independently testable ---------------
  // Split out in R1.2 so the REAL Apple chain can be proved on its own: we hold no Apple private
  // key, so a genuine Apple leaf can never be paired with a genuine JWS signature in a test — the
  // chain half has to stand by itself. This is the production path, not a parallel copy.
  const chain = await verifyAppleCertificateChain(header.x5c as string[], { at, trustedRootsPem: roots });
  if (!chain.ok) return { ok: false, code: chain.code };
  const leaf = chain.leaf;

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
