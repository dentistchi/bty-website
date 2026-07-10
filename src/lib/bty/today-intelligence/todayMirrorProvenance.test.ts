/**
 * Today Mirror — provenance integrity patch (matrix §5: 1–12). Synthetic, no DB, no real provider.
 *
 * Proves: every supportingEvidenceId must resolve (strict), provenanceMarkers are typed-separate and
 * never anchor evidence, pilot status and admission share one verdict, and the provider hard gate
 * stays at zero whenever any evidence reference is unresolved.
 */
import { describe, it, expect, vi } from "vitest";
import { selectMirrorLens } from "@/domain/daily/todayMirrorLens";
import { admitTodayMirrorGeneration, packetProvenanceComplete } from "@/domain/daily/todayMirrorAdmission";
import { deriveReexposureChange } from "@/domain/daily/todayMirrorSignals";
import { deriveShadowStatus } from "@/lib/bty/today-intelligence/pilotShadow";
import { admitAndGenerateTodayMirror } from "@/lib/bty/today-intelligence/todayMirrorAdmittedGenerate";
import { makeMockMirrorClient } from "@/lib/bty/today-intelligence/__fixtures__/todayMirrorFixtures";
import type { MirrorLlmClient } from "@/lib/bty/today-intelligence/todayMirrorGenerate";
import type { ConfirmedFact, DerivedSignal, MirrorConfidence, MirrorLens, PacketConfidence, TodayMirrorEvidencePacket } from "@/domain/daily/todayMirror.types";

function fact(id: string): ConfirmedFact {
  return { id, kind: "SYNTH", occurredAt: "2026-07-10T06:00:00Z", source: { tableOrService: "synthetic" }, summaryCode: "SYNTH" };
}
function sig(code: string, c: MirrorConfidence, ids: string[], markers?: string[]): DerivedSignal {
  return { code, confidence: c, supportingEvidenceIds: ids, ...(markers ? { provenanceMarkers: markers } : {}) };
}
function mkPacket(signals: DerivedSignal[], facts: ConfirmedFact[], allowedLenses: MirrorLens[], confidence: PacketConfidence): TodayMirrorEvidencePacket {
  return { userDay: { date: "2026-07-10", timezone: "UTC", boundaryHour: 5 }, confirmedFacts: facts, derivedSignals: signals, openContract: null, insufficientEvidence: [], prohibitedClaims: [], allowedLenses, confidence };
}
const admit = (p: TodayMirrorEvidencePacket) => admitTodayMirrorGeneration(p, selectMirrorLens(p));
function spyClient(): { client: MirrorLlmClient; createSpy: ReturnType<typeof vi.fn> } {
  const base = makeMockMirrorClient();
  const createSpy = vi.fn((...a: Parameters<MirrorLlmClient["chat"]["completions"]["create"]>) => base.chat.completions.create(...a));
  return { client: { chat: { completions: { create: createSpy as unknown as MirrorLlmClient["chat"]["completions"]["create"] } } }, createSpy };
}

describe("provenance completeness (strict)", () => {
  it("1. one signal, one valid evidence ID → PASS", () => {
    expect(packetProvenanceComplete(mkPacket([sig("REEXPOSURE_CHANGED", "high", ["f1"])], [fact("f1")], ["reexposure_change"], "high"))).toBe(true);
  });
  it("2. one signal, two valid evidence IDs → PASS", () => {
    expect(packetProvenanceComplete(mkPacket([sig("REPEATED_PATTERN", "high", ["f1", "f2"])], [fact("f1"), fact("f2")], ["repeated_pattern"], "high"))).toBe(true);
  });
  it("3. one valid + one unresolved evidence ID → FAIL / PROVENANCE_INCOMPLETE", () => {
    const p = mkPacket([sig("REEXPOSURE_CHANGED", "high", ["f1", "MISSING"])], [fact("f1")], ["reexposure_change"], "high");
    expect(packetProvenanceComplete(p)).toBe(false);
    const a = admit(p);
    expect(a.eligible).toBe(false);
    if (!a.eligible) expect(a.reason).toBe("PROVENANCE_INCOMPLETE");
  });
  it("4. all evidence IDs unresolved → FAIL", () => {
    expect(packetProvenanceComplete(mkPacket([sig("REEXPOSURE_CHANGED", "high", ["X", "Y"])], [fact("f1")], ["reexposure_change"], "high"))).toBe(false);
  });
  it("5. empty supportingEvidenceIds for a substantive signal → FAIL", () => {
    expect(packetProvenanceComplete(mkPacket([sig("REEXPOSURE_CHANGED", "high", [])], [fact("f1")], ["reexposure_change"], "high"))).toBe(false);
  });
  it("6. provenance marker separated from evidence IDs → marker does NOT require fact resolution", () => {
    const p = mkPacket([sig("REEXPOSURE_CHANGED", "high", ["f1"], ["outcome:unresolved-xyz"])], [fact("f1")], ["reexposure_change"], "high");
    expect(packetProvenanceComplete(p)).toBe(true); // marker ignored by resolution
    expect(admit(p).eligible).toBe(true);
  });
  it("7. provenance marker ALONE (no resolving fact) → cannot make generation eligible", () => {
    const p = mkPacket([sig("REEXPOSURE_CHANGED", "high", [], ["outcome:e2"])], [fact("f1")], ["reexposure_change"], "high");
    expect(packetProvenanceComplete(p)).toBe(false);
    const a = admit(p);
    expect(a.eligible).toBe(false);
    if (!a.eligible) expect(a.reason).toBe("PROVENANCE_INCOMPLETE");
  });
});

