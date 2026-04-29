import { describe, expect, it } from "vitest";
import { applyPatternSignatureTransition } from "@/domain/arena/patternSignatureAggregation";

describe("applyPatternSignatureTransition", () => {
  it("first unstable → unstable", () => {
    const n = applyPatternSignatureTransition(null, { validation_result: "unstable" });
    expect(n.current_state).toBe("unstable");
    expect(n.repeat_count_delta).toBe(1);
  });

  it("active with repeat_count≥2 + changed → improving", () => {
    const n = applyPatternSignatureTransition(
      {
        current_state: "active",
        repeat_count: 2,
        confidence_score: 0.4,
        lifetime_changed_count: 0,
      },
      { validation_result: "changed" },
    );
    expect(n.current_state).toBe("improving");
  });

  it("improving + changed → resolved", () => {
    const n = applyPatternSignatureTransition(
      {
        current_state: "improving",
        repeat_count: 3,
        confidence_score: 0.55,
        lifetime_changed_count: 1,
      },
      { validation_result: "changed" },
    );
    expect(n.current_state).toBe("resolved");
  });

  it("resolved + unstable → unstable", () => {
    const n = applyPatternSignatureTransition(
      {
        current_state: "resolved",
        repeat_count: 4,
        confidence_score: 0.9,
        lifetime_changed_count: 2,
      },
      { validation_result: "unstable" },
    );
    expect(n.current_state).toBe("unstable");
  });

  it("resolved + changed → improving (re-engagement)", () => {
    const n = applyPatternSignatureTransition(
      {
        current_state: "resolved",
        repeat_count: 4,
        confidence_score: 0.85,
        lifetime_changed_count: 2,
      },
      { validation_result: "changed" },
    );
    expect(n.current_state).toBe("improving");
    expect(n.lifetime_changed_count).toBe(3);
  });
});
