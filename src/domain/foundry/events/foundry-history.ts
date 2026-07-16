/**
 * Foundry Event History — domain (pure).
 *
 * The rules that decide what qualifies as a *historical* Foundry Event and how
 * history is ordered. No DB, no I/O. This is the single canonical definition the
 * service query mirrors and the UI must NOT reconstruct.
 *
 * Boundary: History is *historical visibility only* — a factual record of an
 * executed Event. It is NOT a reusable module library, learning memory, a brief,
 * a current standard, run comparison, or a rerun system. It surfaces only what
 * truthfully happened.
 *
 * Qualification: an Event is historical exactly when it is TERMINAL. In V1 the
 * only terminal status is `closed` (an open Event is *current*, never history).
 * There is no separate cancelled/expired state in the V1 event model, so there
 * is nothing else to include or exclude — if a terminal status is ever added it
 * must be added HERE (and to the query), never inferred at a call site.
 */

import type { FoundryEventStatus } from "./foundry-event";

/** The event statuses that count as historical (terminal). V1: `closed` only. */
export const FOUNDRY_HISTORY_TERMINAL_STATUSES: readonly FoundryEventStatus[] = ["closed"];

/**
 * True only for a TERMINAL event (belongs in History). An `open` event is current
 * work and must be excluded. Accepts an arbitrary string so a legacy/unknown DB
 * status is treated as non-historical rather than throwing.
 */
export function isHistoricalEventStatus(status: string): boolean {
  return (FOUNDRY_HISTORY_TERMINAL_STATUSES as readonly string[]).includes(status);
}

/** Minimal shape the recency comparator needs — a projection of an event row. */
export type HistoryOrderable = {
  /** The terminal (ended) timestamp — `closed_at`. May be null on legacy rows. */
  endedAt: string | null;
  /** Creation timestamp — the deterministic fallback when `endedAt` is null. */
  createdAt: string;
  /** Stable final tie-breaker so equal timestamps never reorder run-to-run. */
  eventId: string;
};

function timeValue(iso: string | null): number {
  if (!iso) return Number.NEGATIVE_INFINITY; // null ended date sorts last (oldest)
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

/**
 * Deterministic history ordering: most-recently-ended first. When `endedAt` is
 * null (or unparseable) it falls back to `createdAt`; a final `eventId` ascending
 * tie-break guarantees a total order (no run-to-run drift, no page-boundary
 * instability). Use with `Array.prototype.sort`.
 */
export function compareHistoryRecency(a: HistoryOrderable, b: HistoryOrderable): number {
  const ae = timeValue(a.endedAt);
  const be = timeValue(b.endedAt);
  if (ae !== be) return be - ae; // ended desc
  const ac = timeValue(a.createdAt);
  const bc = timeValue(b.createdAt);
  if (ac !== bc) return bc - ac; // created desc
  return a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0; // id asc
}

/**
 * Honest completion arithmetic. `incomplete` is only meaningful when the joined
 * denominator is known and completions do not exceed it; otherwise it is null
 * (never a fabricated or negative count). We deliberately do NOT compute a
 * percentage — an incomplete denominator must never be presented as a rate.
 */
export function historyParticipationCounts(participantCount: number, completionCount: number): {
  participantCount: number;
  completionCount: number;
  incompleteCount: number | null;
} {
  const joined = Number.isFinite(participantCount) && participantCount >= 0 ? Math.floor(participantCount) : 0;
  const completed = Number.isFinite(completionCount) && completionCount >= 0 ? Math.floor(completionCount) : 0;
  const incomplete = completed <= joined ? joined - completed : null;
  return { participantCount: joined, completionCount: completed, incompleteCount: incomplete };
}
