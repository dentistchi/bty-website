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

  /** S93 TASK11: per-edge trim to max; NBSP-only null; internal `\n`/`\t` not stripped (≠ description/interpretation parsers). */
  it("accepts max length when value is padded with ASCII spaces", () => {
    const inner = "z".repeat(ARENA_SCENARIO_ID_MAX_LENGTH);
    expect(arenaScenarioIdFromUnknown(`  ${inner}  `)).toBe(inner);
  });

  it("returns null for NBSP-only strings after trim", () => {
    expect(arenaScenarioIdFromUnknown("\u00A0")).toBe(null);
    expect(arenaScenarioIdFromUnknown("\u00A0\u00A0")).toBe(null);
  });

  it("preserves internal newlines and tabs inside the id", () => {
    expect(arenaScenarioIdFromUnknown("  sc\nen\tid  ")).toBe("sc\nen\tid");
  });

  /**
   * S118 C3 TASK8 — **S117** reflect `Symbol`·bigint·**S93** NBSP 라인과 구분 (시나리오 id 축).
   */
  it("S118: returns null for Symbol and bigint", () => {
    expect(arenaScenarioIdFromUnknown(Symbol("s1"))).toBe(null);
    expect(arenaScenarioIdFromUnknown(BigInt(1))).toBe(null);
  });
});
