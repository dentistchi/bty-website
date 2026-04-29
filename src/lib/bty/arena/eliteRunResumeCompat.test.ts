import { describe, expect, it } from "vitest";
import { isStaleEliteRunMetaForResume } from "./eliteRunResumeCompat";

describe("isStaleEliteRunMetaForResume", () => {
  it("returns false for empty or time_limit-only meta", () => {
    expect(isStaleEliteRunMetaForResume(undefined)).toBe(false);
    expect(isStaleEliteRunMetaForResume({})).toBe(false);
    expect(isStaleEliteRunMetaForResume({ time_limit: 300 })).toBe(false);
  });

  it("returns true when escalation payload exists without compat version", () => {
    expect(
      isStaleEliteRunMetaForResume({
        escalation_text: "old copy",
      }),
    ).toBe(true);
    expect(
      isStaleEliteRunMetaForResume({
        primary_choice_id: "A",
      }),
    ).toBe(true);
  });

  it("returns false when compat version matches", () => {
    expect(
      isStaleEliteRunMetaForResume({
        escalation_text: "x",
        elite_runtime_compat: 2,
      }),
    ).toBe(false);
  });
});
