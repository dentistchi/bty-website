// External-playback metering LEASE math — BUILD 20M (P0 entitlement integrity).
//
// Exploit (measured): FREE usage is metered over the request's [started_at, ended_at]
// interval, and Host Finish sets ended_at=now → accrual stops while YouTube keeps playing
// externally, making the 15-min FREE allowance reusable all day.
//
// Fix: once an external YouTube handoff is authorized for a song of duration D at time T,
// the account is charged a NON-SHRINKABLE lease [T, T+D]. Finish / Queue completion / Event
// end / background / relaunch MUST NOT shorten it. Consecutive songs charge only the
// NON-OVERLAPPING extension `lease_seconds = max(0, N-E)` (union — never double-charged).
// Account-level billing sums `lease_seconds` (NOT each row's full interval), so overlap is
// excluded by construction. Timed passes require the WHOLE video to finish inside the pass
// window (proposed end ≤ pass.expires_at). Unknown duration FAILS CLOSED (never a fallback).
//
// PURE (no DB, no I/O, no clock) so union + pre-handoff authorization are unit-testable and
// identical wherever they run. The authoritative persistence (v2 RPCs + a lease column) calls
// this logic; this file commits nothing to the database.

/** Karaoke-duration sanity bounds; outside → treated as unresolved (fail closed). MAX == the
 *  FREE daily limit so one song can never lease more than the whole window. */
export const MIN_LEASE_SECONDS = 1;
export const MAX_LEASE_SECONDS = 900; // 15:00 — matches karaoke_usage_policy.free_limit_seconds

/** Parse ISO-8601 duration ("PT3M42S", "PT1H2M", "PT45S") → whole seconds; null if unparseable. */
export function parseIso8601DurationSeconds(iso: string | null | undefined): number | null {
  if (!iso || typeof iso !== 'string') return null;
  const m = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso.trim());
  if (!m) return null;
  const [, d, h, min, s] = m;
  if (d === undefined && h === undefined && min === undefined && s === undefined) return null;
  const total = Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0);
  return Number.isFinite(total) && total > 0 ? total : null;
}

/** Trust a resolved duration only inside [MIN, MAX]; else null → fail closed. */
export function trustedLeaseDurationSeconds(rawSeconds: number | null | undefined): number | null {
  if (rawSeconds == null || !Number.isFinite(rawSeconds)) return null;
  const secs = Math.floor(rawSeconds);
  if (secs < MIN_LEASE_SECONDS || secs > MAX_LEASE_SECONDS) return null;
  return secs;
}

export interface LeaseExtension {
  /** Lease end after this start — never earlier than the prior end (non-shrinkable). */
  newLeaseEndsAtMs: number;
  /** The billable NON-OVERLAPPING extension (persisted as `lease_seconds`; 0 fully inside lease). */
  chargeSeconds: number;
}

/**
 * Union extension for starting a song of `durationSeconds` at `nowMs` given the account's
 * current max lease end (`currentLeaseEndsAtMs`, or null/≤now = none/expired).
 *   no active lease → charge = D,            newEnd = now + D
 *   active end E    → charge = max(0, N - E), newEnd = max(E, N)   (N = now + D)
 */
export function computeLeaseExtension(
  currentLeaseEndsAtMs: number | null,
  durationSeconds: number,
  nowMs: number,
): LeaseExtension {
  const proposedEndMs = nowMs + durationSeconds * 1000;
  const activeEndMs = currentLeaseEndsAtMs != null && currentLeaseEndsAtMs > nowMs ? currentLeaseEndsAtMs : nowMs;
  const chargeMs = Math.max(0, proposedEndMs - activeEndMs);
  return { newLeaseEndsAtMs: Math.max(activeEndMs, proposedEndMs), chargeSeconds: Math.round(chargeMs / 1000) };
}

/** The account's effective entitlement at Start (server-resolved). */
export type Entitlement =
  | { kind: 'pro' } // base PRO — unlimited, never metered, never a pass
  | { kind: 'free'; remainingSeconds: number } // FREE daily allowance remaining
  | { kind: 'pass_active'; expiresAtMs: number } // an ACTIVE timed pass window
  | { kind: 'pass_selected'; totalDurationSeconds: number }; // first-start activation candidate

export type StartDecision =
  | { authorized: true; charge: LeaseExtension; passActivationExpiresAtMs?: number }
  | { authorized: false; reason: 'duration_unknown' | 'insufficient_free' | 'pass_insufficient' };

export interface AuthorizeStartInput {
  entitlement: Entitlement;
  /** Trusted duration (from trustedLeaseDurationSeconds); null → unresolved → fail closed. */
  durationSeconds: number | null;
  /** Account-level current lease end (ms) — the MAX across ALL the account's rooms, or null. */
  currentLeaseEndsAtMs: number | null;
  nowMs: number;
}

/**
 * Atomic PRE-HANDOFF decision (Part 5). FAIL CLOSED on unknown duration. FREE: the union
 * extension must fit remaining. Timed pass (ACTIVE or first-activation SELECTED): the WHOLE
 * video must finish inside the pass window (this song's own end ≤ pass expiry) — closing the
 * "5s left on a 1h pass → start a 10-min video" bypass. Boundaries use ≤ (deterministic).
 */
export function authorizeStart(input: AuthorizeStartInput): StartDecision {
  const { entitlement, durationSeconds, currentLeaseEndsAtMs, nowMs } = input;
  if (durationSeconds == null) return { authorized: false, reason: 'duration_unknown' };
  const charge = computeLeaseExtension(currentLeaseEndsAtMs, durationSeconds, nowMs);
  const songEndMs = nowMs + durationSeconds * 1000; // THIS song's own external-playback end

  switch (entitlement.kind) {
    case 'pro':
      return { authorized: true, charge };
    case 'free':
      return charge.chargeSeconds > Math.max(0, Math.floor(entitlement.remainingSeconds))
        ? { authorized: false, reason: 'insufficient_free' }
        : { authorized: true, charge };
    case 'pass_active':
      // The whole video must finish before the pass expires.
      return songEndMs > entitlement.expiresAtMs
        ? { authorized: false, reason: 'pass_insufficient' }
        : { authorized: true, charge };
    case 'pass_selected': {
      // First activation: window becomes [now, now + total]. The full video must fit.
      const activationExpiresMs = nowMs + entitlement.totalDurationSeconds * 1000;
      return songEndMs > activationExpiresMs
        ? { authorized: false, reason: 'pass_insufficient' }
        : { authorized: true, charge, passActivationExpiresAtMs: activationExpiresMs };
    }
  }
}
