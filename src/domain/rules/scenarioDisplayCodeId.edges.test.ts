/**
 * isValidArenaScenarioCodeId — 코드 ID 형식 경계 (SPRINT 66 TASK 8 / C3).
 */
import { describe, it, expect } from "vitest";
import { isValidArenaScenarioCodeId } from "./scenarioDisplay";

describe("isValidArenaScenarioCodeId (edges)", () => {
  it("rejects non-string, empty, and whitespace-only", () => {
    expect(isValidArenaScenarioCodeId(null)).toBe(false);
    expect(isValidArenaScenarioCodeId(undefined)).toBe(false);
    expect(isValidArenaScenarioCodeId(1)).toBe(false);
    expect(isValidArenaScenarioCodeId("")).toBe(false);
    expect(isValidArenaScenarioCodeId("   ")).toBe(false);
  });

  it("rejects length > 128 after trim", () => {
    const ok128 = `a${"b".repeat(127)}`;
    expect(ok128.length).toBe(128);
    expect(isValidArenaScenarioCodeId(ok128)).toBe(true);
    expect(isValidArenaScenarioCodeId(`${ok128}b`)).toBe(false);
  });

  it("rejects uppercase start, hyphen, space, and dot", () => {
    expect(isValidArenaScenarioCodeId("Foo")).toBe(false);
    expect(isValidArenaScenarioCodeId("a-b")).toBe(false);
    expect(isValidArenaScenarioCodeId("a b")).toBe(false);
    expect(isValidArenaScenarioCodeId("a.b")).toBe(false);
  });

  it("accepts lowercase start with digits and underscores", () => {
    expect(isValidArenaScenarioCodeId("a1")).toBe(true);
    expect(isValidArenaScenarioCodeId("a_1_b")).toBe(true);
    expect(isValidArenaScenarioCodeId("  z9  ")).toBe(true);
  });
});
