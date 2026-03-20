import { describe, expect, it } from "vitest";
import {
  ARENA_SCENARIO_ID_MAX_LENGTH,
  arenaScenarioIdFromUnknown,
} from "./arenaScenarioIdFromUnknown";

describe("arenaScenarioIdFromUnknown (edges)", () => {
  it("returns trimmed id when valid", () => {
    expect(arenaScenarioIdFromUnknown("  patient-complaint-revised-estimate  ")).toBe(
      "patient-complaint-revised-estimate",
    );
  });

  it("returns null for non-strings, empty, or whitespace-only", () => {
    expect(arenaScenarioIdFromUnknown(null)).toBe(null);
    expect(arenaScenarioIdFromUnknown(undefined)).toBe(null);
    expect(arenaScenarioIdFromUnknown(12)).toBe(null);
    expect(arenaScenarioIdFromUnknown("")).toBe(null);
    expect(arenaScenarioIdFromUnknown("   \t\n")).toBe(null);
  });

  it("returns null when length exceeds max", () => {
    const over = "a".repeat(ARENA_SCENARIO_ID_MAX_LENGTH + 1);
    expect(arenaScenarioIdFromUnknown(over)).toBe(null);
  });

  it("accepts id exactly at max length", () => {
    const at = "a".repeat(ARENA_SCENARIO_ID_MAX_LENGTH);
    expect(arenaScenarioIdFromUnknown(at)).toBe(at);
  });
});
