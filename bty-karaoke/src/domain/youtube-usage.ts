// BUILD R3 — pure presentation rules for the YouTube Search quota console.
//
// These live in the domain, not the page, for the same reason every other rule here does: a
// threshold that is computed inside JSX is a threshold nobody can test and two surfaces will
// eventually disagree about. No network, no clock, no I/O.
//
// SCOPE: the Search Queries bucket ONLY. `videos.list` belongs to a different quota bucket and has
// no representation anywhere in this module.

/** The approved daily allocation, in CALLS. One outbound search.list request = one call. */
export const SEARCH_DAILY_LIMIT = 1000;

/** Operational bands for the share of the daily allocation consumed. */
export type UsageStatus = 'NORMAL' | 'WATCH' | 'HIGH' | 'CRITICAL';

/**
 * Band a usage percentage.
 *
 * Boundaries are INCLUSIVE at the lower edge of each band: exactly 70 is WATCH, exactly 85 is
 * HIGH, exactly 95 is CRITICAL. A non-finite or negative input bands as NORMAL rather than
 * throwing — an unreadable number must never make the console look like an emergency.
 */
export function usageStatus(percent: number): UsageStatus {
  if (!Number.isFinite(percent) || percent < 70) return 'NORMAL';
  if (percent < 85) return 'WATCH';
  if (percent < 95) return 'HIGH';
  return 'CRITICAL';
}

/** Share of the daily allocation, as a percentage rounded to one decimal. */
export function usagePercent(calls: number, limit: number = SEARCH_DAILY_LIMIT): number {
  if (!Number.isFinite(calls) || !Number.isFinite(limit) || limit <= 0) return 0;
  return Math.round((calls / limit) * 1000) / 10;
}

/** Calls left of the daily allocation; never negative, so an overshoot reads as 0 rather than -3. */
export function remainingCalls(calls: number, limit: number = SEARCH_DAILY_LIMIT): number {
  return Math.max(limit - (Number.isFinite(calls) ? calls : 0), 0);
}

/**
 * Render an hour bucket in PACIFIC time, because that is the only day/hour frame Google's counter
 * agrees with. The stored bucket is a UTC hour; Pacific offsets are whole hours, so the conversion
 * is exact and never splits a bucket.
 */
export function pacificHourLabel(hourUtcIso: string | null | undefined): string | null {
  if (!hourUtcIso) return null;
  const ms = Date.parse(hourUtcIso);
  if (!Number.isFinite(ms)) return null;
  try {
    const f = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      hour12: true,
    });
    return `${f.format(new Date(ms))} PT`;
  } catch {
    return null;
  }
}
