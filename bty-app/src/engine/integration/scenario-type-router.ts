/**
 * Single entry for Arena next-session routing: {@link checkEjectionCondition} → delayed outcomes flag →
 * **catalog** by default (`ARENA_SESSION_MIRROR_ROTATION_ENABLED` unset/false).
 * When `ARENA_SESSION_MIRROR_ROTATION_ENABLED=1|true`: mod-3 rotation **catalog → mirror → perspective-switch**
 * (when pool / eligibility allow) → {@link selectNextScenario}.
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
  fetchLastServedMirrorScenarioId,
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

/** When false (default), `/api/arena/session/next` uses catalog-only routing; mirror/perspective rotation is off. */
export function isArenaMirrorRotationEnabled(): boolean {
  const v = process.env.ARENA_SESSION_MIRROR_ROTATION_ENABLED;
  return v === "1" || v === "true";
}

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
export function lastServedMirrorScenarioIdFromPlayed(played: string[]): string | null {
  for (let i = played.length - 1; i >= 0; i--) {
    const id = played[i];
    if (typeof id === "string" && id.startsWith(MIRROR_SCENARIO_PREFIX)) return id;
  }
  return null;
}

function mirrorCanonicalKey(scenarioId: string): string {
  if (!scenarioId.startsWith(MIRROR_SCENARIO_PREFIX)) return scenarioId.toLowerCase();
  return `${MIRROR_SCENARIO_PREFIX}${scenarioId.slice(MIRROR_SCENARIO_PREFIX.length).toLowerCase()}`;
}

/** Latest index in `played` matching this pool row (`mirror:` + UUID), case-insensitive on UUID. */
function lastIndexOfMirrorPoolRowInPlayed(played: string[], poolRowUuid: string): number {
  const want = mirrorCanonicalKey(`${MIRROR_SCENARIO_PREFIX}${poolRowUuid}`);
  for (let i = played.length - 1; i >= 0; i--) {
    const p = played[i];
    if (typeof p === "string" && mirrorCanonicalKey(p) === want) return i;
  }
  return -1;
}

/**
 * Prefer mirrors not played recently; avoid serving the same mirror again immediately when another pool row exists.
 *
 * @param lastMirrorFromDb — from {@link fetchLastServedMirrorScenarioId} (`arena_events` + choice history). Canonical Arena
 *   does not append mirror ids to `played`; pass this so immediate-repeat exclusion works.
 */
export function pickLeastRecentMirror(
  mirrors: MirrorScenario[],
  played: string[],
  lastMirrorFromDb?: string | null,
): MirrorScenario {
  const lastMirrorSid = lastMirrorFromDb ?? lastServedMirrorScenarioIdFromPlayed(played);
  const lastKey = lastMirrorSid != null ? mirrorCanonicalKey(lastMirrorSid) : null;

  let candidateRows = mirrors;
  if (lastKey !== null && mirrors.length > 1) {
    const withoutLast = mirrors.filter(
      (m) => mirrorCanonicalKey(`${MIRROR_SCENARIO_PREFIX}${m.id}`) !== lastKey,
    );
    if (withoutLast.length >= 1) candidateRows = withoutLast;
  }

  const withMeta = candidateRows.map((m) => ({
    m,
    li: lastIndexOfMirrorPoolRowInPlayed(played, m.id),
  }));
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
      ...options,
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

  if (!isArenaMirrorRotationEnabled()) {
    const due = await getDueOutcomes(userId, { locale, supabase: admin });
    const scenario = await selectNextScenario(userId, locale, options);
    return attachRecallPrompt(userId, locale, scenario, {
      route: "catalog",
      scenario,
      delayedOutcomePending: due.length > 0,
    });
  }

  const due = await getDueOutcomes(userId, { locale, supabase: admin });
  const delayedOutcomePending = due.length > 0;

  const [played, lastMirrorFromDb] = await Promise.all([
    fetchPlayedScenarioIds(userId),
    fetchLastServedMirrorScenarioId(userId),
  ]);
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
      const row = pickLeastRecentMirror(mirrors, played, lastMirrorFromDb);
      if (process.env.ARENA_MIRROR_PICK_DEBUG === "1") {
        const resolved = lastMirrorFromDb ?? lastServedMirrorScenarioIdFromPlayed(played);
        const before = mirrors.map((m) => `${MIRROR_SCENARIO_PREFIX}${m.id}`);
        let afterIds = before;
        if (resolved != null && mirrors.length > 1) {
          const lk = mirrorCanonicalKey(resolved);
          const filt = mirrors.filter(
            (m) => mirrorCanonicalKey(`${MIRROR_SCENARIO_PREFIX}${m.id}`) !== lk,
          );
          if (filt.length >= 1) afterIds = filt.map((m) => `${MIRROR_SCENARIO_PREFIX}${m.id}`);
        }
        console.warn(
          "[arena] mirror_pick",
          JSON.stringify({
            userId,
            playedTail: played.slice(-15),
            lastMirrorFromDb,
            lastMirrorResolved: resolved,
            candidateIdsBefore: before,
            candidateIdsAfterExclusion: afterIds,
            selectedId: `${MIRROR_SCENARIO_PREFIX}${row.id}`,
          }),
        );
      }
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
