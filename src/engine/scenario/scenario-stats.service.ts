/**
 * Aggregates Arena play signals from `user_scenario_choice_history` for LRI, Foundry recommender, and dashboards.
 *
 * - **playsByFlagType**: completion rows (CHOICE_CONFIRMED) per `flag_type`.
 * - **completionRate**: distinct `scenario_id` played ÷ {@link countAvailableScenariosForLocale} for the locale.
 * - **streakDaysUtc**: consecutive UTC calendar days ending **today** with ≥1 completion (no play today → 0).
 *
 * Intended as an optional input signal for LRI readiness tuning and Foundry program scoring (wire explicitly where needed).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  countAvailableScenariosForLocale,
  type ScenarioLocalePreference,
} from "@/engine/scenario/scenario-selector.service";

export type ScenarioStats = {
  /** Row counts per `flag_type` (one row per completed choice in history). */
  playsByFlagType: Record<string, number>;
  /** Distinct `scenario_id` values present in choice history. */
  uniqueScenariosPlayed: number;
  /** Denominator for completion rate from catalog + locale (see scenario-selector). */
  totalAvailableInLocale: number;
  /** `uniqueScenariosPlayed / totalAvailableInLocale`, or 0 if denominator is 0. */
  completionRate: number;
  /** Consecutive UTC days including today with at least one play; 0 if none today. */
  streakDaysUtc: number;
  locale: ScenarioLocalePreference;
};

type ChoiceRow = {
  scenario_id: string;
  flag_type: string;
  played_at: string;
};

function utcDayKeyFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/**
 * Streak: walk backward from **today** UTC day; stop at first day with no play.
 */
export function computeStreakDaysUtcStrict(daysWithPlay: ReadonlySet<string>): number {
  const now = new Date();
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const day = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i, 0, 0, 0, 0),
    );
    const key = day.toISOString().slice(0, 10);
    if (daysWithPlay.has(key)) streak += 1;
    else break;
  }
  return streak;
}

/** Aggregate row counts by `flag_type`. */
export function playsByFlagTypeFromRows(rows: readonly ChoiceRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const f = typeof r.flag_type === "string" && r.flag_type.length > 0 ? r.flag_type : "unknown";
    out[f] = (out[f] ?? 0) + 1;
  }
  return out;
}

async function fetchChoiceHistory(userId: string): Promise<ChoiceRow[]> {
  const admin = getSupabaseAdmin();
  if (!admin) return [];

  const { data, error } = await admin
    .from("user_scenario_choice_history")
    .select("scenario_id, flag_type, played_at")
    .eq("user_id", userId)
    .order("played_at", { ascending: false });

  if (error || !data?.length) return [];

  return (data as ChoiceRow[]).filter(
    (r) => typeof r.scenario_id === "string" && typeof r.played_at === "string",
  );
}

function emptyStats(locale: ScenarioLocalePreference): ScenarioStats {
  return {
    playsByFlagType: {},
    uniqueScenariosPlayed: 0,
    totalAvailableInLocale: 0,
    completionRate: 0,
    streakDaysUtc: 0,
    locale,
  };
}

/**
 * Scenario engagement metrics for optional weighting (e.g. LRI context, Foundry match tuning).
 */
export async function getScenarioStats(
  userId: string,
  locale: ScenarioLocalePreference = "en",
): Promise<ScenarioStats> {
  const [rows, totalAvailableInLocale] = await Promise.all([
    fetchChoiceHistory(userId),
    countAvailableScenariosForLocale(locale),
  ]);

  if (rows.length === 0) {
    return {
      playsByFlagType: {},
      uniqueScenariosPlayed: 0,
      totalAvailableInLocale,
      completionRate: 0,
      streakDaysUtc: 0,
      locale,
    };
  }

  const playsByFlagType = playsByFlagTypeFromRows(rows);
  const uniqueIds = new Set(rows.map((r) => r.scenario_id));
  const uniqueScenariosPlayed = uniqueIds.size;

  const dayKeys = new Set<string>();
  for (const r of rows) {
    const k = utcDayKeyFromIso(r.played_at);
    if (k) dayKeys.add(k);
  }
  const streakDaysUtc = computeStreakDaysUtcStrict(dayKeys);

  const completionRate =
    totalAvailableInLocale > 0
      ? Math.min(1, uniqueScenariosPlayed / totalAvailableInLocale)
      : 0;

  return {
    playsByFlagType,
    uniqueScenariosPlayed,
    totalAvailableInLocale,
    completionRate,
    streakDaysUtc,
    locale,
  };
}

/**
 * Latest completed choice row’s `flag_type` (Arena scenario intent), for mentor UI tags.
 */
export async function getLastChoiceFlagType(
  userId: string,
  supabase?: SupabaseClient,
): Promise<string | null> {
  const client = supabase ?? getSupabaseAdmin();
  if (!client) return null;
  const { data, error } = await client
    .from("user_scenario_choice_history")
    .select("flag_type")
    .eq("user_id", userId)
    .order("played_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const ft = (data as { flag_type?: string }).flag_type;
  return typeof ft === "string" && ft.trim() ? ft.trim() : null;
}
