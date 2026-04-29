import type { ArenaScenario, EscalationBranch } from "@/domain/arena/scenarios/types";
import { getEliteScenarioById } from "@/lib/bty/arena/eliteScenariosCanonical.server";
import { isEliteChainScenarioId } from "@/lib/bty/arena/postLoginEliteEntry";

/** When v2 row omits `difficulty_level`, match `eliteScenarioToScenario` / intensity tier 3 default. */
const DEFAULT_ELITE_RUN_STEP_DIFFICULTY = 3 as NonNullable<ArenaScenario["difficulty_level"]>;

function hasNonEmptyEscalationBranches(
  eb: Record<string, EscalationBranch> | undefined | null,
): boolean {
  return eb != null && typeof eb === "object" && !Array.isArray(eb) && Object.keys(eb).length > 0;
}

function minimalArenaScenarioForEscalation(
  id: string,
  escalationBranches: Record<string, EscalationBranch>,
  difficulty_level: NonNullable<ArenaScenario["difficulty_level"]>,
): ArenaScenario {
  return {
    id,
    stage: "ELITE",
    caseTag: "ELITE",
    title: "",
    difficulty: "Moderate",
    description: [],
    primaryChoices: [],
    reinforcementChoices: [],
    outcomes: {},
    escalationBranches,
    difficulty_level,
  };
}

/**
 * Scenarios that define `escalationBranches` for POST `/api/arena/run/step` (steps 3–4).
 *
 * Only Elite chain ids — resolve via {@link getEliteScenarioById} (chain workspace projection only).
 * Steps 3–4 use **only** `escalationBranches` from that row. If the row has no branches,
 * the returned object omits `escalationBranches` (API returns `escalation_not_configured`). If the id is not allowed
 * or not in the elite dataset, return `null`.
 */
export function getArenaScenarioForRunStep(
  scenarioId: string,
  locale: string | null | undefined,
): ArenaScenario | null {
  void locale;
  if (!isEliteChainScenarioId(scenarioId)) return null;
  const eliteOnly = getEliteScenarioById(scenarioId);
  if (hasNonEmptyEscalationBranches(eliteOnly.escalationBranches)) {
    return minimalArenaScenarioForEscalation(
      scenarioId,
      eliteOnly.escalationBranches as Record<string, EscalationBranch>,
      eliteOnly.difficulty_level ?? DEFAULT_ELITE_RUN_STEP_DIFFICULTY,
    );
  }
  return {
    id: scenarioId,
    stage: "ELITE",
    caseTag: "ELITE",
    title: typeof eliteOnly.title === "string" ? eliteOnly.title : "",
    difficulty: "Moderate",
    description: [],
    primaryChoices: [],
    reinforcementChoices: [],
    outcomes: {},
    difficulty_level: eliteOnly.difficulty_level ?? DEFAULT_ELITE_RUN_STEP_DIFFICULTY,
  };
}
