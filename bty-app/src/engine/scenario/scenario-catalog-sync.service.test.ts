import { describe, it, expect } from "vitest";
import { SCENARIOS } from "@/lib/bty/scenario/scenarios";
import { BEGINNER_SCENARIOS } from "@/lib/bty/scenario/beginnerScenarios";
import {
  arenaScenarioToRows,
  beginnerScenarioToRows,
} from "./scenario-catalog-sync.service";

describe("scenario-catalog-sync.service", () => {
  it("builds 90 rows: 41 bilingual arena + 4 bilingual beginner (no PK overlap)", () => {
    const beginnerIds = new Set(BEGINNER_SCENARIOS.map((b) => b.scenarioId));
    const arenaOnly = SCENARIOS.filter((s) => !beginnerIds.has(s.scenarioId));
    expect(SCENARIOS.length).toBe(45);
    expect(BEGINNER_SCENARIOS.length).toBe(4);
    expect(arenaOnly.length).toBe(41);

    let n = 0;
    for (const s of arenaOnly) {
      n += arenaScenarioToRows(s).length;
    }
    for (const b of BEGINNER_SCENARIOS) {
      n += beginnerScenarioToRows(b).length;
    }
    expect(n).toBe(90);
  });

  it("arena rows are not beginner; beginner rows have is_beginner", () => {
    const first = arenaScenarioToRows(SCENARIOS[0]!)[0]!;
    expect(first.is_beginner).toBe(false);
    const beg = beginnerScenarioToRows(BEGINNER_SCENARIOS[0]!)[0]!;
    expect(beg.is_beginner).toBe(true);
    expect(beg.scenario_type).toBe("beginner_7step");
  });
});
