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

// MARK: - BUILD 26H — ROOM-ONLY NAVIGATION IDENTIFIER
//
// A SECOND identifier form carried on the SAME already-claimed `/app/join/*` path, so the
// installed app needs no change and AASA is untouched. It is navigation, not admission: it
// mints nothing, stores nothing, and is not backed by a handoff row.
//
// DISJOINTNESS IS STRUCTURAL, NOT PROBABILISTIC.
//
// A real request-backed token is `randomToken(24)` = base64url of 24 bytes. 24 is divisible
// by 3, so there is never padding: the token is ALWAYS EXACTLY 32 characters. Its alphabet
// (`A-Za-z0-9-_`) is the FULL 64-symbol base64url set, which is byte-for-byte the charset the
// native parser accepts — so no character exists that a token cannot contain, and a
// character-based namespace is impossible. Length is therefore the only structural axis, and
// it is a hard invariant rather than a guess:
//
//   a room-nav identifier is NEVER 32 characters, by construction.
//
// A bare `rnav1-` prefix alone would NOT be collision-proof (a random token could in principle
// begin with those bytes), which is why the length rule — not the prefix — carries the proof.
// The prefix only names the namespace; the length makes the two sets provably disjoint.
//
// Belt and braces: the resolver still tries the real hash-backed token FIRST, so even if this
// invariant were ever violated by a future token-length change, a genuine handoff still wins.

/** base64url(24 bytes) with no padding. Proven by `randomTokenLengthIsInvariant` in tests. */
export const LEGACY_HANDOFF_TOKEN_LENGTH = 32;

/** The room-navigation namespace marker. Versioned so a future format can coexist. */
export const ROOM_NAV_PREFIX = 'rnav1-';

/** Room slugs are generated as `[a-z0-9-]`, never leading/trailing hyphen (domain/room-slug). */
const SLUG_SHAPE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/**
 * The resolve route refuses any identifier shorter than this BEFORE it looks anything up, so a
 * room-nav identifier must clear it or a short-slugged room would fail for a reason that has
 * nothing to do with the room.
 */
export const MIN_HANDOFF_IDENTIFIER_LENGTH = 8;

/**
 * Build the room-only navigation identifier for a slug, or null when the slug is not a
 * canonical room slug (never a malformed or guessed link).
 *
 * Deterministic hyphen padding after the prefix enforces BOTH invariants at once — long enough
 * for the resolver's guard, and never the legacy token length. The padding is transparent to
 * `parseRoomNavIdentifier` and unambiguous because a canonical slug never starts with a hyphen.
 */
export function roomNavIdentifier(slug: string): string | null {
  const s = (slug ?? '').trim().toLowerCase();
  if (!SLUG_SHAPE.test(s)) return null;
  let pad = '';
  const build = () => ROOM_NAV_PREFIX + pad + s;
  while (
    build().length < MIN_HANDOFF_IDENTIFIER_LENGTH ||
    build().length === LEGACY_HANDOFF_TOKEN_LENGTH
  ) {
    pad += '-';
  }
  return build();
}

/**
 * Read the room slug back out of a room-navigation identifier, or null when this is not one.
 *
 * Refuses anything of legacy-token length FIRST — that shape belongs to the request-backed
 * handoff and must never be re-interpreted as navigation.
 */
export function parseRoomNavIdentifier(identifier: string): string | null {
  const id = identifier ?? '';
  if (id.length === LEGACY_HANDOFF_TOKEN_LENGTH) return null;
  if (!id.startsWith(ROOM_NAV_PREFIX)) return null;
  const rest = id.slice(ROOM_NAV_PREFIX.length).replace(/^-+/, '');
  return SLUG_SHAPE.test(rest) ? rest : null;
}

/** True when the identifier is a room-navigation form rather than a request-backed token. */
export function isRoomNavIdentifier(identifier: string): boolean {
  return parseRoomNavIdentifier(identifier) !== null;
}

/**
 * The `handoffId` a room-only resolution reports. Deliberately NOT a UUID and deliberately not
 * a real id: nothing is stored, so there is nothing to identify. Native decodes this field as a
 * plain String and never reads it again (pinned by a regression test), so no UUID is fabricated
 * and no analytics join can mistake it for a real handoff.
 */
export function roomNavHandoffMarker(slug: string): string {
  return `room-nav:${slug}`;
}
