/**
 * streakBridge — pure client-streak transition with the STEP 1 legacy-format bridge (D1).
 *
 * The old arena streak wrote a device-local *midnight* day key in *unpadded* form ("2026-7-4").
 * The canonical key is 05:00-local, IANA-tz, *padded* "YYYY-MM-DD" ({@link userDayKey}). This
 * module reconciles a stored legacy value against today's canonical key without resetting an
 * existing streak. It owns ONLY the pure decision — no localStorage, no Date.now() — so the hook
 * stays a thin caller and the bridge invariants are unit-testable.
 *
 * Invariants:
 *  - Normalize BEFORE compare. Raw unpadded lexical compare is forbidden ("2026-7-4" > "2026-11-03"
 *    is true lexically but false chronologically).
 *  - Writes are always canonical padded keys.
 *  - Boundary guard: a normalized lastDayKey > today (the midnight→05:00 transition window, where
 *    the old system already stamped "tomorrow") is treated as same-day: no streak change, and the
 *    stored future marker is NOT overwritten.
 *  - Yesterday is derived by calendar −1 day on TODAY's key (never userDayKey(instant − 24h),
 *    which breaks near the 05:00 boundary, e.g. a local 04:30 instant).
 */

export type StreakState = { streak: number; lastDayKey: string };
export type StreakStep = { state: StreakState; changed: boolean };

/** "2026-7-4" → "2026-07-04"; already-padded passes through. "" if unparseable. */
export function normalizeDayKey(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const m = raw.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return "";
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** Calendar −1 day on a canonical "YYYY-MM-DD" key — same UTC math as userDayKey's internal rollback. */
export function previousDayKey(dayKey: string): string {
  const [y, mo, d] = dayKey.split("-").map(Number);
  const prev = new Date(Date.UTC(y, mo - 1, d) - 86_400_000);
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}-${String(
    prev.getUTCDate(),
  ).padStart(2, "0")}`;
}

/**
 * Compute the next streak state. `todayKey` MUST be a canonical padded key from userDayKey.
 * `changed` = whether the caller should persist `state` (false = same-day / guard → no write).
 */
export function nextStreakState(prev: StreakState | null | undefined, todayKey: string): StreakStep {
  if (!prev || typeof prev.streak !== "number" || !prev.lastDayKey) {
    return { state: { streak: 1, lastDayKey: todayKey }, changed: true };
  }

  const last = normalizeDayKey(prev.lastDayKey);
  if (!last) {
    // Unparseable legacy value → restart clean at today.
    return { state: { streak: 1, lastDayKey: todayKey }, changed: true };
  }

  // Same-day OR future marker (boundary guard). Early-return WITHOUT overwriting lastDayKey.
  if (last === todayKey || last > todayKey) {
    return { state: { streak: prev.streak, lastDayKey: prev.lastDayKey }, changed: false };
  }

  const nextStreak = last === previousDayKey(todayKey) ? prev.streak + 1 : 1;
  return { state: { streak: nextStreak, lastDayKey: todayKey }, changed: true };
}
