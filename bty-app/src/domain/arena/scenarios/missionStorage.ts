import type { ArenaScenario, ResolveOutcome } from "./types";
import { getArenaOutcome } from "./types";
import { getScenarioById } from "./mockScenario";
import { normalizeArenaMissionPayloadFromUnknown } from "./missionPayloadFromUnknown";

/** sessionStorage payload after Play → before Resolve */
export const MISSION_STORAGE_KEY = "bty-arena-mission-v1";

export type ArenaMissionPayload = {
  scenarioId: string;
  selectedPrimaryId: string;
  selectedReinforcementId: string;
  /** ISO timestamp */
  decidedAt: string;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

export function writeMissionPayload(payload: ArenaMissionPayload): void {
  if (!canUseStorage()) return;
  try {
    sessionStorage.setItem(MISSION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

export function readMissionPayload(): ArenaMissionPayload | null {
  if (!canUseStorage()) return null;
  try {
    const raw = sessionStorage.getItem(MISSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    const norm = normalizeArenaMissionPayloadFromUnknown(parsed);
    return norm;
  } catch {
    return null;
  }
}

export function clearMissionPayload(): void {
  if (!canUseStorage()) return;
  try {
    sessionStorage.removeItem(MISSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Resolve helpers: look up choices + outcome for sealed cards / interpretation */
export function resolveMissionAgainstScenario(
  payload: ArenaMissionPayload,
): {
  scenario: ArenaScenario;
  primary: ArenaScenario["primaryChoices"][number];
  reinforcement: ArenaScenario["reinforcementChoices"][number];
  outcome: ResolveOutcome | null;
} | null {
  const scenario = getScenarioById(payload.scenarioId);
  if (!scenario) return null;
  const primary = scenario.primaryChoices.find((c) => c.id === payload.selectedPrimaryId);
  const reinforcement = scenario.reinforcementChoices.find(
    (c) => c.id === payload.selectedReinforcementId,
  );
  if (!primary || !reinforcement) return null;
  const outcome = getArenaOutcome(scenario, primary.id, reinforcement.id);
  return { scenario, primary, reinforcement, outcome };
}
