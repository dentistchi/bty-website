import { describe, it, expect } from "vitest";
import { arenaScenarioDifficultyFromUnknown } from "./arenaScenarioDifficultyFromUnknown";

describe("arenaScenarioDifficultyFromUnknown (edges)", () => {
  it("returns canonical union for exact spellings", () => {
    expect(arenaScenarioDifficultyFromUnknown("Low")).toBe("Low");
    expect(arenaScenarioDifficultyFromUnknown("Moderate")).toBe("Moderate");
    expect(arenaScenarioDifficultyFromUnknown("High")).toBe("High");
  });

  it("accepts case-insensitive low/moderate/high after trim", () => {
    expect(arenaScenarioDifficultyFromUnknown("  low ")).toBe("Low");
    expect(arenaScenarioDifficultyFromUnknown("MODERATE")).toBe("Moderate");
    expect(arenaScenarioDifficultyFromUnknown("high")).toBe("High");
  });

  it("returns null for empty, unknown words, or non-strings", () => {
    expect(arenaScenarioDifficultyFromUnknown("")).toBeNull();
    expect(arenaScenarioDifficultyFromUnknown("   ")).toBeNull();
    expect(arenaScenarioDifficultyFromUnknown("Medium")).toBeNull();
    expect(arenaScenarioDifficultyFromUnknown("LOW ")).toBe("Low");
    expect(arenaScenarioDifficultyFromUnknown(null)).toBeNull();
    expect(arenaScenarioDifficultyFromUnknown(1)).toBeNull();
  });

  it("accepts mixed-case spellings after trim (full-string lowercase)", () => {
    expect(arenaScenarioDifficultyFromUnknown("  lOw  ")).toBe("Low");
    expect(arenaScenarioDifficultyFromUnknown("MoDeRaTe")).toBe("Moderate");
    expect(arenaScenarioDifficultyFromUnknown("hIGh")).toBe("High");
  });

  it("rejects substring typos and compound tokens", () => {
    expect(arenaScenarioDifficultyFromUnknown("low-ish")).toBeNull();
    expect(arenaScenarioDifficultyFromUnknown("superhigh")).toBeNull();
    expect(arenaScenarioDifficultyFromUnknown("moderately")).toBeNull();
  });

  /**
   * S105 TASK8 — **S104** copy-fields·interpretation-lines·**TASK9** reflect 라인과 다른 축:
   * BOM trim → canonical, boxed String, ZWSP / fullwidth homoglyphs.
   */
  it("S105: BOM-prefixed tokens normalize; boxed strings and homoglyphs reject", () => {
    expect(arenaScenarioDifficultyFromUnknown("\uFEFFhigh")).toBe("High");
    expect(arenaScenarioDifficultyFromUnknown("\uFEFF  moderate  ")).toBe("Moderate");
    expect(arenaScenarioDifficultyFromUnknown(Object("low"))).toBeNull();
    expect(arenaScenarioDifficultyFromUnknown(Object("High"))).toBeNull();
    expect(arenaScenarioDifficultyFromUnknown("lo\u200bw")).toBeNull();
    expect(arenaScenarioDifficultyFromUnknown("Ｈigh")).toBeNull();
    expect(arenaScenarioDifficultyFromUnknown("Hｉgh")).toBeNull();
  });

  /**
   * S144 C3 TASK8 — **S130** 동일 축 — top-level **`Symbol`** / **`bigint`** → **null** (S129 run-id·S105 BOM/boxed와 구분).
   */
  it("S144: returns null for Symbol and bigint", () => {
    expect(arenaScenarioDifficultyFromUnknown(Symbol("Low"))).toBeNull();
    expect(arenaScenarioDifficultyFromUnknown(BigInt(1))).toBeNull();
  });
});
