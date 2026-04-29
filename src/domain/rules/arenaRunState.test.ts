import { describe, it, expect } from "vitest";
import {
  arenaRunLifecyclePhase,
  arenaRunStateDisplayLabelKey,
} from "./arenaRunState";

const empty = {
  startedAt: undefined as string | undefined,
  completedAt: undefined as string | undefined,
  abortedAt: undefined as string | undefined,
};

describe("arenaRunLifecyclePhase", () => {
  it("null without start", () => {
    expect(arenaRunLifecyclePhase(empty)).toBeNull();
    expect(
      arenaRunLifecyclePhase({
        ...empty,
        completedAt: "x",
      })
    ).toBeNull();
  });

  it("in_progress when started only", () => {
    expect(
      arenaRunLifecyclePhase({
        ...empty,
        startedAt: "2026-01-01T00:00:00Z",
      })
    ).toBe("in_progress");
  });

  it("completed when started+completed", () => {
    expect(
      arenaRunLifecyclePhase({
        startedAt: "2026-01-01Z",
        completedAt: "2026-01-02Z",
        abortedAt: undefined,
      })
    ).toBe("completed");
  });

  it("aborted wins over completed", () => {
    expect(
      arenaRunLifecyclePhase({
        startedAt: "a",
        completedAt: "b",
        abortedAt: "c",
      })
    ).toBe("aborted");
  });
});

describe("arenaRunStateDisplayLabelKey", () => {
  it("maps lifecycle phases to stable i18n keys", () => {
    expect(arenaRunStateDisplayLabelKey("in_progress")).toBe("arena.run.stateInProgress");
    expect(arenaRunStateDisplayLabelKey("completed")).toBe("arena.run.stateCompleted");
    expect(arenaRunStateDisplayLabelKey("aborted")).toBe("arena.run.stateAborted");
  });
});
