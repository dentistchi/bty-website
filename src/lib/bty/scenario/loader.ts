import { getScenarioById, scenarioList } from "@/data/scenario";

export interface Scenario {
  scenarioId: string;
  dbScenarioId: string;
  title: string;
  role: string;
  pressure?: string;
  context: string;
  choices: any[];
  escalationBranches: any;
}

export async function loadScenario(id: string, locale: "en" | "ko"): Promise<Scenario> {
  const runtimeScenario = getScenarioById(id, locale);
  if (!runtimeScenario) throw new Error("Invalid scenario structure");

  return {
    scenarioId: runtimeScenario.scenarioId,
    dbScenarioId: runtimeScenario.dbScenarioId,
    title: runtimeScenario.content.title,
    role: runtimeScenario.content.role,
    pressure: runtimeScenario.content.pressure,
    context: runtimeScenario.content.pressure ?? "",
    choices: runtimeScenario.content.choices.map((choice) => ({
      ...choice,
      choiceId: choice.id,
    })),
    escalationBranches: runtimeScenario.content.escalationBranches ?? {},
  };
}

export function loadAllScenarios(locale: "en" | "ko"): Promise<Scenario[]> {
  return Promise.all(scenarioList.map((id) => loadScenario(id, locale)));
}
