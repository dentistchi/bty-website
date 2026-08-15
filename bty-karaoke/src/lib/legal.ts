// Single source of truth for the public legal pages + guest consent. Values here
// are confirmed facts (operator name + public contact supplied by the operator);
// nothing is fabricated. Retention/behaviour statements must match the measured
// implementation — see /privacy and /terms copy.

/** Confirmed operator (source: parent site copyright "Dr. Chi - Better Than Yesterday"). */
export const OPERATOR_NAME = 'BTY (Better Than Yesterday)';
export const OPERATOR_LONG = 'BTY (Better Than Yesterday), operated by Dr. Chi';
export const PRODUCT_NAME = 'btyNorebang';
/**
 * Customer-facing name of the iOS app (BUILD 26J). Deliberately DISTINCT from
 * PRODUCT_NAME: the App Store binary installs as "BTY Norebang", while the web service
 * keeps its established name. Both are the same service and the public pages say so —
 * renaming PRODUCT_NAME globally would be a product-wide rebrand touching room display
 * names, the Display screen and brand.ts, which is not a legal-surface change.
 */
export const APP_NAME = 'BTY Norebang';
/** Public privacy/support contact — designated by the operator. */
export const CONTACT_EMAIL = 'ywamer2022@gmail.com';
/**
 * Stated reply target on /support. A support page that promises nothing is not a support
 * channel; this is the commitment shown to customers and to App Review.
 */
export const SUPPORT_RESPONSE_TARGET = '2 business days';

/** Effective date shown on the pages = the deployment date of this version. */
export const LEGAL_EFFECTIVE_DATE = '2026-08-14';
/**
 * Consent version. Bump ONLY when the policy MATERIALLY changes so guests are asked
 * to accept again. Stored (not a bare boolean) in localStorage so a material change
 * re-prompts while cosmetic edits do not.
 *
 * BUILD 26T-R1B-R5 deliberately did NOT bump this while adding privacy §4a (host account
 * information). No practice changed — §4a discloses collection that was already happening,
 * and all of it concerns HOST ACCOUNTS, while this gate is the GUEST consent prompt. Bumping
 * would re-prompt every guest mid-event for a disclosure that does not change what a guest
 * consents to. The effective date above did move, which is what /privacy §15 promises for a
 * non-material update.
 */
export const LEGAL_VERSION = '2026-07-19';

/** Site-wide (NOT event-scoped) localStorage key for the accepted legal version. */
export const CONSENT_STORAGE_KEY = 'bty-karaoke:legal-consent';

/** Official Google / YouTube references (verified live). Never embed BTY secrets. */
export const LEGAL_LINKS = {
  googlePrivacy: 'https://policies.google.com/privacy',
  youtubeTerms: 'https://www.youtube.com/t/terms',
  youtubeApiTerms: 'https://developers.google.com/youtube/terms/api-services-terms-of-service',
  googlePermissions: 'https://myaccount.google.com/permissions',
  privacy: '/privacy',
  terms: '/terms',
  support: '/support',
} as const;

/**
 * Pure: is the stored consent version current? A guest must re-accept when the
 * stored value is missing (cleared storage / first use) or an older version.
 */
export function consentSatisfied(stored: string | null | undefined): boolean {
  return stored === LEGAL_VERSION;
}
