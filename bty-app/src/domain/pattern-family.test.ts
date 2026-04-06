import { describe, it, expect } from "vitest";
import {
  isCanonicalPatternFamily,
  normalizePatternFamilyId,
  PATTERN_ACTION_CONTRACT_EXIT_THRESHOLD,
} from "./pattern-family";

describe("normalizePatternFamilyId", () => {
  it("maps legacy explanation alias to explanation_substitution", () => {
    expect(normalizePatternFamilyId("explanation")).toBe("explanation_substitution");
    expect(normalizePatternFamilyId("EXPLANATION")).toBe("explanation_substitution");
  });

  it("returns null for empty input", () => {
    expect(normalizePatternFamilyId("")).toBeNull();
    expect(normalizePatternFamilyId(null)).toBeNull();
  });
});

describe("PATTERN_ACTION_CONTRACT_EXIT_THRESHOLD", () => {
  it("matches PATTERN_ACTION_MODEL_V1 §3 (3-of-7)", () => {
    expect(PATTERN_ACTION_CONTRACT_EXIT_THRESHOLD).toBe(3);
  });
});

describe("isCanonicalPatternFamily", () => {
  it("accepts explanation_substitution", () => {
    expect(isCanonicalPatternFamily("explanation_substitution")).toBe(true);
  });

  it("rejects legacy alias", () => {
    expect(isCanonicalPatternFamily("explanation")).toBe(false);
  });
});
