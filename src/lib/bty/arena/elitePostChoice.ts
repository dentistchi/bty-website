import type { EliteScenarioSetup, Scenario, ScenarioChoice } from "@/lib/bty/scenario/types";

export function isEliteCanonicalScenario(scenario: Scenario | null | undefined): boolean {
  return Boolean(scenario?.eliteSetup);
}

/** User-facing stance line — avoids engine `microInsight` ("Theme: stance_*") and generic `result` copy. */
export function eliteStanceLabel(choice: ScenarioChoice, locale: "en" | "ko"): string {
  if (locale === "ko" && choice.labelKo?.trim()) return choice.labelKo.trim();
  return choice.label.trim();
}

export function eliteIntegrationNarrative(setup: EliteScenarioSetup, locale: "en" | "ko"): string {
  if (locale === "ko") {
    return `이 역할「${setup.role}」에서 방금 고른 입장을 오늘 한 가지 리더십 행동으로 옮긴다면 무엇인가요? 「${setup.pressure}」 속 압박과 「${setup.tradeoff}」 딜레마를 오늘의 리듬 속에서 어떻게 다룰지 한 문장으로 잡아 보세요.`;
  }
  return `In your role (${setup.role}), what is one leadership move that carries your stance into action today? Between the pressure of "${setup.pressure}" and the dilemma of "${setup.tradeoff}", how will you hold the line in practice — in one sentence.`;
}

/** Optional bridge copy from scenario follow-up prompt when enabled; otherwise UI uses i18n default. */
export function eliteActionBridgeCopy(choice: ScenarioChoice, locale: "en" | "ko"): string | null {
  const fu = choice.followUp;
  if (!fu?.enabled) return null;
  const p = locale === "ko" && fu.promptKo?.trim() ? fu.promptKo.trim() : fu.prompt?.trim();
  return p && p.length > 0 ? p : null;
}
