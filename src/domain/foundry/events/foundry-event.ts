/**
 * Foundry Event Rooms — domain (pure).
 *
 * No DB, no crypto, no I/O. Just the rules that decide what a valid event/
 * participant is and how status transitions are allowed. Token minting and DB
 * writes live in the service layer (`src/lib/bty/foundry/events`).
 *
 * Relationship model: Foundry = relationship with the world. An Event Room is a
 * real shared space a manager opens for their team — it is NOT an assessment,
 * course, XP surface, or recommendation. V1 connects people; content comes later.
 */

export type FoundryEventStatus = "open" | "closed";

/** The two — and only two — states an event may hold in V1. */
export const FOUNDRY_EVENT_STATUSES: readonly FoundryEventStatus[] = ["open", "closed"];

export type FoundryParticipantStatus = "joined" | "removed";

export const FOUNDRY_TITLE_MAX = 80;
export const FOUNDRY_DISPLAY_NAME_MAX = 60;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

/**
 * Strip characters that must never enter a title/name: C0 controls (0x00–0x1F),
 * DEL + C1 (0x7F–0x9F), and the Unicode line/paragraph separators (0x2028/0x2029).
 * Implemented as a code-point filter (no literal control chars in source). We
 * deliberately do NOT strip or encode anything else — React escapes on render,
 * so HTML-looking input stays inert as literal text (never rendered as markup).
 * This is a data-hygiene guard, not an HTML sanitizer.
 */
function stripControlChars(raw: string): string {
  let out = "";
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    const isC0 = code <= 0x1f;
    const isDelC1 = code >= 0x7f && code <= 0x9f;
    const isLineSep = code === 0x2028 || code === 0x2029;
    if (isC0 || isDelC1 || isLineSep) continue;
    out += ch;
  }
  return out;
}

/**
 * Validate a manager-entered event title: trim, drop control chars, require
 * 1..80 visible characters. Mirrors the DB CHECK so we reject early with a
 * stable machine reason.
 */
export function validateEventTitle(raw: unknown): ValidationResult<string> {
  if (typeof raw !== "string") return { ok: false, reason: "title_required" };
  const cleaned = stripControlChars(raw).trim();
  if (cleaned.length < 1) return { ok: false, reason: "title_required" };
  if (cleaned.length > FOUNDRY_TITLE_MAX) return { ok: false, reason: "title_too_long" };
  return { ok: true, value: cleaned };
}

/**
 * Validate an employee-entered display name: trim, drop control chars, require
 * 1..60 visible characters. Names are NOT unique — the same name on another
 * device is a distinct participant.
 */
export function validateDisplayName(raw: unknown): ValidationResult<string> {
  if (typeof raw !== "string") return { ok: false, reason: "name_required" };
  const cleaned = stripControlChars(raw).trim();
  if (cleaned.length < 1) return { ok: false, reason: "name_required" };
  if (cleaned.length > FOUNDRY_DISPLAY_NAME_MAX) return { ok: false, reason: "name_too_long" };
  return { ok: true, value: cleaned };
}

/**
 * Status transition policy. An event is created `open`; the owner may close it
 * once. There is no reopen in V1 — a closed event stays closed. Closing an
 * already-closed event is a no-op (idempotent), NOT an error, so a double-tap
 * or retried request is safe.
 */
export function canCloseEvent(current: FoundryEventStatus): { allowed: boolean; noop: boolean } {
  if (current === "open") return { allowed: true, noop: false };
  // already closed — idempotent success, no state change.
  return { allowed: true, noop: true };
}

/** A rotation bumps the join capability version. Old signed QRs no longer match. */
export function nextJoinVersion(current: number): number {
  if (!Number.isInteger(current) || current < 1) return 1;
  return current + 1;
}

/**
 * Whether the signed join token's version still matches the event row. The DB
 * `join_version` is the single source of truth; a rotated event invalidates any
 * previously-minted token whose version is now stale.
 */
export function isJoinVersionCurrent(tokenVersion: number, eventVersion: number): boolean {
  return Number.isInteger(tokenVersion) && tokenVersion === eventVersion;
}

/** New joins are only accepted while the event is open. */
export function canAcceptNewJoin(status: FoundryEventStatus): boolean {
  return status === "open";
}
