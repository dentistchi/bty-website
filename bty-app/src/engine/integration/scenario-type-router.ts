/**
 * Arena next-session routing: {@link checkEjectionCondition} → delayed outcomes flag →
 * **catalog only** via {@link selectNextScenario} (Elite v2 chain allowlist; no mirror / perspective / mod-3).
 */

import { checkEjectionCondition } from "@/engine/integration/arena-center-ejection";
import { MIRROR_SCENARIO_PREFIX, type MirrorScenario } from "@/engine/perspective-switch/mirror-scenario.service";
import { getDueOutcomes } from "@/engine/scenario/delayed-outcome-trigger.service";
import {
  selectNextScenario,
  type ScenarioLocalePreference,
  type SelectNextScenarioOptions,
  type SelectorDebugOut,
} from "@/engine/scenario/scenario-selector.service";
import type { ArenaRecallPrompt } from "@/lib/bty/arena/memoryRecallPrompt.types";
import type { Scenario } from "@/lib/bty/scenario/types";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { consumePendingPatternThresholdRecall } from "@/engine/memory/memory-recall-prompt.service";

export type ScenarioRouteResult = {
  delayedOutcomePending: boolean;
  /** `mirror` / `perspective_switch` are legacy route labels; runtime always uses `catalog`. */
  route: "mirror" | "perspective_switch" | "catalog";
  scenario: Scenario;
  /** Present when `route === "mirror"` (pool rows for diagnostics / UI). */
  mirrors?: MirrorScenario[];
  /** Memory Engine: pattern-threshold recall copy for this scenario (consumed from trigger queue). */
  recallPrompt?: ArenaRecallPrompt | null;
  /** Staging/dev only — filled when `options._debugOut` is provided to `getNextScenarioForSession`. */
  _selectorDebug?: SelectorDebugOut;
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
 * @param lastMirrorFromDb — from `fetchLastServedMirrorScenarioId` (`arena_events` + choice history). Canonical Arena
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
 * Arena next scenario: ejection → due outcomes flag → catalog {@link selectNextScenario} only.
 *
 * @returns `null` when the user is Arena-ejected; otherwise a catalog scenario.
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

  const due = await getDueOutcomes(
    userId,
    admin ? { locale, supabase: admin } : { locale },
  );
  const selectorDebug: SelectorDebugOut = {};
  const scenario = await selectNextScenario(userId, locale, { ...options, _debugOut: selectorDebug });
  return attachRecallPrompt(userId, locale, scenario, {
    route: "catalog",
    scenario,
    delayedOutcomePending: due.length > 0,
    _selectorDebug: selectorDebug,
  });
}
