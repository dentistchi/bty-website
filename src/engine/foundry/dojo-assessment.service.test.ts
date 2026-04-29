import { describe, expect, it } from "vitest";
import {
  DOJO_ASSESSMENTS,
  weakestSkillAreaFromScenarioStats,
  scoreDojoAnswers,
  flagTypeToSkillArea,
} from "./dojo-assessment.service";
import type { ScenarioStats } from "@/engine/scenario/scenario-stats.service";

describe("dojo-assessment.service", () => {
  it("flagTypeToSkillArea maps known flags", () => {
    expect(flagTypeToSkillArea("HERO_TRAP")).toBe("leadership");
    expect(flagTypeToSkillArea("INTEGRITY_SLIP")).toBe("integrity");
    expect(flagTypeToSkillArea("CLEAN")).toBe("communication");
    expect(flagTypeToSkillArea("ROLE_MIRROR")).toBe("empathy");
  });

  it("weakestSkillAreaFromScenarioStats picks minimum coverage", () => {
    const stats: ScenarioStats = {
      playsByFlagType: {
        HERO_TRAP: 3,
        INTEGRITY_SLIP: 1,
        CLEAN: 3,
        ROLE_MIRROR: 3,
        CONFLICT_NOTE: 3,
        OTHER_UNKNOWN: 3,
      },
      uniqueScenariosPlayed: 6,
      totalAvailableInLocale: 10,
      completionRate: 0.6,
      streakDaysUtc: 0,
      locale: "en",
    };
    expect(weakestSkillAreaFromScenarioStats(stats)).toBe("integrity");
  });

  it("scoreDojoAnswers is 100 when all 5s", () => {
    const a = DOJO_ASSESSMENTS[0]!;
    const answers = Object.fromEntries(a.questions.map((q) => [q.id, 5]));
    expect(scoreDojoAnswers(a, answers)).toBe(100);
  });

  it("scoreDojoAnswers fails low when all 1s", () => {
    const a = DOJO_ASSESSMENTS[0]!;
    const answers = Object.fromEntries(a.questions.map((q) => [q.id, 1]));
    expect(scoreDojoAnswers(a, answers)).toBe(0);
  });
});
