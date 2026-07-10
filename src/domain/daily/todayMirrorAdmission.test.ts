/**
 * Today Mirror — generation-admission policy (matrix §7: cases 1–12, 14–16). Pure, synthetic.
 */
import { describe, it, expect } from "vitest";
import { selectMirrorLens } from "@/domain/daily/todayMirrorLens";
import { admitTodayMirrorGeneration } from "@/domain/daily/todayMirrorAdmission";
import type {
  ConfirmedFact,
  DerivedSignal,
  MirrorConfidence,
  MirrorLens,
  PacketConfidence,
  TodayMirrorEvidencePacket,
} from "@/domain/daily/todayMirror.types";

function fact(id: string): ConfirmedFact {
  return { id, kind: "SYNTH", occurredAt: "2026-07-10T06:00:00Z", source: { tableOrService: "synthetic" }, summaryCode: "SYNTH" };
}
function sig(code: string, confidence: MirrorConfidence, ids: string[]): DerivedSignal {
  return { code, confidence, supportingEvidenceIds: ids };
}
function mkPacket(over: {
  signals?: DerivedSignal[];
  facts?: ConfirmedFact[];
  allowedLenses?: MirrorLens[];
  confidence?: PacketConfidence;
  openContract?: TodayMirrorEvidencePacket["openContract"];
  insufficientEvidence?: string[];
}): TodayMirrorEvidencePacket {
  return {
    userDay: { date: "2026-07-10", timezone: "America/Los_Angeles", boundaryHour: 5 },
    confirmedFacts: over.facts ?? [],
    derivedSignals: over.signals ?? [],
    openContract: over.openContract ?? null,
    insufficientEvidence: over.insufficientEvidence ?? [],
    prohibitedClaims: [],
    allowedLenses: over.allowedLenses ?? [],
    confidence: over.confidence ?? "none",
  };
}
/** Build packet → select lens → admit, mirroring the real pipeline order. */
function admit(packet: TodayMirrorEvidencePacket, opts?: { prohibitedFieldsPresent?: boolean }) {
  return admitTodayMirrorGeneration(packet, selectMirrorLens(packet), opts);
}

