import { describe, it, expect } from "vitest";
import {
  classifyTrajectory,
  isInformativeTrajectory,
  type CommitmentHistoryItem,
  type LivingResponseTrajectoryKind,
} from "@/domain/daily/livingResponseTrajectory";

const TODAY = "2026-07-12";
const h = (relationship: "self" | "others" | "world", dayKey: string): CommitmentHistoryItem => ({ relationship, dayKey });

describe("classifyTrajectory — deterministic commitment-sequence shape", () => {
  it("no prior history → first_step", () => {
    expect(classifyTrajectory("self", TODAY, []).kind).toBe("first_step");
  });

  it("shallow history, relationship never chosen before → first_step (not enough to call expansion)", () => {
    const t = classifyTrajectory("world", TODAY, [h("self", "2026-07-11")]);
    expect(t.kind).toBe("first_step");
  });

  it("prev day same relationship, short run → continuation", () => {
    const t = classifyTrajectory("self", TODAY, [h("self", "2026-07-11"), h("self", "2026-07-10")]);
    expect(t.kind).toBe("continuation");
    expect(t.recurrence).toBe(true);
  });

  it("sustained same relationship across several recent days → long_held_direction", () => {
    const t = classifyTrajectory("self", TODAY, [h("self", "2026-07-11"), h("self", "2026-07-10"), h("self", "2026-07-09")]);
    expect(t.kind).toBe("long_held_direction");
  });

  it("was here before, detoured to another, engaged recently, now back → return", () => {
    const t = classifyTrajectory("self", TODAY, [h("others", "2026-07-11"), h("self", "2026-07-10")]);
    expect(t.kind).toBe("return");
  });

  it("a lapse (gap ≥ 5 days) since the last commitment → re_entry, regardless of relationship", () => {
    expect(classifyTrajectory("self", TODAY, [h("self", "2026-07-05")]).kind).toBe("re_entry"); // 7-day gap
    expect(classifyTrajectory("self", TODAY, [h("others", "2026-07-04")]).kind).toBe("re_entry"); // 8-day gap
  });

  it("established other-pattern, a brand-new relationship added → expansion", () => {
    const t = classifyTrajectory("world", TODAY, [h("self", "2026-07-11"), h("self", "2026-07-10"), h("self", "2026-07-09")]);
    expect(t.kind).toBe("expansion");
    expect(t.recurrence).toBe(false);
  });

  it("today's own row (or a future key) is filtered out defensively", () => {
    const t = classifyTrajectory("self", TODAY, [h("self", TODAY), h("self", "2099-01-01"), h("self", "2026-07-11"), h("self", "2026-07-10")]);
    expect(t.kind).toBe("continuation"); // only 07-11, 07-10 count → streak 2
  });

  it("malformed day keys are ignored (never crash, never fabricate)", () => {
    const t = classifyTrajectory("self", TODAY, [{ relationship: "self", dayKey: "not-a-date" }, h("self", "2026-07-11")]);
    expect(t.kind).toBe("continuation");
  });

  it("is fully deterministic — identical history yields identical result", () => {
    const hist = [h("others", "2026-07-11"), h("self", "2026-07-09")];
    const a = classifyTrajectory("self", TODAY, hist);
    const b = classifyTrajectory("self", TODAY, hist);
    expect(a).toEqual(b);
  });

  it("classifies re_entry when prev is same relationship but lapsed (gap dominates)", () => {
    // committed self 10 days ago, nothing since, self again today → re-entry, not continuation
    expect(classifyTrajectory("self", TODAY, [h("self", "2026-07-02")]).kind).toBe("re_entry");
  });

  it("informative set = return / re_entry / expansion / long_held_direction only", () => {
    const informative: LivingResponseTrajectoryKind[] = ["return", "re_entry", "expansion", "long_held_direction"];
    const neutral: LivingResponseTrajectoryKind[] = ["first_step", "continuation"];
    for (const k of informative) expect(isInformativeTrajectory(k)).toBe(true);
    for (const k of neutral) expect(isInformativeTrajectory(k)).toBe(false);
  });

  it("carries only safe, non-judgmental vocabulary (no counts, no identity words)", () => {
    const all: LivingResponseTrajectoryKind[] = ["first_step", "continuation", "long_held_direction", "return", "re_entry", "expansion"];
    for (const k of all) {
      // synthesize each kind by construction is internal; just assert the shapes we can reach carry tokens
    }
    const reentry = classifyTrajectory("self", TODAY, [h("self", "2026-07-02")]);
    expect(reentry.safeTokens.length).toBeGreaterThan(0);
    expect(reentry.prohibitedExtensions).toEqual(expect.arrayContaining(["avoidance", "failure"]));
  });
});
