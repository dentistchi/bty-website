import { SCENARIOS } from "./scenarios";
import type { Scenario, ScenarioSubmitPayload, ScenarioSubmitResult } from "./types";

export function getScenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.scenarioId === id);
}

export function getRandomScenario(excludeIds: string[] = []): Scenario {
  const pool = SCENARIOS.filter((s) => !excludeIds.includes(s.scenarioId));
  if (pool.length === 0) return SCENARIOS[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * XP 계산(초기 버전)
 * - xpEarned = round(xpBase * difficulty)
 * - 난이도>1: 보상 커짐, 난이도<1: 보상 줄어듦
 * - 나중에 league_xp / core_xp 분리 가능
 */
export function computeResult(payload: ScenarioSubmitPayload): ScenarioSubmitResult {
  const scenario = getScenarioById(payload.scenarioId);
  if (!scenario) throw new Error("Scenario not found");

  const choice = scenario.choices.find((c) => c.choiceId === payload.choiceId);
  if (!choice) throw new Error("Choice not found");

  const xpEarned = Math.max(0, Math.round(choice.xpBase * choice.difficulty));

  return {
    ok: true,
    scenarioId: scenario.scenarioId,
    choiceId: choice.choiceId,
    xpEarned,
    hiddenDelta: choice.hiddenDelta,
    microInsight: choice.microInsight,
    result: choice.result,
    followUp: choice.followUp,
  };
}