describe("today mirror generation admission", () => {
  it("1. real-run-equivalent: LOW relationship_concentration, no substantive signal → ineligible", () => {
    const p = mkPacket({ signals: [sig("RELATIONSHIP_CONCENTRATION", "low", ["f1"])], facts: [fact("f1")], allowedLenses: ["relationship_concentration"], confidence: "low" });
    const a = admit(p);
    expect(a).toEqual({ eligible: false, reason: "LOW_CONFIDENCE_RELATIONSHIP_ONLY", diagnosticLens: "relationship_concentration", confidence: "low" });
  });

  it("2. insufficient_evidence → ineligible", () => {
    const a = admit(mkPacket({ confidence: "none" }));
    expect(a.eligible).toBe(false);
    if (!a.eligible) expect(a.reason).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("3. reexposure MEDIUM with full provenance → eligible", () => {
    const p = mkPacket({ signals: [sig("REEXPOSURE_CHANGED", "medium", ["f1"])], facts: [fact("f1")], allowedLenses: ["reexposure_change"], confidence: "medium" });
    const a = admit(p);
    expect(a).toMatchObject({ eligible: true, reason: "QUALIFYING_EVIDENCE", lens: "reexposure_change", confidence: "medium" });
  });

  it("4. reexposure LOW → ineligible", () => {
    const p = mkPacket({ signals: [sig("REEXPOSURE_CHANGED", "low", ["f1"])], facts: [fact("f1")], allowedLenses: ["reexposure_change"], confidence: "low" });
    expect(admit(p).eligible).toBe(false);
  });

  it("5. repeated event-backed HIGH → eligible", () => {
    const p = mkPacket({ signals: [sig("REPEATED_PATTERN", "high", ["f1", "f2"])], facts: [fact("f1"), fact("f2")], allowedLenses: ["repeated_pattern"], confidence: "high" });
    expect(admit(p)).toMatchObject({ eligible: true, lens: "repeated_pattern", confidence: "high" });
  });

  it("6. repeated summary-only LOW → ineligible", () => {
    const p = mkPacket({ signals: [sig("REPEATED_PATTERN", "low", ["f1"])], facts: [fact("f1")], allowedLenses: ["repeated_pattern"], confidence: "low" });
    const a = admit(p);
    expect(a.eligible).toBe(false);
    if (!a.eligible) expect(a.reason).toBe("NO_SUBSTANTIVE_SIGNAL");
  });

  it("7. completion shorter, MEDIUM, windows valid → eligible", () => {
    const p = mkPacket({ signals: [sig("LATENCY_SHORTENED", "medium", ["f1", "f2"])], facts: [fact("f1"), fact("f2")], allowedLenses: ["completion_latency"], confidence: "medium" });
    expect(admit(p)).toMatchObject({ eligible: true, lens: "completion_latency", confidence: "medium" });
  });

  it("8. completion longer (no shortened signal) → ineligible", () => {
    const p = mkPacket({ facts: [fact("f1"), fact("f2")], insufficientEvidence: ["LATENCY_NOT_SHORTER"], confidence: "none" });
    expect(admit(p).eligible).toBe(false);
  });

  it("9. completion shorter but weak/invalid comparison identity (LOW) → ineligible COMPARISON_IDENTITY_WEAK", () => {
    const p = mkPacket({ signals: [sig("LATENCY_SHORTENED", "low", ["f1", "f2"])], facts: [fact("f1"), fact("f2")], allowedLenses: ["completion_latency"], confidence: "low" });
    const a = admit(p);
    expect(a.eligible).toBe(false);
    if (!a.eligible) expect(a.reason).toBe("COMPARISON_IDENTITY_WEAK");
  });

  it("10. relationship_concentration MEDIUM with sufficient support → eligible", () => {
    const p = mkPacket({ signals: [sig("RELATIONSHIP_CONCENTRATION", "medium", ["f1"])], facts: [fact("f1")], allowedLenses: ["relationship_concentration"], confidence: "medium" });
    expect(admit(p)).toMatchObject({ eligible: true, lens: "relationship_concentration", confidence: "medium" });
  });

  it("11. relationship_concentration LOW → ineligible", () => {
    const p = mkPacket({ signals: [sig("RELATIONSHIP_CONCENTRATION", "low", ["f1"])], facts: [fact("f1")], allowedLenses: ["relationship_concentration"], confidence: "low" });
    const a = admit(p);
    if (!a.eligible) expect(a.reason).toBe("LOW_CONFIDENCE_RELATIONSHIP_ONLY");
    else throw new Error("must be ineligible");
  });

  it("12. one relationship occurrence only (thin → low support) → ineligible", () => {
    // V1 collapses single/stale relationship evidence into LOW confidence at the brief tier.
    const p = mkPacket({ signals: [sig("RELATIONSHIP_CONCENTRATION", "low", ["only"])], facts: [fact("only")], allowedLenses: ["relationship_concentration"], confidence: "low" });
    expect(admit(p).eligible).toBe(false);
  });

  it("14. return_after_miss unavailable → ineligible", () => {
    const p = mkPacket({ insufficientEvidence: ["RETURN_LINKAGE_UNAVAILABLE"], confidence: "none" });
    expect(admit(p).eligible).toBe(false);
  });

  it("15. unresolved evidence reference → ineligible PROVENANCE_INCOMPLETE", () => {
    const p = mkPacket({ signals: [sig("REEXPOSURE_CHANGED", "high", ["MISSING"])], facts: [fact("f1")], allowedLenses: ["reexposure_change"], confidence: "high" });
    const a = admit(p);
    expect(a.eligible).toBe(false);
    if (!a.eligible) expect(a.reason).toBe("PROVENANCE_INCOMPLETE");
  });

  it("16. prohibited field detected → ineligible PROVENANCE_INCOMPLETE", () => {
    const p = mkPacket({ signals: [sig("REEXPOSURE_CHANGED", "high", ["f1"])], facts: [fact("f1")], allowedLenses: ["reexposure_change"], confidence: "high" });
    const a = admit(p, { prohibitedFieldsPresent: true });
    expect(a.eligible).toBe(false);
    if (!a.eligible) expect(a.reason).toBe("PROVENANCE_INCOMPLETE");
  });
});
