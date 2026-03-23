/**
 * Pure helpers for matching Arena / healing signals to program catalog tags.
 * Used by Foundry recommender (engine) and ProgramRecommenderWidget (unlock overlay).
 */

/** 마지막 Arena `scenario_id`에서 카탈로그와 맞출 시나리오 토큰 집합. */
export function scenarioTokensFromScenarioId(scenarioId: string | null | undefined): Set<string> {
  const out = new Set<string>(["general"]);
  if (!scenarioId || typeof scenarioId !== "string") return out;
  const id = scenarioId.toLowerCase();
  if (id.includes("patient")) out.add("patient");
  if (id.includes("hygienist")) out.add("hygienist");
  if (id.includes("manager") || id.includes("dso")) out.add("manager");
  if (id.includes("assistant")) out.add("assistant");
  if (id.includes("front_desk") || id.includes("insurance")) {
    out.add("front_desk");
    out.add("office");
  }
  if (id.includes("doctor")) {
    out.add("peer");
    out.add("clinical");
  }
  if (id.includes("team") || id.includes("staff")) out.add("team");
  if (id.includes("review")) out.add("reputation");
  if (id.includes("billing") || id.includes("insurance")) {
    out.add("billing");
    out.add("office");
  }
  if (id.includes("conflict")) out.add("conflict");
  return out;
}
