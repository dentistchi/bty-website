/**
 * Runtime inputs for {@link evaluateForcedReset} — built from LE logs + team metrics.
 * Does **not** change AIR math; calls existing `computeAIR` with the same `ActivationRecord` shape as GET /air.
 *
 * Gaps (documented):
 * - `stage3SelectedCountIn14d`: no stage-transition audit table yet → **0** (condition never from history alone).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeAIR,
  type ActivationRecord,
} from "@/domain/leadership-engine/air";
import {
  FORCED_RESET_AIR_7D_THRESHOLD,
  FORCED_RESET_NO_QR_DAYS_THRESHOLD,
  type ResetEvalInputs,
} from "@/domain/leadership-engine/forced-reset";
import { getActiveLeague } from "@/lib/bty/arena/activeLeague";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { mondayUtcWeekOf } from "@/engine/integrity/weekly-air-report.service";

const MS_PER_DAY = 86_400_000;
const AIR_7D_MS = 7 * MS_PER_DAY;

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(ymd + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Sunday 23:59:59.999 UTC for the ISO week that starts Monday `weekMondayYmd`. */
function endOfIsoWeekSunday(weekMondayYmd: string): Date {
  const d = new Date(weekMondayYmd + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + 6);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function hasActivationInRolling7d(activations: readonly ActivationRecord[], asOf: Date): boolean {
  const start = new Date(asOf.getTime() - AIR_7D_MS);
  return activations.some((a) => a.chosen_at >= start && a.chosen_at <= asOf);
}

/** AIR_7d at `asOf` strictly below high-band floor, only if that window has ≥1 activation (avoids empty-log + no-QR double-count). */
function air7dBelowHighBandAtSnapshot(
  activations: readonly ActivationRecord[],
  asOf: Date,
): boolean {
  if (!hasActivationInRolling7d(activations, asOf)) return false;
  return computeAIR(activations, "7d", asOf).air < FORCED_RESET_AIR_7D_THRESHOLD;
}

/**
 * Two completed ISO weeks: snapshot AIR_7d at each week's Sunday end (rolling 7d ending that instant).
 * True iff both weeks have LE data in-window **and** AIR is strictly below {@link FORCED_RESET_AIR_7D_THRESHOLD}.
 */
export function air7dBelowHighBandLastTwoCompletedWeeks(
  activations: readonly ActivationRecord[],
  now: Date,
): boolean {
  const thisWeekMonday = mondayUtcWeekOf(now);
  const lastWeekMonday = addDaysYmd(thisWeekMonday, -7);
  const priorWeekMonday = addDaysYmd(thisWeekMonday, -14);
  const asOf1 = endOfIsoWeekSunday(lastWeekMonday);
  const asOf2 = endOfIsoWeekSunday(priorWeekMonday);
  return air7dBelowHighBandAtSnapshot(activations, asOf1) && air7dBelowHighBandAtSnapshot(activations, asOf2);
}

export async function loadActivationRecordsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActivationRecord[]> {
  const { data: rows } = await supabase
    .from("le_activation_log")
    .select("activation_id, user_id, type, chosen_at, due_at, completed_at")
    .eq("user_id", userId)
    .order("chosen_at", { ascending: true });

  if (!rows?.length) return [];

  const activationIds = rows.map((r: { activation_id: string }) => r.activation_id);
  const { data: verifications } = await supabase
    .from("le_verification_log")
    .select("activation_id, verified, verified_at")
    .in("activation_id", activationIds)
    .order("verified_at", { ascending: false });

  const latestVerifiedByActivation = new Map<string, boolean>();
  for (const v of verifications ?? []) {
    const aid = (v as { activation_id: string }).activation_id;
    if (!latestVerifiedByActivation.has(aid)) {
      latestVerifiedByActivation.set(aid, (v as { verified: boolean }).verified === true);
    }
  }

  return (rows as Record<string, unknown>[]).map((r) => ({
    activation_id: String(r.activation_id),
    user_id: String(r.user_id),
    type: r.type === "reset" ? "reset" : "micro_win",
    chosen_at: new Date(String(r.chosen_at)),
    due_at: new Date(String(r.due_at)),
    completed_at: r.completed_at != null ? new Date(String(r.completed_at)) : null,
    verified: latestVerifiedByActivation.get(String(r.activation_id)) ?? false,
  }));
}

async function fetchNoQrVerificationDays(supabase: SupabaseClient, userId: string, now: Date): Promise<number> {
  const { data: rows } = await supabase
    .from("le_verification_log")
    .select("verified_at, method")
    .eq("user_id", userId)
    .eq("verified", true)
    .order("verified_at", { ascending: false })
    .limit(40);

  const qr = (rows ?? []).find((r) => String((r as { method?: string }).method ?? "").toLowerCase() === "qr");
  if (!qr || !(qr as { verified_at?: string }).verified_at) {
    return Math.max(FORCED_RESET_NO_QR_DAYS_THRESHOLD, 999);
  }
  const ms = now.getTime() - new Date(String((qr as { verified_at: string }).verified_at)).getTime();
  return Math.max(0, Math.floor(ms / MS_PER_DAY));
}

async function fetchTspDecliningTwoConsecutiveWeeks(supabase: SupabaseClient): Promise<boolean> {
  const admin = getSupabaseAdmin();
  try {
    const league = await getActiveLeague(supabase, admin);
    if (!league) return false;
    const db = admin ?? supabase;
    const { data: rows } = await db
      .from("team_weekly_metrics")
      .select("tsp, week_start")
      .eq("team_id", league.league_id)
      .order("week_start", { ascending: false })
      .limit(3);
    if (!rows || rows.length < 3) return false;
    const t = rows.map((r) => Number((r as { tsp: unknown }).tsp));
    return t[0]! < t[1]! && t[1]! < t[2]!;
  } catch {
    return false;
  }
}

/**
 * Full {@link ResetEvalInputs} for `evaluateForcedReset` / {@link resetStateTransitionHandler}.
 */
export async function buildForcedResetEvalInputs(
  supabase: SupabaseClient,
  userId: string,
  activations: readonly ActivationRecord[],
  now: Date,
): Promise<ResetEvalInputs> {
  const [air7dBelow70ForTwoConsecutiveWeeks, noQrVerificationDays, tspDecliningTwoConsecutiveWeeks] =
    await Promise.all([
      Promise.resolve(air7dBelowHighBandLastTwoCompletedWeeks(activations, now)),
      fetchNoQrVerificationDays(supabase, userId, now),
      fetchTspDecliningTwoConsecutiveWeeks(supabase),
    ]);

  return {
    stage3SelectedCountIn14d: 0,
    air7dBelow70ForTwoConsecutiveWeeks,
    noQrVerificationDays,
    tspDecliningTwoConsecutiveWeeks,
  };
}
