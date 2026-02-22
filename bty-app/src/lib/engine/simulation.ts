import type { XPEvent, XPSource, HiddenStat, UserId, ISODateTimeString } from "./types";

/**
 * Simulation outcome -> XPEvent adapter.
 * This lets content evolve without breaking the scoring engine.
 */
export interface SimulationOutcome {
  scenarioId: string;
  userId: UserId;
  createdAt: ISODateTimeString;

  // content-side suggested xp
  xpBase: number;
  difficulty?: number;

  // content-side "signals"
  tags?: string[];
  hiddenDelta?: Partial<Record<HiddenStat, number>>;

  // optional: store chosen option for audit/analytics later
  choiceId?: string;
}

export function outcomeToEvent(outcome: SimulationOutcome): XPEvent {
  const source: XPSource = "simulation";
  return {
    id: `ev_${outcome.scenarioId}_${outcome.createdAt}`,
    userId: outcome.userId,
    source,
    sourceId: outcome.scenarioId,
    createdAt: outcome.createdAt,
    xpBase: outcome.xpBase,
    difficulty: outcome.difficulty,
    tags: outcome.tags,
    hiddenDelta: outcome.hiddenDelta,
  };
}
