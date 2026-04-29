/**
 * arenaRunLifecyclePhase — 시작·완료·중단 필드 경계 (SPRINT 62 TASK 8 / C3).
 */
import { describe, it, expect } from "vitest";
import {
  arenaRunLifecyclePhase,
  arenaRunStateDisplayLabelKey,
} from "./arenaRunState";

describe("arenaRunState (edges)", () => {
  it("treats whitespace-only startedAt as not started", () => {
    expect(
      arenaRunLifecyclePhase({
        startedAt: "   ",
        completedAt: "2026-01-02Z",
        abortedAt: undefined,
      })
    ).toBeNull();
    expect(
      arenaRunLifecyclePhase({
        startedAt: "\t\n",
        completedAt: undefined,
        abortedAt: "x",
      })
    ).toBeNull();
  });

  it("ignores abortedAt when it is only whitespace", () => {
    expect(
      arenaRunLifecyclePhase({
        startedAt: "s",
        completedAt: "c",
        abortedAt: "   ",
      })
    ).toBe("completed");
  });

  it("ignores completedAt when only whitespace; stays in_progress", () => {
    expect(
      arenaRunLifecyclePhase({
        startedAt: "s",
        completedAt: "  ",
        abortedAt: undefined,
      })
    ).toBe("in_progress");
  });

  it("display keys cover all lifecycle phases", () => {
    const phases = ["in_progress", "completed", "aborted"] as const;
    const keys = phases.map(arenaRunStateDisplayLabelKey);
    expect(new Set(keys).size).toBe(3);
  });
});
