import { describe, it, expect } from "vitest";
import {
  leStageDisplayForArenaRunResult,
  leStageDisplayWithWeeklySummary,
  leStageActivityVolumeTier,
  leStageSummaryLabelKey,
} from "./le-stage";
import { STAGE_1, STAGE_3, STAGE_4 } from "./stages";

describe("leStageDisplayForArenaRunResult", () => {
  it("returns stage name, progress, arenaSummary for run/result API", () => {
    const r = leStageDisplayForArenaRunResult({
      leStage: STAGE_3,
      completedRunsInPeriod: 5,
      periodLabel: "2025-W10",
    });
    expect(r.currentStage).toBe(3);
    expect(r.stageName).toBeTruthy();
    expect(r.progressPercent).toBe(75);
    expect(r.arenaSummary).toEqual({
      currentStage: 3,
      completedCount: 5,
      periodLabel: "2025-W10",
    });
  });

  it("clamps stage to 1–4 and floors negative completed count via max(0,…)", () => {
    const low = leStageDisplayForArenaRunResult({
      leStage: 0,
      completedRunsInPeriod: -2,
    });
    expect(low.currentStage).toBe(STAGE_1);
    expect(low.arenaSummary.completedCount).toBe(0);

    const high = leStageDisplayForArenaRunResult({
      leStage: 99,
      completedRunsInPeriod: 1,
    });
    expect(high.currentStage).toBe(STAGE_4);
  });

  it("leStageDisplayWithWeeklySummary merges session count + weekly rollup", () => {
    const r = leStageDisplayWithWeeklySummary({
      leStage: STAGE_3,
      sessionCompletedCount: 1,
      weeklyRunCount: 7,
      weeklyReflectionCount: 3,
      periodLabel: "2026-W11",
    });
    expect(r.arenaSummary.completedCount).toBe(1);
    expect(r.weeklyPeriodSummary).toEqual({
      runCount: 7,
      reflectionCount: 3,
      periodLabel: "2026-W11",
    });
    expect(r.currentStage).toBe(3);
  });

  it("leStageActivityVolumeTier: weekly/cumulative thresholds", () => {
    expect(leStageActivityVolumeTier({ weeklyRuns: 0, cumulativeRuns: 0 })).toBe("light");
    expect(leStageActivityVolumeTier({ weeklyRuns: 3, cumulativeRuns: 0 })).toBe("steady");
    expect(leStageActivityVolumeTier({ weeklyRuns: 10, cumulativeRuns: 0 })).toBe("strong");
    expect(leStageActivityVolumeTier({ weeklyRuns: 0, cumulativeRuns: 50 })).toBe("strong");
  });

  it("leStageSummaryLabelKey: same stage, different volume suffix", () => {
    expect(leStageSummaryLabelKey({ stage: 2, weeklyRuns: 1, cumulativeRuns: 0 })).toBe(
      "le_stage_s2_light"
    );
    expect(leStageSummaryLabelKey({ stage: 2, weeklyRuns: 10, cumulativeRuns: 0 })).toBe(
      "le_stage_s2_strong"
    );
  });
});
