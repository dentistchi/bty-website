/**
 * After Foundry program completion: measure Arena flag coverage gaps, preload next Arena scenario via
 * {@link getNextScenarioForSession} (`foundry_return` + program tag bias), optional Elite Spec nomination,
 * and emit {@link FoundryExitReadyPayload}.
 *
 * **Orchestration:** Call {@link handleFoundryCompletion} only via
 * `program-completion.service` (`markProgramComplete`, `notifyProgramCompleted`) so DB progress,
 * phase gate checks, and recommendation refresh stay consistent. Do not statically import
 * `program-completion.service` from this module (cycle with `notifyProgramCompleted`).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ELITE_SPEC_READINESS_THRESHOLD,
  handleEliteSpecNomination,
  type EliteSpecResult,
} from "@/engine/integration/elite-spec-flow";
import { getNextScenarioForSession, type ScenarioRouteResult } from "@/engine/integration/scenario-type-router";
import type { ProgramCatalogRow } from "@/engine/foundry/program-recommender.service";
import { getPromotionReadiness, type PromotionReadiness } from "@/engine/integrity/promotion-readiness.service";
import { getScenarioStats, type ScenarioStats } from "@/engine/scenario/scenario-stats.service";
import type { ScenarioLocalePreference } from "@/engine/scenario/scenario-selector.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type FoundryExitReadyPayload = {
  event: "foundry_exit_ready";
  userId: string;
  programId: string;
  /** Preloaded next scenario for Arena shell (null if ejected). */
  next_scenario: ScenarioRouteResult["scenario"] | null;
  scenarioRoute: ScenarioRouteResult | null;
  coverage_gap_flag_types: string[];
};

export type FoundryReturnResult = {
  programId: string;
  scenarioStats: ScenarioStats;
  /** `flag_type` keys tied to minimum play coverage (gaps). */
  coverage_gap_flag_types: string[];
  nextScenarioRoute: ScenarioRouteResult | null;
  promotionReadiness: PromotionReadiness;
  eliteSpec: EliteSpecResult | null;
};

const exitListeners = new Set<(p: FoundryExitReadyPayload) => void | Promise<void>>();

export function onFoundryExitReady(
  fn: (p: FoundryExitReadyPayload) => void | Promise<void>,
): () => void {
  exitListeners.add(fn);
  return () => exitListeners.delete(fn);
}

function emitFoundryExitReady(p: FoundryExitReadyPayload): void {
  for (const fn of exitListeners) {
    try {
      void fn(p);
    } catch {
      /* listeners must not break completion */
    }
  }
}

/** Flags with the lowest play counts in {@link ScenarioStats.playsByFlagType} (coverage gaps). */
export function flagTypesWithCoverageGap(stats: ScenarioStats): string[] {
  const entries = Object.entries(stats.playsByFlagType);
  if (entries.length === 0) return [];
  let min = Infinity;
  for (const [, n] of entries) {
    if (typeof n === "number" && n < min) min = n;
  }
  if (!Number.isFinite(min)) return [];
  return entries
    .filter(([, n]) => typeof n === "number" && n === min)
    .map(([f]) => f)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Map `program_catalog` tags to a DB `flag_type` for {@link selectNextScenario} bias.
 */
export function preferFlagTypeFromProgram(row: ProgramCatalogRow | null): string | undefined {
  if (!row) return undefined;
  for (const tag of row.flag_tags ?? []) {
    const t = tag.trim();
    if (!t) continue;
    const u = t.toUpperCase().replace(/-/g, "_");
    if (u.includes("INTEGRITY") || u === "INTEGRITY_SLIP") return "INTEGRITY_SLIP";
    if (u.includes("HERO") || u === "HERO_TRAP") return "HERO_TRAP";
    if (u.includes("CLEAN")) return "CLEAN";
    if (u.includes("ROLE_MIRROR") || u.includes("MIRROR")) return "ROLE_MIRROR";
    if (u.length > 0) return u;
  }
  for (const tag of row.scenario_tags ?? []) {
    const s = tag.toLowerCase();
    if (s.includes("integrity") || s.includes("slip")) return "INTEGRITY_SLIP";
    if (s.includes("hero")) return "HERO_TRAP";
    if (s.includes("mirror") || s.includes("empath")) return "ROLE_MIRROR";
  }
  return undefined;
}

async function fetchProgramRow(
  programId: string,
  admin: SupabaseClient,
): Promise<ProgramCatalogRow | null> {
  const { data, error } = await admin
    .from("program_catalog")
    .select("program_id, title, scenario_tags, phase_tags, flag_tags")
    .eq("program_id", programId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as {
    program_id?: string;
    title?: string;
    scenario_tags?: unknown;
    phase_tags?: unknown;
    flag_tags?: unknown;
  };
  return {
    program_id: typeof row.program_id === "string" ? row.program_id : programId,
    title: typeof row.title === "string" ? row.title : programId,
    scenario_tags: Array.isArray(row.scenario_tags)
      ? row.scenario_tags.filter((x): x is string => typeof x === "string")
      : [],
    phase_tags: Array.isArray(row.phase_tags)
      ? row.phase_tags.filter((x): x is string => typeof x === "string")
      : [],
    flag_tags: Array.isArray(row.flag_tags)
      ? row.flag_tags.filter((x): x is string => typeof x === "string")
      : [],
  };
}

export type HandleFoundryCompletionOptions = {
  locale?: ScenarioLocalePreference;
};

/**
 * Runs post-Foundry completion routing: stats gap → biased next scenario → promotion readiness → Elite Spec hook → `foundry_exit_ready`.
 */
export async function handleFoundryCompletion(
  userId: string,
  programId: string,
  options?: HandleFoundryCompletionOptions,
): Promise<FoundryReturnResult> {
  const locale = options?.locale ?? "en";
  const stats = await getScenarioStats(userId, locale);
  const coverage_gap_flag_types = flagTypesWithCoverageGap(stats);

  const admin = getSupabaseAdmin();
  const programRow = admin ? await fetchProgramRow(programId, admin) : null;
  const preferFlag = preferFlagTypeFromProgram(programRow);

  const nextScenarioRoute = await getNextScenarioForSession(userId, locale, {
    foundry_return: true,
    ...(preferFlag ? { preferFlagType: preferFlag } : {}),
  });

  const promotionReadiness = await getPromotionReadiness(userId, { locale });

  let eliteSpec: EliteSpecResult | null = null;
  if (
    promotionReadiness.readiness_score >= ELITE_SPEC_READINESS_THRESHOLD &&
    !promotionReadiness.promotion_blocked
  ) {
    eliteSpec = await handleEliteSpecNomination(userId);
  }

  const payload: FoundryExitReadyPayload = {
    event: "foundry_exit_ready",
    userId,
    programId,
    next_scenario: nextScenarioRoute?.scenario ?? null,
    scenarioRoute: nextScenarioRoute,
    coverage_gap_flag_types,
  };
  emitFoundryExitReady(payload);

  return {
    programId,
    scenarioStats: stats,
    coverage_gap_flag_types,
    nextScenarioRoute,
    promotionReadiness,
    eliteSpec,
  };
}
