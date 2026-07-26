// Canonical Guest-to-App Universal Link origin (BUILD 19C Gate fix). The app-open link MUST
// always use the ONE public origin that the native app's Associated Domains entitlement claims
// (applinks:norebang.btydaily.com) — never the request/Host/X-Forwarded-Host/workers.dev origin,
// or iOS will not intercept it and Safari falls back to the web page. workers.dev stays a valid
// API origin, but is never an app-link origin.

import { HANDOFF_PATH_PREFIX } from './guest-handoff';

/** The single fixed, validated public app-link origin (matches the native applinks entitlement). */
export const CANONICAL_APP_LINK_ORIGIN = 'https://norebang.btydaily.com';
export const CANONICAL_APP_LINK_HOST = 'norebang.btydaily.com';

/**
 * Build the canonical `https://norebang.btydaily.com/app/join/{token}` Universal Link from the
 * FIXED origin — independent of the request origin/Host header. Fails closed (returns null) if:
 *   - the base origin is not HTTPS + exactly norebang.btydaily.com (no spoofed/other host), or
 *   - the token is missing/empty/not URL-safe (never emit a malformed or non-canonical link).
 * `origin` defaults to the canonical constant; it is a parameter ONLY so tests can prove that a
 * non-canonical origin (e.g. workers.dev, a spoofed Host) is rejected — production never passes one.
 */
export function canonicalUniversalLink(token: string, origin: string = CANONICAL_APP_LINK_ORIGIN): string | null {
  const t = (token ?? '').trim();
  if (!/^[A-Za-z0-9_-]+$/.test(t)) return null;
  let u: URL;
  try {
    u = new URL(origin);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.host !== CANONICAL_APP_LINK_HOST) return null;
  return `${CANONICAL_APP_LINK_ORIGIN}${HANDOFF_PATH_PREFIX}${t}`;
}
