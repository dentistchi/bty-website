// Single source of truth for the public legal pages + guest consent. Values here
// are confirmed facts (operator name + public contact supplied by the operator);
// nothing is fabricated. Retention/behaviour statements must match the measured
// implementation — see /privacy and /terms copy.

/** Confirmed operator (source: parent site copyright "Dr. Chi - Better Than Yesterday"). */
export const OPERATOR_NAME = 'BTY (Better Than Yesterday)';
export const OPERATOR_LONG = 'BTY (Better Than Yesterday), operated by Dr. Chi';
export const PRODUCT_NAME = 'btyNorebang';
/** Public privacy/support contact — designated by the operator. */
export const CONTACT_EMAIL = 'ywamer2022@gmail.com';

/** Effective date shown on the pages = the deployment date of this version. */
export const LEGAL_EFFECTIVE_DATE = '2026-07-19';
/**
 * Consent version. Bump ONLY when the policy MATERIALLY changes so guests are asked
 * to accept again. Stored (not a bare boolean) in localStorage so a material change
 * re-prompts while cosmetic edits do not.
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
} as const;

/**
 * Pure: is the stored consent version current? A guest must re-accept when the
 * stored value is missing (cleared storage / first use) or an older version.
 */
export function consentSatisfied(stored: string | null | undefined): boolean {
  return stored === LEGAL_VERSION;
}
