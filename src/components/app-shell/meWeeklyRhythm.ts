/**
 * Me-tab weekly rhythm — PROVENANCE BOUNDARY (guardrail; Native Me Provenance Guardrails STEP 1).
 *
 * The native Me tab's WeeklyOrb renders a numberless "self trace" of light. Its ONLY input is a
 * plain array of DAILY LIGHT INTENSITIES ({@link MeWeeklyRhythm}) — no XP, no rank, no score, no
 * dates, no reflection fields. This module is the single, explicit, swappable seam between that
 * self-facing light and its CURRENT data carrier.
 *
 * ⚠️ TEMPORARY CARRIER — NOT a Center/self source.
 * The intensities currently come from GET /api/arena/weekly-stats, an ARENA endpoint. That is a
 * rhythm CARRIER of convenience while no Center-owned equivalent exists — it must NOT be treated
 * as, or described to the user as, a true Center/self source. As of STEP 1 no authoritative
 * Center/self daily-trace source produces a 7-day intensity series (checked: src/domain/daily/*,
 * /api/me/daily, /api/me/day/open — none emit a barIntensity / dailyBarSeries series).
 *
 * WHEN a Center/self daily-trace source exists, swap ONLY the fetch inside
 * {@link fetchMeWeeklyRhythm}. WeeklyOrb and the Me tab depend on {@link MeWeeklyRhythm}, never on
 * Arena, so the visible experience needs no change and the coupling flips in one place.
 *
 * Guardrails this boundary enforces:
 *  - narrow read: ONLY dailyBarSeries[].barIntensity is destructured (never XP / reflections / etc.)
 *  - fail-soft: any failure → [] (a quiet resting orb), never a throw into Me
 *  - the Arena coupling lives HERE and nowhere else — the seam is named and swappable
 */

/** Daily light intensities (0–5, up to 7 days), oldest→today. Numberless: this array is the
 *  WeeklyOrb's whole contract — it carries light, never a number, rank, or score shown to a user. */
export type MeWeeklyRhythm = number[];

/** Explicit provenance marker for the CURRENT (temporary) rhythm carrier. Change this alongside
 *  the fetch below when re-sourcing to a Center/self daily-trace source. */
export const ME_WEEKLY_RHYTHM_CARRIER = "arena/weekly-stats (temporary)" as const;

/** Narrow shape of the carrier payload — ONLY barIntensity is read; every other weekly-stats
 *  field (XP, reflectionCount, quest flags, …) is deliberately un-typed so it cannot be read. */
type CarrierPayloadNarrow = { dailyBarSeries?: Array<{ barIntensity?: number }> };

/**
 * Read the week's numberless light rhythm for the Me-tab WeeklyOrb. RAW fail-soft fetch
 * (same-origin, cookie credentials + warn + resting-orb []-fallback), consistent with the shell's
 * other Me reads. This is the ONE place the Arena coupling lives — swap the fetch here to re-source.
 */
export async function fetchMeWeeklyRhythm(): Promise<MeWeeklyRhythm> {
  try {
    // ⚠️ SWAP SEAM: replace this Arena endpoint with a Center/self daily-trace source when one
    // exists. Nothing downstream (WeeklyOrb / Me tab) changes — they depend on MeWeeklyRhythm.
    const res = await fetch("/api/arena/weekly-stats", { credentials: "include" });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const data = (await res.json()) as CarrierPayloadNarrow;
    const series = Array.isArray(data.dailyBarSeries) ? data.dailyBarSeries : [];
    return series.map((d) => (typeof d?.barIntensity === "number" ? d.barIntensity : 0));
  } catch (e) {
    console.warn(
      "[app-shell/me] weekly rhythm carrier fell back (resting orb):",
      e instanceof Error ? e.message : e,
    );
    return [];
  }
}
