// External-playback metering LEASE math — BUILD 20M (P0 entitlement integrity).
//
// The exploit (measured): FREE usage is metered over the request's [started_at, ended_at]
// interval, and Host Finish sets ended_at=now → accrual stops while YouTube keeps playing
// externally, making the 15-min FREE allowance reusable all day.
//
// The fix: once an external YouTube handoff is authorized for a song of duration D at time
// T, the account is charged for a NON-SHRINKABLE playback lease [T, T+D]. Finish, Queue
// completion, Event end, background, and relaunch MUST NOT shorten it. Consecutive songs
// charge only the NON-OVERLAPPING extension (union of intervals — never double-charged).
//
// This module is PURE (no DB, no I/O, no clock) so the union math + the pre-handoff
// authorization decision are fully unit-testable and identical wherever they run. The
// authoritative persistence (a lease column/table + atomic RPC) calls into this logic;
// this file commits nothing to the database.

/** Karaoke-duration sanity bounds. A resolved duration outside these is NOT trusted:
 *  too-short (<MIN) or a malformed multi-hour value (>MAX) must never silently consume or
 *  bypass entitlement. MAX == the FREE daily limit: one song can never lease more than the
 *  whole free window (a 3-hour "video" is a compilation/mistake → treated as unresolved). */
export const MIN_LEASE_SECONDS = 1;
export const MAX_LEASE_SECONDS = 900; // 15:00 — matches karaoke_usage_policy.free_limit_seconds

/**
 * Parse an ISO-8601 duration (YouTube `contentDetails.duration`, e.g. "PT3M42S", "PT1H2M",
 * "PT45S") to whole seconds. Returns null for anything unparseable — the caller treats null
 * as "duration unknown" and, per the approved policy, FAILS CLOSED (blocks Start).
 */
export function parseIso8601DurationSeconds(iso: string | null | undefined): number | null {
  if (!iso || typeof iso !== 'string') return null;
  const m = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso.trim());
  if (!m) return null;
  const [, d, h, min, s] = m;
  if (d === undefined && h === undefined && min === undefined && s === undefined) return null;
  const total =
    (Number(d ?? 0) * 86400) + (Number(h ?? 0) * 3600) + (Number(min ?? 0) * 60) + Number(s ?? 0);
  return Number.isFinite(total) && total > 0 ? total : null;
}

/**
 * Validate a resolved duration against the karaoke sanity bounds. Returns the trusted
 * duration in seconds, or null when it is unknown/malformed/out-of-range → fail closed.
 */
export function trustedLeaseDurationSeconds(rawSeconds: number | null | undefined): number | null {
  if (rawSeconds == null || !Number.isFinite(rawSeconds)) return null;
  const secs = Math.floor(rawSeconds);
  if (secs < MIN_LEASE_SECONDS || secs > MAX_LEASE_SECONDS) return null;
  return secs;
}

export interface LeaseExtension {
  /** The lease end after this start — never earlier than the prior lease end (non-shrinkable). */
  newLeaseEndsAtMs: number;
  /** Seconds this start adds to the billable union (0 when fully inside the current lease). */
  chargeSeconds: number;
}

/**
 * Compute the union extension for starting a song of `durationSeconds` at `nowMs`, given the
 * account's current lease end (`currentLeaseEndsAtMs`, or null/≤now when none/expired).
 *
 *  A/D. no active lease (end ≤ now)      → charge = D,            newEnd = now + D
 *  C.   active lease ending at E (> now) → charge = max(0, N - E) where N = now + D,
 *                                          newEnd = max(E, N)   (union; overlap not charged)
 */
export function computeLeaseExtension(
  currentLeaseEndsAtMs: number | null,
  durationSeconds: number,
  nowMs: number,
): LeaseExtension {
  const proposedEndMs = nowMs + durationSeconds * 1000;
  const activeEndMs = currentLeaseEndsAtMs != null && currentLeaseEndsAtMs > nowMs ? currentLeaseEndsAtMs : nowMs;
  const chargeMs = Math.max(0, proposedEndMs - activeEndMs);
  return {
    newLeaseEndsAtMs: Math.max(activeEndMs, proposedEndMs),
    chargeSeconds: Math.round(chargeMs / 1000),
  };
}

export type StartAuthorization =
  | { authorized: true; charge: LeaseExtension }
  | { authorized: false; reason: 'duration_unknown' | 'insufficient' };

export interface AuthorizeStartInput {
  /** true for PRO / an ACTIVE timed pass — time-unlimited, always authorized, never charged. */
  unlimited: boolean;
  /** Remaining FREE seconds for this account's current daily window (ignored when unlimited). */
  remainingSeconds: number;
  /** Trusted duration (from trustedLeaseDurationSeconds); null → unresolved. */
  durationSeconds: number | null;
  /** Account's current lease end (ms), or null when none/expired. */
  currentLeaseEndsAtMs: number | null;
  nowMs: number;
}

/**
 * Atomic PRE-HANDOFF decision (Part 5): resolve the extension and verify entitlement BEFORE
 * a start commits. FAIL CLOSED — an unresolved duration blocks Start (never "open now, meter
 * later"). Exact-boundary (charge == remaining) is authorized (≤). PRO/pass are always
 * authorized with a zero charge (their lease is the pass window, computed by the caller).
 */
export function authorizeStart(input: AuthorizeStartInput): StartAuthorization {
  const { unlimited, remainingSeconds, durationSeconds, currentLeaseEndsAtMs, nowMs } = input;
  if (unlimited) {
    const dur = durationSeconds ?? 0;
    return { authorized: true, charge: computeLeaseExtension(currentLeaseEndsAtMs, dur, nowMs) };
  }
  if (durationSeconds == null) return { authorized: false, reason: 'duration_unknown' };
  const charge = computeLeaseExtension(currentLeaseEndsAtMs, durationSeconds, nowMs);
  if (charge.chargeSeconds > Math.max(0, Math.floor(remainingSeconds))) {
    return { authorized: false, reason: 'insufficient' };
  }
  return { authorized: true, charge };
}
