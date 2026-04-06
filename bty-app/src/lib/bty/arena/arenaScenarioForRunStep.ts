import type { ArenaScenario, EscalationBranch } from "@/domain/arena/scenarios/types";
import { patientComplaintScenario } from "@/domain/arena/scenarios/mockScenario";
import { patientComplaintScenarioKo } from "@/domain/arena/scenarios/patientComplaintScenarioKo";
import { getEliteScenarioById } from "@/lib/bty/arena/eliteScenariosCanonical.server";

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
 * - **Mission id** (`patient-complaint-revised-estimate`): full {@link ArenaScenario} from mock data.
 * - **Elite ids:** resolve from bundled **`bty_elite_scenarios_v2.json`** via {@link getEliteScenarioById}.
 *   Steps 3–4 use **only** `escalationBranches` from that row — no generic mock escalation. If the row has no branches,
 *   the returned object omits `escalationBranches` (API returns `escalation_not_configured`). If the id is not in the
 *   elite dataset, return `null`.
 */
export function getArenaScenarioForRunStep(
  scenarioId: string,
  locale: string | null | undefined,
): ArenaScenario | null {
  if (scenarioId === patientComplaintScenario.id) {
    return locale === "ko" ? patientComplaintScenarioKo : patientComplaintScenario;
  }

  const elite = getEliteScenarioById(scenarioId);
  if (elite != null && hasNonEmptyEscalationBranches(elite.escalationBranches)) {
    return minimalArenaScenarioForEscalation(
      scenarioId,
      elite.escalationBranches as Record<string, EscalationBranch>,
      elite.difficulty_level ?? DEFAULT_ELITE_RUN_STEP_DIFFICULTY,
    );
  }

  if (elite != null) {
    return {
      id: scenarioId,
      stage: "ELITE",
      caseTag: "ELITE",
      title: typeof elite.title === "string" ? elite.title : "",
      difficulty: "Moderate",
      description: [],
      primaryChoices: [],
      reinforcementChoices: [],
      outcomes: {},
      difficulty_level: elite.difficulty_level ?? DEFAULT_ELITE_RUN_STEP_DIFFICULTY,
    };
  }

  return null;
}
