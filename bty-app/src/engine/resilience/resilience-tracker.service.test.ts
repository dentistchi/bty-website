import { describe, expect, it } from "vitest";
import {
  computeResilienceScoreParts,
  countTrailingConsecutiveCleanChoices,
  isCleanChoiceFlag,
  phaseCompletionsFromHealingRow,
  sumRecoveryDays,
} from "./resilience-tracker.service";

describe("resilience-tracker.service", () => {
  it("computeResilienceScoreParts matches formula", () => {
    expect(
      computeResilienceScoreParts({
        consecutive_clean_choices: 3,
        recovery_days: 5,
        center_phase_completions: 2,
      }),
    ).toBe(50);
  });

  it("countTrailingConsecutiveCleanChoices reads suffix only", () => {
    const rows = [
      { flag_type: "CLEAN", played_at: "2025-01-01T00:00:00Z" },
      { flag_type: "integrity_slip", played_at: "2025-01-02T00:00:00Z" },
      { flag_type: "clean", played_at: "2025-01-03T00:00:00Z" },
      { flag_type: "CLEAN", played_at: "2025-01-04T00:00:00Z" },
    ];
    expect(countTrailingConsecutiveCleanChoices(rows)).toBe(2);
  });

  it("isCleanChoiceFlag is case-insensitive", () => {
    expect(isCleanChoiceFlag("CLEAN")).toBe(true);
    expect(isCleanChoiceFlag("clean")).toBe(true);
    expect(isCleanChoiceFlag(" integrity_slip ")).toBe(false);
  });

  it("phaseCompletionsFromHealingRow", () => {
    expect(
      phaseCompletionsFromHealingRow({
        phase: "REFLECTION",
        completed_at: null,
      }),
    ).toBe(1);
    expect(
      phaseCompletionsFromHealingRow({
        phase: "RENEWAL",
        completed_at: "2025-01-01T00:00:00Z",
      }),
    ).toBe(4);
  });

  it("sumRecoveryDays sums slip→CLEAN spans", () => {
    const slips = [{ created_at: "2025-01-01T00:00:00Z" }];
    const cleanMs = [new Date("2025-01-03T12:00:00Z").getTime()];
    const days = sumRecoveryDays(slips, cleanMs);
    expect(days).toBeGreaterThan(2);
    expect(days).toBeLessThan(3);
  });
});
