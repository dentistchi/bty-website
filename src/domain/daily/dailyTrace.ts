/**
 * Center Daily Trace — pure projection of "which recent BTY days did I return to?" (STEP 1B).
 *
 * PRESENCE-AS-LIGHT, never a streak or a score. Each recent local BTY day is either present
 * (the user returned → a `user_day` row exists → intensity 1) or absent (no row → intensity 0).
 * This module computes ONLY the numberless per-day shape; it exposes NO count, total, consecutive
 * run, target, or completion percentage, and it knows nothing about Arena, XP, or ranking.
 *
 * Pure domain: no I/O, no `Date.now()`, no side effects. Callers pass in `todayKey` (already
 * resolved via {@link userDayKey} in the service layer) and the set of present day-keys — day-key
 * rules are NEVER duplicated here or on the client.
 */

/** One day of the trace: a local day label and its presence light (1 = returned, 0 = not). */
export type DailyTracePoint = { date: string; intensity: 0 | 1 };

/** The Center Daily Trace response shape (future meWeeklyRhythm source, STEP 1C). */
export type DailyTrace = { dailyTrace: DailyTracePoint[] };

/**
 * The previous local day label for a `YYYY-MM-DD` key. Pure calendar subtraction via UTC math
 * (matches {@link userDayKey}'s own approach — the label is a plain local date, so UTC arithmetic
 * on it never touches a timezone). Handles month / year / leap boundaries.
 */
export function previousDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d) - 86_400_000);
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}-${String(
    prev.getUTCDate(),
  ).padStart(2, "0")}`;
}

/** The `days` most recent day-key labels ending at `todayKey`, ordered oldest → today. Pure. */
export function recentDayKeys(todayKey: string, days: number): string[] {
  const keys: string[] = [];
  let k = todayKey;
  for (let i = 0; i < days; i++) {
    keys.push(k);
    k = previousDayKey(k);
  }
  return keys.reverse();
}

/**
 * Build the presence-as-light series for the `days` recent days ending at `todayKey`.
 * present day-key → intensity 1, else 0. Numberless: the output carries only {date, intensity};
 * there is deliberately no count / total / streak / target field to read as a habit tracker. Pure.
 */
export function buildDailyTrace(
  todayKey: string,
  presentKeys: Iterable<string>,
  days = 7,
): DailyTracePoint[] {
  const present = presentKeys instanceof Set ? presentKeys : new Set(presentKeys);
  return recentDayKeys(todayKey, days).map(
    (date): DailyTracePoint => ({ date, intensity: present.has(date) ? 1 : 0 }),
  );
}
