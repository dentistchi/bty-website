// BUILD 22 — PRE-QUEUE SONG DURATION ADMISSION V1. The ONE duration-admission policy.
//
// WHY THIS EXISTS: the 900-second playback bound was enforced in exactly one place — the Host
// Start transaction (karaoke_begin_song_v2). A Guest could therefore search, pick, and be
// CONFIRMED into the queue for a video that can never play; the truth arrived minutes later, to
// a different person, on a different device. BUILD 21 made that dead-end legible for the Host.
// This module moves the same verdict to the moment of choice.
//
// THREE STATES, NEVER TWO. A boolean collapses "we know it is too long" and "we could not find
// out" into one disabled state, which would let a YouTube outage silently block every request in
// the room. `unknown` is therefore a first-class value that always resolves in the Guest's
// favour: the request proceeds and the Start-time gate remains the final defense.
//
// PURE — no DB, no network, no clock. The 900 bound is NOT redefined here; it is imported from
// the canonical playback-lease policy so one edit moves every surface.

import { MAX_LEASE_SECONDS, MIN_LEASE_SECONDS } from './playback-lease';

/**
 * The admission verdict for a video's duration.
 *
 *   allowed   — a trusted integer duration within [MIN_LEASE_SECONDS, MAX_LEASE_SECONDS]
 *   too_long  — a trusted integer duration STRICTLY above MAX_LEASE_SECONDS
 *   unknown   — no trusted positive integer duration is available (for ANY reason)
 *
 * `unknown` deliberately absorbs quota exhaustion, network failure, timeouts, malformed provider
 * payloads, unparseable durations, zero, and negatives. None of those are length facts, and
 * presenting any of them as "too long" would send a Guest hunting for a shorter version of a
 * video that is not actually too long — the same lie BUILD 21 removed from the Host surface.
 */
export type DurationAdmission = 'allowed' | 'too_long' | 'unknown';

/**
 * Classify a RAW duration in seconds.
 *
 * The input is the provider's parsed length, NOT a pre-filtered "trusted lease duration" — that
 * distinction is the whole point. `trustedLeaseDurationSeconds` returns null for 901s, which
 * cannot be told apart from "lookup failed"; this function keeps the two separate.
 *
 * Only a finite integer counts as length information. A fractional value is not something the
 * provider contract can produce, so it is treated as untrusted rather than silently floored.
 */
export function classifyDurationAdmission(seconds: number | null | undefined): DurationAdmission {
  if (seconds == null || typeof seconds !== 'number' || !Number.isFinite(seconds)) return 'unknown';
  if (!Number.isInteger(seconds)) return 'unknown';
  if (seconds < MIN_LEASE_SECONDS) return 'unknown'; // 0 and negatives are not lengths
  return seconds > MAX_LEASE_SECONDS ? 'too_long' : 'allowed';
}

/** True only for a positively-established over-limit video — the one state that blocks a submit. */
export function isTooLong(seconds: number | null | undefined): boolean {
  return classifyDurationAdmission(seconds) === 'too_long';
}

/**
 * The bound, re-exported under an admission-facing name so callers (and the API response) never
 * hard-code 900. This is an alias of the canonical constant, never a second copy of the number.
 */
export const MAX_REQUESTABLE_DURATION_SECONDS = MAX_LEASE_SECONDS;

/**
 * CLIENT-SIDE display formatter — `185 → "3:05"`, `900 → "15:00"`, `3661 → "1:01:01"`.
 *
 * Lives in the domain (not the API) on purpose: the server publishes NUMBERS, and each client
 * formats them. A server-rendered duration string would bake one locale's presentation into the
 * wire contract and could not be re-styled without a deploy. Returns null when there is nothing
 * trustworthy to show, so a caller can never render "0:00" for an unknown duration.
 */
export function formatDurationLabel(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || !Number.isInteger(seconds) || seconds < 1) {
    return null;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
