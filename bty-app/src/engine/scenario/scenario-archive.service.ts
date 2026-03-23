/**
 * When the user has played every catalog scenario for a locale, emit {@link SCENARIOS_EXHAUSTED_EVENT}
 * and optionally rotate: drop `played_scenario_ids` entries whose last `user_scenario_choice_history`
 * play is older than {@link ARCHIVE_ROTATION_MIN_AGE_MS}.
 *
 * @see {@link selectNextScenario} — retries once after {@link checkAndRotateArchive} when the pool is empty.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchPlayedScenarioIds,
  getSelectableScenarioMetasForLocale,
  type ScenarioLocalePreference,
} from "@/engine/scenario/scenario-selector.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/** 90 days in milliseconds. */
export const ARCHIVE_ROTATION_MIN_AGE_MS = 90 * 86_400_000;

export const SCENARIOS_EXHAUSTED_EVENT = "scenarios_exhausted" as const;

export type ScenariosExhaustedPayload = {
  event: typeof SCENARIOS_EXHAUSTED_EVENT;
  userId: string;
  locale: ScenarioLocalePreference;
  /** Distinct catalog scenarios played for this locale vs available. */
  played_distinct_in_locale: number;
  available_in_locale: number;
  occurredAt: string;
};

const exhaustedListeners = new Set<(p: ScenariosExhaustedPayload) => void | Promise<void>>();

export function onScenariosExhausted(
  fn: (p: ScenariosExhaustedPayload) => void | Promise<void>,
): () => void {
  exhaustedListeners.add(fn);
  return () => exhaustedListeners.delete(fn);
}

function emitScenariosExhausted(p: ScenariosExhaustedPayload): void {
  for (const fn of exhaustedListeners) {
    try {
      void fn(p);
    } catch {
      /* listeners must not break rotation */
    }
  }
}

export type ArchiveResult = {
  /** True when distinct plays in locale ≥ available scenarios for that locale. */
  exhausted: boolean;
  /** True if {@link SCENARIOS_EXHAUSTED_EVENT} was emitted this call. */
  scenarios_exhausted_emitted: boolean;
  /** Number of scenario ids removed from `played_scenario_ids` due to age. */
  rotated_count: number;
  /**
   * Earliest UTC instant when another scenario may become playable without rotation
   * (min last-play + 90d among ids still blocking). Null if unknown or playable now.
   */
  next_available_at: string | null;
};

async function fetchLastPlayedAtByScenario(
  admin: SupabaseClient,
  userId: string,
): Promise<Map<string, string>> {
  const { data, error } = await admin
    .from("user_scenario_choice_history")
    .select("scenario_id, played_at")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  const map = new Map<string, string>();
  for (const raw of data ?? []) {
    const r = raw as { scenario_id?: string; played_at?: string };
    if (typeof r.scenario_id !== "string" || typeof r.played_at !== "string") continue;
    const prev = map.get(r.scenario_id);
    if (!prev || r.played_at > prev) map.set(r.scenario_id, r.played_at);
  }
  return map;
}

function mergeArchivedJson(
  existing: Record<string, unknown> | null | undefined,
  ids: readonly string[],
  at: string,
): Record<string, string> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, string>) }
      : {};
  for (const id of ids) {
    base[id] = at;
  }
  return base;
}

/**
 * Compares distinct catalog plays in `locale` vs {@link countAvailableScenariosForLocale};
 * if exhausted, emits {@link SCENARIOS_EXHAUSTED_EVENT} and rotates old plays out of `played_scenario_ids`.
 */
export async function checkAndRotateArchive(
  userId: string,
  locale: ScenarioLocalePreference,
): Promise<ArchiveResult> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return {
      exhausted: false,
      scenarios_exhausted_emitted: false,
      rotated_count: 0,
      next_available_at: null,
    };
  }

  const metas = await getSelectableScenarioMetasForLocale(locale);
  const available = metas.length;
  const catalogIdsForLocale = new Set(metas.map((m) => m.scenarioId));

  const played = await fetchPlayedScenarioIds(userId);
  const playedSet = new Set(played);

  let playedDistinctInLocale = 0;
  for (const id of catalogIdsForLocale) {
    if (playedSet.has(id)) playedDistinctInLocale += 1;
  }

  const exhausted = available > 0 && playedDistinctInLocale >= available;

  let scenarios_exhausted_emitted = false;
  if (exhausted) {
    scenarios_exhausted_emitted = true;
    emitScenariosExhausted({
      event: SCENARIOS_EXHAUSTED_EVENT,
      userId,
      locale,
      played_distinct_in_locale: playedDistinctInLocale,
      available_in_locale: available,
      occurredAt: new Date().toISOString(),
    });
  }

  const lastByScenario = await fetchLastPlayedAtByScenario(admin, userId);
  const cutoffMs = Date.now() - ARCHIVE_ROTATION_MIN_AGE_MS;
  const toRemove: string[] = [];
  const futureOpens: number[] = [];

  for (const sid of played) {
    const iso = lastByScenario.get(sid);
    if (!iso) {
      continue;
    }
    const t = new Date(iso).getTime();
    if (t < cutoffMs) {
      toRemove.push(sid);
    } else {
      const opensAt = t + ARCHIVE_ROTATION_MIN_AGE_MS;
      futureOpens.push(opensAt);
    }
  }

  let rotated_count = 0;
  const nowIso = new Date().toISOString();

  if (toRemove.length > 0) {
    const nextPlayed = played.filter((id) => !toRemove.includes(id));
    rotated_count = toRemove.length;

    const { data: existingRow, error: fetchErr } = await admin
      .from("user_scenario_history")
      .select("scenario_archived_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);

    const prevArchived = (existingRow as { scenario_archived_at?: unknown } | null)?.scenario_archived_at;
    const scenario_archived_at = mergeArchivedJson(
      prevArchived as Record<string, unknown> | undefined,
      toRemove,
      nowIso,
    );

    const { error: upErr } = await admin.from("user_scenario_history").upsert(
      {
        user_id: userId,
        played_scenario_ids: nextPlayed,
        scenario_archived_at,
      },
      { onConflict: "user_id" },
    );

    if (upErr) throw new Error(upErr.message);
  }

  let next_available_at: string | null = null;
  if (futureOpens.length > 0) {
    next_available_at = new Date(Math.min(...futureOpens)).toISOString();
  }

  return {
    exhausted,
    scenarios_exhausted_emitted,
    rotated_count,
    next_available_at,
  };
}
