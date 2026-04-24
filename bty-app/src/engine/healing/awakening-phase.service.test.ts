import { describe, it, expect } from "vitest";
import { airToBand } from "@/domain/leadership-engine/air";
import {
  AWAKENING_MILESTONES,
  milestoneSatisfied,
  type MilestoneEvaluationContext,
} from "./awakening-phase.service";

type CtxPartial = {
  stats?: Partial<MilestoneEvaluationContext["stats"]>;
  air?: Partial<MilestoneEvaluationContext["air"]>;
  renewalGatePct?: number;
  mentorMessageCount?: number;
};

function ctx(partial: CtxPartial): MilestoneEvaluationContext {
  const mergedAir = {
    computedAt: new Date().toISOString(),
    dailyAir: [] as readonly number[],
    rolling7DayAverage: [] as readonly number[],
    last7DayWindowAvg: 0.5,
    prior7DayWindowAvg: 0.5,
    direction: "stable" as const,
    consecutiveDecliningRollingSteps: 0,
    warningEmitted: false,
    ...(partial.air ?? {}),
  };
  const last7 = mergedAir.last7DayWindowAvg;
  return {
    stats: {
      playsByFlagType: {},
      uniqueScenariosPlayed: 0,
      totalAvailableInLocale: 10,
      completionRate: 0,
      streakDaysUtc: 0,
      locale: "en",
      ...(partial.stats ?? {}),
    },
    air: {
      ...mergedAir,
      last7DayWindowBand: airToBand(last7),
    },
    renewalGatePct: partial.renewalGatePct ?? 0,
    mentorMessageCount: partial.mentorMessageCount ?? 0,
  };
}

describe("awakening-phase.service", () => {
  it("AWAKENING_MILESTONES has 4 entries", () => {
    expect(AWAKENING_MILESTONES.length).toBe(4);
  });

  it("milestoneSatisfied respects streak and air_threshold", () => {
    const mStreak = AWAKENING_MILESTONES.find((m) => m.conditionType === "streak")!;
    expect(milestoneSatisfied(mStreak, ctx({ stats: { streakDaysUtc: 2 } }))).toBe(false);
    expect(milestoneSatisfied(mStreak, ctx({ stats: { streakDaysUtc: 3 } }))).toBe(true);

    const mAir = AWAKENING_MILESTONES.find((m) => m.conditionType === "air_threshold")!;
    expect(
      milestoneSatisfied(mAir, ctx({ air: { last7DayWindowAvg: 0.71 } })),
    ).toBe(false);
    expect(
      milestoneSatisfied(mAir, ctx({ air: { last7DayWindowAvg: 0.73 } })),
    ).toBe(true);
  });

  it("mentor_session requires renewal gate and mentor count", () => {
    const m = AWAKENING_MILESTONES.find((m) => m.conditionType === "mentor_session")!;
    expect(milestoneSatisfied(m, ctx({ renewalGatePct: 1, mentorMessageCount: 0 }))).toBe(
      false,
    );
    expect(milestoneSatisfied(m, ctx({ renewalGatePct: 1, mentorMessageCount: 1 }))).toBe(
      true,
    );
  });
});
