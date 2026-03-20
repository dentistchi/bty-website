import type { ArenaScenario, HiddenStat } from "@/domain/arena/scenarios";
import { getArenaOutcome } from "@/domain/arena/scenarios";
import type { ArenaSignal } from "@/features/my-page/logic/types";

function defaultTraitsFromActivated(activated: HiddenStat[]): Partial<Record<HiddenStat, number>> {
  const traits: Partial<Record<HiddenStat, number>> = {};
  for (const s of activated) {
    traits[s] = 0.62;
  }
  return traits;
}

function defaultMeta(): ArenaSignal["meta"] {
  return {
    relationalBias: 0.5,
    operationalBias: 0.5,
    emotionalRegulation: 0.5,
  };
}

export function buildArenaSignal({
  scenario,
  selectedPrimary,
  selectedReinforcement,
}: {
  scenario: ArenaScenario;
  selectedPrimary: string;
  selectedReinforcement: string;
}): ArenaSignal | null {
  const outcome = getArenaOutcome(scenario, selectedPrimary, selectedReinforcement);
  if (!outcome) return null;

  const traits = outcome.traits ?? defaultTraitsFromActivated(outcome.activatedStats);
  const meta = outcome.meta ?? defaultMeta();

  return {
    scenarioId: scenario.id,
    primary: selectedPrimary,
    reinforcement: selectedReinforcement,
    traits,
    meta,
    timestamp: Date.now(),
  };
}
