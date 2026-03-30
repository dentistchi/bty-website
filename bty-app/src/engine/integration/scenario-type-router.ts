/**
 * Single entry for Arena next-session routing: {@link checkEjectionCondition} → delayed outcomes flag →
 * rotation **standard → mirror → perspective-switch** (when pool / eligibility allow) →
 * default {@link selectNextScenario}.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { checkEjectionCondition } from "@/engine/integration/arena-center-ejection";
import {
  getMirrorScenarios,
  mirrorPoolRowToScenario,
  MIRROR_SCENARIO_PREFIX,
  type MirrorScenario,
} from "@/engine/perspective-switch/mirror-scenario.service";
import {
  getNextPerspectiveSwitch,
  perspectiveSwitchToScenario,
} from "@/engine/scenario/perspective-switch.service";
import { getDueOutcomes } from "@/engine/scenario/delayed-outcome-trigger.service";
import {
  fetchPlayedScenarioIds,
  selectNextScenario,
  type ScenarioLocalePreference,
  type SelectNextScenarioOptions,
} from "@/engine/scenario/scenario-selector.service";
import type { ArenaRecallPrompt } from "@/lib/bty/arena/memoryRecallPrompt.types";
import type { Scenario } from "@/lib/bty/scenario/types";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { consumePendingPatternThresholdRecall } from "@/engine/memory/memory-recall-prompt.service";

/** Standard → mirror → perspective-switch; index = `played_scenario_ids.length % 3`. */
export const ARENA_SESSION_ROTATION_MOD = 3 as const;

export type ScenarioRouteResult = {
  delayedOutcomePending: boolean;
  /** `mirror` = pool row; `perspective_switch` = curated pool; `catalog` = DB/static catalog. */
  route: "mirror" | "perspective_switch" | "catalog";
  scenario: Scenario;
  /** Present when `route === "mirror"` (pool rows for diagnostics / UI). */
  mirrors?: MirrorScenario[];
  /** Memory Engine: pattern-threshold recall copy for this scenario (consumed from trigger queue). */
  recallPrompt?: ArenaRecallPrompt | null;
};

async function attachRecallPrompt(
  userId: string,
  locale: ScenarioLocalePreference,
  scenario: Scenario,
  base: Omit<ScenarioRouteResult, "recallPrompt">,
): Promise<ScenarioRouteResult> {
  const recallPrompt = await consumePendingPatternThresholdRecall({
    userId,
    locale: locale === "ko" ? "ko" : "en",
    scenarioId: scenario.scenarioId,
  });
  return { ...base, ...(recallPrompt ? { recallPrompt } : {}) };
}

/** Most recently played mirror `scenarioId` in chronological `played` order (end = latest). */
function lastServedMirrorScenarioId(played: string[]): string | null {
  for (let i = played.length - 1; i >= 0; i--) {
    const id = played[i];
    if (typeof id === "string" && id.startsWith(MIRROR_SCENARIO_PREFIX)) return id;
  }
  return null;
}

/**
 * Prefer mirrors not played recently; avoid serving the same mirror again immediately when another pool row exists.
 */
export function pickLeastRecentMirror(mirrors: MirrorScenario[], played: string[]): MirrorScenario {
  const lastMirrorSid = lastServedMirrorScenarioId(played);
  let candidateRows = mirrors;
  if (lastMirrorSid !== null && mirrors.length > 1) {
    const withoutLast = mirrors.filter((m) => `${MIRROR_SCENARIO_PREFIX}${m.id}` !== lastMirrorSid);
    if (withoutLast.length >= 1) candidateRows = withoutLast;
  }

  const withMeta = candidateRows.map((m) => {
    const sid = `${MIRROR_SCENARIO_PREFIX}${m.id}`;
    return { m, li: played.lastIndexOf(sid) };
  });
  const never = withMeta.filter((x) => x.li === -1);
  if (never.length > 0) {
    never.sort((a, b) => new Date(a.m.created_at).getTime() - new Date(b.m.created_at).getTime());
    return never[0]!.m;
  }
  withMeta.sort((a, b) => a.li - b.li);
  return withMeta[0]!.m;
}

/**
 * Arena next scenario: ejection → due outcomes flag → mod-3 rotation (catalog / mirror / perspective) →
 * {@link selectNextScenario}.
 *
 * @returns `null` when the user is Arena-ejected; otherwise a routed catalog, mirror, or perspective scenario.
 */
export async function getNextScenarioForSession(
  userId: string,
  locale: ScenarioLocalePreference,
  options?: SelectNextScenarioOptions,
): Promise<ScenarioRouteResult | null> {
  const admin = getSupabaseAdmin();

  const ej = await checkEjectionCondition(userId, {
    readonly: true,
    ...(admin ? { supabase: admin } : {}),
  });
  if (ej.alreadyEjected) {
    return null;
  }

  /** Post-Foundry: catalog-only pick, biased by completed program tag via `preferFlagType`. */
  if (options?.foundry_return) {
    const due = await getDueOutcomes(userId, admin ? { locale, supabase: admin } : { locale });
    const scenario = await selectNextScenario(userId, locale, {
      preferFlagType: options.preferFlagType,
      forceDifficultyTier: options.forceDifficultyTier,
    });
    return attachRecallPrompt(userId, locale, scenario, {
      route: "catalog",
      scenario,
      delayedOutcomePending: due.length > 0,
    });
  }

  if (!admin) {
    const due = await getDueOutcomes(userId, { locale });
    const scenario = await selectNextScenario(userId, locale, options);
    return attachRecallPrompt(userId, locale, scenario, {
      route: "catalog",
      scenario,
      delayedOutcomePending: due.length > 0,
    });
  }

  const due = await getDueOutcomes(userId, { locale, supabase: admin });
  const delayedOutcomePending = due.length > 0;

  const played = await fetchPlayedScenarioIds(userId);
  const sessionSlot = played.length % ARENA_SESSION_ROTATION_MOD;

  const mirrors = await getMirrorScenarios(userId, admin);
  const poolLen = mirrors.length;

  const catalogFallback = async (): Promise<Scenario> => selectNextScenario(userId, locale, options);

  if (sessionSlot === 0) {
    const scenario = await catalogFallback();
    return attachRecallPrompt(userId, locale, scenario, {
      route: "catalog",
      scenario,
      delayedOutcomePending,
    });
  }

  if (sessionSlot === 1) {
    if (poolLen >= 1) {
      const row = pickLeastRecentMirror(mirrors, played);
      const scenario = mirrorPoolRowToScenario(row, locale);
      return attachRecallPrompt(userId, locale, scenario, {
        route: "mirror",
        scenario,
        mirrors,
        delayedOutcomePending,
      });
    }
    const scenario = await catalogFallback();
    return attachRecallPrompt(userId, locale, scenario, {
      route: "catalog",
      scenario,
      delayedOutcomePending,
    });
  }

  // sessionSlot === 2 — perspective third, then mirror, then catalog
  const psEntry = await getNextPerspectiveSwitch(userId, admin);
  const scenario = perspectiveSwitchToScenario(psEntry, locale);
  return attachRecallPrompt(userId, locale, scenario, {
    route: "perspective_switch",
    scenario,
    delayedOutcomePending,
  });
}
