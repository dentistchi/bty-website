/**
 * Me-tab weekly rhythm — PROVENANCE BOUNDARY (Center Daily Trace STEP 1C: flipped to self-source).
 *
 * The native Me tab's WeeklyOrb renders a numberless "self trace" of light. Its ONLY input is a
 * plain array of DAILY LIGHT INTENSITIES ({@link MeWeeklyRhythm}) — no XP, no rank, no score, no
 * dates, no reflection fields. This module is the single, named seam between that self-facing light
 * and its data source.
 *
 * PROVENANCE (now Center/self-owned):
 *  - WeeklyOrb is fed by the Center/self-return trace GET /api/me/daily-trace (STEP 1B).
 *  - dailyTrace is PRESENCE-AS-LIGHT derived from `user_day`: intensity 1 = the user returned to
 *    that day (a self-return row exists), 0 = no row / resting.
 *  - It is NOT a streak, score, XP, rank, leaderboard, or Arena-activity metric. A quiet day is
 *    simply unlit (rest), never a deficit.
 *
 * The prior temporary Arena carrier (/api/arena/weekly-stats) is no longer read here (that route
 * still exists and serves Arena surfaces; it just no longer feeds native Me). Should the source
 * change again, swap ONLY the fetch inside {@link fetchMeWeeklyRhythm} — WeeklyOrb and the Me tab
 * depend on {@link MeWeeklyRhythm}, so the visible experience needs no change.
 *
 * Guardrails this boundary enforces:
 *  - narrow read: ONLY dailyTrace[].intensity is consumed (never a date, count, or any other field)
 *  - display mapping is numberless: presence → a soft visible light, absence → rest — NOT a score
 *  - fail-soft: any failure → [] (a quiet resting orb), never a throw into Me
 */

/** Daily light intensities (up to 7 days), oldest→today. Numberless: this array is the WeeklyOrb's
 *  whole contract — it carries light, never a number, rank, or score shown to a user. */
export type MeWeeklyRhythm = number[];

/** Explicit provenance marker for the CURRENT rhythm source (Center/self-return trace). */
export const ME_WEEKLY_RHYTHM_CARRIER = "me/daily-trace (Center self-return)" as const;

/**
 * Display light for a present self-return day. Presence is binary (0 | 1) at the source; here 1 is
 * mapped to a soft, clearly-visible orb light — display scaling ONLY, never surfaced as a number or
 * score. Absence maps to 0 (resting). Deliberately mid-range (below the orb's gold-peak/breath tier)
 * so a returned day reads warm and alive without becoming a "high score".
 */
const PRESENT_LIGHT = 3;

/** Narrow shape of the daily-trace payload — ONLY `intensity` is read; `date` and any other field
 *  are deliberately un-typed so they cannot be consumed. */
type DailyTraceNarrow = { dailyTrace?: Array<{ intensity?: number }> };

/**
 * Read the week's numberless light rhythm for the Me-tab WeeklyOrb from the Center/self-return
 * trace. RAW fail-soft fetch (same-origin, cookie credentials + warn + resting-orb []-fallback),
 * consistent with the shell's other Me reads. This is the ONE place the source coupling lives.
 */
export async function fetchMeWeeklyRhythm(): Promise<MeWeeklyRhythm> {
  try {
    const res = await fetch("/api/me/daily-trace", { credentials: "include" });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const data = (await res.json()) as DailyTraceNarrow;
    const series = Array.isArray(data.dailyTrace) ? data.dailyTrace : [];
    // Presence-as-light: a self-return day → soft visible light; otherwise rest. Only `intensity`
    // is consumed; the mapping is numberless (never a count/streak/score reaches the orb).
    return series.map((d) => (d?.intensity === 1 ? PRESENT_LIGHT : 0));
  } catch (e) {
    console.warn(
      "[app-shell/me] daily-trace rhythm fell back (resting orb):",
      e instanceof Error ? e.message : e,
    );
    return [];
  }
}
