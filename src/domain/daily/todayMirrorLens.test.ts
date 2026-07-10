import { describe, it, expect } from "vitest";
import { selectMirrorLens } from "@/domain/daily/todayMirrorLens";
import type { TodayMirrorEvidencePacket, MirrorLens } from "@/domain/daily/todayMirror.types";

function packet(over: Partial<TodayMirrorEvidencePacket>): TodayMirrorEvidencePacket {
  return {
    userDay: { date: "2026-07-10", timezone: "Asia/Seoul", boundaryHour: 5 },
    confirmedFacts: [],
    derivedSignals: [],
    openContract: null,
    insufficientEvidence: [],
    prohibitedClaims: [],
    allowedLenses: [
      "reexposure_change", "recovery_reentry", "return_after_miss", "completion_latency",
      "open_contract_gravity", "repeated_pattern", "relationship_concentration",
    ],
    confidence: "none",
    ...over,
  };
}

const sig = (code: string, confidence: "low" | "medium" | "high", ids = ["f0"]) => ({
  code, confidence, supportingEvidenceIds: ids,
});

describe("selectMirrorLens — deterministic priority", () => {
  it("insufficient evidence → restraint lens, no action", () => {
    const a = selectMirrorLens(packet({ confidence: "none" }));
    expect(a.selectedLens).toBe("insufficient_evidence");
    expect(a.allowedActionTypes).toEqual([]);
    expect(a.supportingEvidenceIds).toEqual([]);
  });

  it("reexposure_change outranks a coincident relationship_concentration", () => {
    const a = selectMirrorLens(packet({
      confidence: "high",
      derivedSignals: [sig("RELATIONSHIP_CONCENTRATION", "high"), sig("REEXPOSURE_CHANGED", "medium")],
    }));
    expect(a.selectedLens).toBe("reexposure_change");
  });

  it("stronger-evidence rank wins over a lower-priority lens even at higher confidence", () => {
    // return_after_miss (rank 3, medium) must outrank relationship_concentration (rank 7, high)
    const a = selectMirrorLens(packet({
      confidence: "high",
      derivedSignals: [sig("RELATIONSHIP_CONCENTRATION", "high"), sig("RETURN_AFTER_MISS", "medium")],
    }));
    expect(a.selectedLens).toBe("return_after_miss");
  });

  it("open contract → open_contract_gravity, and mustAvoidContractDuplication", () => {
    const a = selectMirrorLens(packet({
      confidence: "high",
      openContract: { id: "c1", actionTextReference: "ref" },
    }));
    expect(a.selectedLens).toBe("open_contract_gravity");
    expect(a.mustAvoidContractDuplication).toBe(true);
    expect(a.allowedActionTypes).toEqual([]);
  });

  it("respects allowedLenses gate (disallowed lens is skipped)", () => {
    const a = selectMirrorLens(packet({
      confidence: "high",
      allowedLenses: ["relationship_concentration"] as MirrorLens[],
      derivedSignals: [sig("REEXPOSURE_CHANGED", "high"), sig("RELATIONSHIP_CONCENTRATION", "high")],
    }));
    expect(a.selectedLens).toBe("relationship_concentration");
  });

  it("selection is deterministic across repeated calls", () => {
    const p = packet({ confidence: "high", derivedSignals: [sig("REPEATED_PATTERN", "medium")] });
    const first = selectMirrorLens(p).selectedLens;
    for (let i = 0; i < 10; i++) expect(selectMirrorLens(p).selectedLens).toBe(first);
  });

  it("confidence none never yields a claim lens even with a stray signal", () => {
    const a = selectMirrorLens(packet({ confidence: "none", derivedSignals: [sig("REPEATED_PATTERN", "low")] }));
    expect(a.selectedLens).toBe("insufficient_evidence");
  });
});
