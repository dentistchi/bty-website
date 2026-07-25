// Guest-to-App opaque handoff — pure domain (BUILD 19B). No I/O, no DB, no crypto side
// effects. The token TTL, the resolution-state decision, and the Universal-Link path
// contract live here so both the API layer and tests share one source of truth.

/** Default handoff lifetime — 24h (§8). */
export const DEFAULT_HANDOFF_TTL_MS = 24 * 60 * 60 * 1000;

/** The canonical Universal Link path prefix. Only this path is authorized in AASA (§6). */
export const HANDOFF_PATH_PREFIX = '/app/join/';

/** expires_at from a creation instant + ttl. Pure. */
export function handoffExpiry(createdMs: number, ttlMs: number = DEFAULT_HANDOFF_TTL_MS): number {
  return createdMs + ttlMs;
}

/** The externally visible resolution outcome. `invalid` never distinguishes "no such token"
 *  from "tampered" — both are a single generic result so a caller cannot enumerate Rooms. */
export type HandoffResolution = 'active' | 'event_ended' | 'expired' | 'revoked' | 'invalid';

export interface HandoffStateInput {
  /** Row status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' — or null/undefined when no row was found. */
  handoffStatus?: string | null;
  /** The stored expiry (ms epoch), or null when no row. */
  expiresAtMs?: number | null;
  /** The scoped Event's status ('active' | 'ended' | …), or null. */
  eventStatus?: string | null;
}

/**
 * Decide the resolution outcome from server-truth. Order matters:
 *   no row / bad status → invalid (no existence signal);
 *   revoked            → revoked;
 *   past expiry (server time) → expired (even if the row still reads ACTIVE — lazy expiry);
 *   event not active   → event_ended;
 *   otherwise          → active.
 */
export function resolveHandoffState(input: HandoffStateInput, nowMs: number): HandoffResolution {
  const status = input.handoffStatus;
  if (status !== 'ACTIVE' && status !== 'EXPIRED' && status !== 'REVOKED') return 'invalid';
  if (status === 'REVOKED') return 'revoked';
  // An explicit EXPIRED status is terminal regardless of the stored expiry (defense in depth);
  // an ACTIVE row lazy-expires the instant server time passes expires_at.
  if (status === 'EXPIRED') return 'expired';
  const expires = input.expiresAtMs ?? 0;
  if (!expires || expires <= nowMs) return 'expired';
  if (input.eventStatus !== 'active') return 'event_ended';
  return 'active';
}

/** Whether a resolution should count an "open" (increment open_count). Only a genuine,
 *  still-valid navigation counts — an expired/invalid probe does not inflate the counter. */
export function countsAsOpen(resolution: HandoffResolution): boolean {
  return resolution === 'active' || resolution === 'event_ended';
}

/**
 * Extract the opaque token from a Universal-Link path. Accepts ONLY the exact
 * `/app/join/{token}` shape with a single non-empty, URL-safe token segment. Any other
 * host/path/extra-segment yields null (no open redirect, no arbitrary routing). Pure.
 */
export function extractHandoffToken(pathname: string): string | null {
  if (!pathname.startsWith(HANDOFF_PATH_PREFIX)) return null;
  const rest = pathname.slice(HANDOFF_PATH_PREFIX.length);
  if (rest.length === 0 || rest.includes('/')) return null;
  // URL-safe token charset only (base64url-ish): letters, digits, - _.
  if (!/^[A-Za-z0-9_-]+$/.test(rest)) return null;
  return rest;
}
