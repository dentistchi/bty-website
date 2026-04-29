import { describe, it, expect } from "vitest";
import { arenaMissionOutcomeKeyFromChoiceIds } from "./arenaMissionOutcomeKey";

describe("arenaMissionOutcomeKeyFromChoiceIds (edges)", () => {
  it("returns canonical outcome keys for valid pairs", () => {
    expect(arenaMissionOutcomeKeyFromChoiceIds("A", "X")).toBe("A_X");
    expect(arenaMissionOutcomeKeyFromChoiceIds(" B ", " Y")).toBe("B_Y");
    expect(arenaMissionOutcomeKeyFromChoiceIds("C", "X")).toBe("C_X");
  });

  it("returns null when primary or reinforcement token is invalid", () => {
    expect(arenaMissionOutcomeKeyFromChoiceIds("D", "X")).toBeNull();
    expect(arenaMissionOutcomeKeyFromChoiceIds("A", "Z")).toBeNull();
    expect(arenaMissionOutcomeKeyFromChoiceIds("a", "X")).toBeNull();
  });

  it("returns null for non-strings or empty after trim", () => {
    expect(arenaMissionOutcomeKeyFromChoiceIds(null, "X")).toBeNull();
    expect(arenaMissionOutcomeKeyFromChoiceIds("A", 1)).toBeNull();
    expect(arenaMissionOutcomeKeyFromChoiceIds("   ", "X")).toBeNull();
    expect(arenaMissionOutcomeKeyFromChoiceIds("A", "   ")).toBeNull();
    expect(arenaMissionOutcomeKeyFromChoiceIds("A", "\t\n")).toBeNull();
  });

  it("rejects ZWSP and other invisible chars inside tokens (trim does not strip U+200B)", () => {
    expect(arenaMissionOutcomeKeyFromChoiceIds("A\u200b", "X")).toBeNull();
    expect(arenaMissionOutcomeKeyFromChoiceIds("A", "X\u200b")).toBeNull();
    expect(arenaMissionOutcomeKeyFromChoiceIds("\u200bA", "X")).toBeNull();
  });
});
