import { describe, it, expect } from "vitest";
import { RAG_EXPANSION_BANK, expandContextByPhase } from "./mentor-rag-expander.service";

describe("mentor-rag-expander.service", () => {
  it("RAG_EXPANSION_BANK has 3 blocks per phase", () => {
    for (const p of ["ACKNOWLEDGEMENT", "REFLECTION", "REINTEGRATION", "RENEWAL"] as const) {
      expect(RAG_EXPANSION_BANK[p].length).toBe(3);
    }
  });

  it("expandContextByPhase appends one localized line", () => {
    const ctx = expandContextByPhase(
      { narratives: [], behaviorPatternLines: [], phase: "REFLECTION", mirrors: [], userId: "u1" },
      "REFLECTION",
      "ko",
    );
    expect(ctx.mentorRagExpansionLines?.length).toBe(1);
    expect(ctx.mentorRagExpansionLines?.[0]).toContain("주제");
  });
});
