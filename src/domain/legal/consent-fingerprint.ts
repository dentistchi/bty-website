import { createHash } from "node:crypto";
import {
  activeConsentDocument,
  canonicalConsentPayload,
  type ConsentDocument,
  type ConsentLocale,
} from "./consent-document";

/**
 * THE EXACT IDENTITY OF A CONSENT DOCUMENT (Slice 3.2R-R9A).
 *
 * A version string proves which document was NAMED. It cannot prove which words were SHOWN —
 * and on this repository that distinction is not theoretical: the consent body changed by
 * +114/-6 lines under a frozen `2026-05-pending-v1`, so 13 acceptance rows cannot say whether
 * the user saw a bare placeholder or a full disclosure naming third-party AI processing.
 *
 * The fingerprint closes that gap going forward. It is taken over the CANONICAL CONTENT — the
 * structured legal prose — and never over rendered HTML: framework markup carries class names,
 * hydration attributes and whitespace that change with a Next.js upgrade, which would invalidate
 * every stored fingerprint without a single word of the agreement changing.
 *
 * Mirrors `proposal-digest.ts` deliberately: same `<version>:<sha256 hex>` shape, same reason —
 * the identity of the hashing scheme travels with the value instead of living only in code, so a
 * future change to what counts as identity produces a different fingerprint rather than silently
 * colliding with the old meaning.
 *
 * SEPARATE FILE, ONE AUTHORITY. `middleware.ts` imports the version from `consent-document.ts`
 * and runs in the edge middleware bundle, so that module stays free of Node built-ins. This is
 * derived data computed FROM the document, never a second source of truth.
 */
export const CONSENT_FINGERPRINT_VERSION = "bty_consent_document_v1";

/** `<scheme>:<sha256 hex>` over the canonical content. */
export type ConsentFingerprint = string;

export function consentDocumentFingerprint(doc: ConsentDocument): ConsentFingerprint {
  const hash = createHash("sha256").update(canonicalConsentPayload(doc), "utf8").digest("hex");
  return `${CONSENT_FINGERPRINT_VERSION}:${hash}`;
}

/**
 * The fingerprint the server currently requires for a locale, or null when the locale is not
 * published. Null is a refusal, never a fallback to another language's document.
 */
export function activeConsentFingerprint(locale: ConsentLocale | string): ConsentFingerprint | null {
  const doc = activeConsentDocument(locale);
  return doc ? consentDocumentFingerprint(doc) : null;
}
