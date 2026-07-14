import { randomBytes, createHash } from "node:crypto";

/**
 * Foundry participant session — how a name-only employee is re-recognised on the
 * same device without logging in.
 *
 * On join, the server mints a high-entropy **opaque** token (256-bit) and stores
 * ONLY its SHA-256 hash in `foundry_event_participants.participant_session_token_hash`.
 * The raw token is handed to exactly one browser via an HttpOnly cookie; the
 * server never stores it and never logs it. On re-entry the browser presents the
 * cookie, the server hashes it and looks up the row. This mirrors the "store the
 * hash, hand the raw token to one device" pattern proven in bty-karaoke.
 *
 * The token is an identity credential only — event status/title/roster/ownership
 * are ALWAYS read from the DB, never trusted from the client.
 */

/** 256-bit opaque token, URL-safe. Not a UUID, not sequential, not guessable. */
export function generateParticipantSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Deterministic SHA-256 (hex) of the raw token — the only form stored in the DB. */
export function hashParticipantSessionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

/**
 * The HttpOnly cookie name for a participant session, scoped per event so a
 * device can hold a distinct session for each event it has joined. The event id
 * is not secret to a holder of that event's join capability, but we strip
 * hyphens for a clean cookie name.
 */
export function participantCookieName(eventId: string): string {
  return `bty_fr_ps_${eventId.replace(/-/g, "")}`;
}

/** Session cookie lifetime — long enough to survive a real event, bounded to 30 days. */
export const PARTICIPANT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
