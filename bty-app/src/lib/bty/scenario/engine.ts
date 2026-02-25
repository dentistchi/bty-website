import { SCENARIOS } from "./scenarios";
import type { Scenario, ScenarioSubmitPayload, ScenarioSubmitResult } from "./types";

/** Meta phrases used only for design/scoring — never show to user. */
const META_PHRASES =
  /(?:hidden risk|integrity trigger|growth opportunity|leadership challenge|decision point)/i;

/**
 * Strip all design/system-only language from context. User sees only situation + emotion;
 * no "calculation system" (hidden risk, integrity trigger, growth opportunity, etc.).
 */
export function getContextForUser(context: string): string {
  let text = context.trim();
  const stop = /\s+The (hidden risk|integrity trigger|growth opportunity|leadership challenge|decision point)[\s:]/i;
  const m = text.match(stop);
  if (m && m.index != null) text = text.slice(0, m.index).trim();
  const sentences = text.split(/(?<=[.!])\s+/).filter((s) => {
    const t = s.trim();
    return t.length > 0 && !META_PHRASES.test(t);
  });
  return sentences.join(" ").trim() || text.trim();
}

export function getScenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.scenarioId === id);
}

export function getRandomScenario(excludeIds: string[] = []): Scenario {
  const pool = SCENARIOS.filter((s) => !excludeIds.includes(s.scenarioId));
  if (pool.length === 0) return SCENARIOS[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * XP: xpEarned = round(xpBase * difficulty). Higher difficulty => higher reward.
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