describe("reexposure outcome classification (Option B)", () => {
  it("8. reexposure with valid signature fact + outcome MARKER → eligible when other gates pass", () => {
    const out = deriveReexposureChange({ signatureId: "s1", patternFamily: "repair_avoidance", axis: "repair", repeatCount: 3, lastValidationResult: "changed", confidenceScore: 0.8, lastSeenAt: "2026-07-09T12:00:00Z", relationship: "Others", priorEventId: "e1", laterEventId: "e2" });
    const signal = out.signals[0];
    // outcome:e2 is a MARKER, not an evidence reference; supportingEvidenceIds resolves to the signature fact.
    expect(signal.supportingEvidenceIds).toEqual(["signature:s1"]);
    expect(signal.provenanceMarkers).toEqual(["outcome:e2"]);
    const p = mkPacket(out.signals, out.facts, ["reexposure_change"], "high");
    expect(packetProvenanceComplete(p)).toBe(true);
    expect(admit(p)).toMatchObject({ eligible: true, lens: "reexposure_change", confidence: "high" });
  });
  it("9. reexposure with valid behavior fact but UNRESOLVED outcome REFERENCE (in evidence ids) → ineligible", () => {
    // Hand-crafted regression: an outcome placed (incorrectly) into supportingEvidenceIds must fail.
    const p = mkPacket([sig("REEXPOSURE_CHANGED", "high", ["signature:s1", "outcome:unresolved"])], [fact("signature:s1")], ["reexposure_change"], "high");
    const a = admit(p);
    expect(a.eligible).toBe(false);
    if (!a.eligible) expect(a.reason).toBe("PROVENANCE_INCOMPLETE");
  });
});

describe("alignment + provider gate", () => {
  const packets = [
    mkPacket([sig("REEXPOSURE_CHANGED", "high", ["f1"])], [fact("f1")], ["reexposure_change"], "high"), // complete
    mkPacket([sig("REEXPOSURE_CHANGED", "high", ["f1", "MISSING"])], [fact("f1")], ["reexposure_change"], "high"), // incomplete
    mkPacket([sig("REEXPOSURE_CHANGED", "high", [])], [fact("f1")], ["reexposure_change"], "high"), // empty
  ];
  it("10. pilot status and admission produce identical provenance verdict", () => {
    for (const p of packets) {
      const complete = packetProvenanceComplete(p);
      expect(deriveShadowStatus(p).packet.evidenceReferencesResolve).toBe(complete);
      const a = admit(p);
      const admissionSaysProvenanceOk = a.eligible || a.reason !== "PROVENANCE_INCOMPLETE";
      expect(admissionSaysProvenanceOk).toBe(complete);
    }
  });
  it("11. provider spy stays ZERO whenever any evidence reference is unresolved", async () => {
    const { client, createSpy } = spyClient();
    const p = mkPacket([sig("REEXPOSURE_CHANGED", "high", ["signature:s1", "outcome:unresolved"])], [fact("signature:s1")], ["reexposure_change"], "high");
    const r = await admitAndGenerateTodayMirror({ packet: p, recent: { recentLenses: [], recentOpeningPatterns: [], recentActionVerbs: [], recentRecommendations: [], recentNoveltySignatures: [] }, locale: "en", client });
    expect(r.admitted).toBe(false);
    if (!r.admitted) expect(r.admission.reason).toBe("PROVENANCE_INCOMPLETE");
    expect(createSpy).not.toHaveBeenCalled();
  });
  it("12. real-run-equivalent LOW relationship_concentration remains ineligible", () => {
    const p = mkPacket([sig("RELATIONSHIP_CONCENTRATION", "low", ["f1"])], [fact("f1")], ["relationship_concentration"], "low");
    const a = admit(p);
    expect(a).toEqual({ eligible: false, reason: "LOW_CONFIDENCE_RELATIONSHIP_ONLY", diagnosticLens: "relationship_concentration", confidence: "low" });
  });
});
