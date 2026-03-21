/**
 * arenaRunLifecyclePhaseFromUnknown — 경계 (SPRINT 83 TASK44 / C3). XP·랭킹 무관.
 */
import { describe, it, expect } from "vitest";
import { arenaRunLifecyclePhaseFromUnknown } from "./arenaRunLifecyclePhaseFromUnknown";

describe("arenaRunLifecyclePhaseFromUnknown (edges)", () => {
  it("returns canonical phase for exact spellings", () => {
    expect(arenaRunLifecyclePhaseFromUnknown("in_progress")).toBe("in_progress");
    expect(arenaRunLifecyclePhaseFromUnknown("completed")).toBe("completed");
    expect(arenaRunLifecyclePhaseFromUnknown("aborted")).toBe("aborted");
  });

  it("accepts case-insensitive after trim", () => {
    expect(arenaRunLifecyclePhaseFromUnknown("  IN_PROGRESS ")).toBe("in_progress");
    expect(arenaRunLifecyclePhaseFromUnknown("Completed")).toBe("completed");
    expect(arenaRunLifecyclePhaseFromUnknown("ABORTED")).toBe("aborted");
  });

  it("returns null for empty, unknown, or non-strings", () => {
    expect(arenaRunLifecyclePhaseFromUnknown("")).toBeNull();
    expect(arenaRunLifecyclePhaseFromUnknown("   ")).toBeNull();
    expect(arenaRunLifecyclePhaseFromUnknown("pending")).toBeNull();
    expect(arenaRunLifecyclePhaseFromUnknown("in progress")).toBeNull();
    expect(arenaRunLifecyclePhaseFromUnknown(null)).toBeNull();
    expect(arenaRunLifecyclePhaseFromUnknown(undefined)).toBeNull();
    expect(arenaRunLifecyclePhaseFromUnknown(1)).toBeNull();
  });

  /** S96 TASK8: hyphen / double `_` / internal WS — S95 reflect `levelId`·`POST /api/arena/reflect` 라인과 미중복. */
  it("rejects hyphen, double underscore, and internal whitespace between tokens", () => {
    expect(arenaRunLifecyclePhaseFromUnknown("in-progress")).toBeNull();
    expect(arenaRunLifecyclePhaseFromUnknown("in__progress")).toBeNull();
    expect(arenaRunLifecyclePhaseFromUnknown("in\tprogress")).toBeNull();
    expect(arenaRunLifecyclePhaseFromUnknown("in\t_progress")).toBeNull();
    expect(arenaRunLifecyclePhaseFromUnknown("in_\tprogress")).toBeNull();
  });

  it("accepts NBSP padding that trims to canonical phase strings", () => {
    expect(arenaRunLifecyclePhaseFromUnknown("\u00a0aborted\u00a0")).toBe("aborted");
  });
});
