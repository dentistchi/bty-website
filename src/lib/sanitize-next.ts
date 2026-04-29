/**
 * @file Re-exports shared redirect sanitization. Prefer {@link sanitizeNextForRedirect} for new code.
 */
export {
  inferLocaleFromNextParam,
  sanitizeNextForRedirect,
  type SanitizeNextLocale,
} from "@/lib/auth/sanitize-next-for-redirect";

import { sanitizeNextForRedirect } from "@/lib/auth/sanitize-next-for-redirect";
import type { SanitizeNextLocale } from "@/lib/auth/sanitize-next-for-redirect";

/**
 * Client/session helpers: pass `locale` from pathname (`/ko/…` → `"ko"`).
 */
export function sanitizeNext(
  nextParam: string | null | undefined,
  locale: SanitizeNextLocale = "en",
): string {
  return sanitizeNextForRedirect(nextParam, { locale });
}
