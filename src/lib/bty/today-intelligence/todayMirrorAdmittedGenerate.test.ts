/**
 * Today Mirror — provider HARD GATE (matrix §7: 13, 17, 18) + pilot generationAdmission (§8).
 * Synthetic only. Proves the provider is never contacted for ineligible evidence.
 */
import { describe, it, expect, vi } from "vitest";
import { admitAndGenerateTodayMirror } from "@/lib/bty/today-intelligence/todayMirrorAdmittedGenerate";
import { runPilotEvidenceShadow } from "@/lib/bty/today-intelligence/pilotShadow";
import { makeMockMirrorClient } from "@/lib/bty/today-intelligence/__fixtures__/todayMirrorFixtures";
import { okConfig, makeFakeReaders } from "@/lib/bty/today-intelligence/__fixtures__/pilotShadowFixtures";
import type { MirrorLlmClient } from "@/lib/bty/today-intelligence/todayMirrorGenerate";
import type { TodayIntelligence } from "@/domain/daily/todayIntelligence";
import type { ConfirmedFact, DerivedSignal, MirrorConfidence, MirrorLens, PacketConfidence, TodayMirrorEvidencePacket } from "@/domain/daily/todayMirror.types";

const NOW = new Date("2026-07-10T18:00:00Z");
const RECENT = { recentLenses: [], recentOpeningPatterns: [], recentActionVerbs: [], recentRecommendations: [], recentNoveltySignatures: [] };

function fact(id: string): ConfirmedFact {
  return { id, kind: "SYNTH", occurredAt: "2026-07-10T06:00:00Z", source: { tableOrService: "synthetic" }, summaryCode: "SYNTH" };
}
function mkPacket(signals: DerivedSignal[], facts: ConfirmedFact[], allowedLenses: MirrorLens[], confidence: PacketConfidence, openContract: TodayMirrorEvidencePacket["openContract"] = null): TodayMirrorEvidencePacket {
  return { userDay: { date: "2026-07-10", timezone: "UTC", boundaryHour: 5 }, confirmedFacts: facts, derivedSignals: signals, openContract, insufficientEvidence: [], prohibitedClaims: [], allowedLenses, confidence };
}
function s(code: string, c: MirrorConfidence, ids: string[]): DerivedSignal {
  return { code, confidence: c, supportingEvidenceIds: ids };
}

/** Spy wrapper around a MirrorLlmClient so we can assert provider (create) call count. */
function spyClient(): { client: MirrorLlmClient; createSpy: ReturnType<typeof vi.fn> } {
  const base = makeMockMirrorClient();
  const createSpy = vi.fn((...args: Parameters<MirrorLlmClient["chat"]["completions"]["create"]>) => base.chat.completions.create(...args));
  return { client: { chat: { completions: { create: createSpy as unknown as MirrorLlmClient["chat"]["completions"]["create"] } } }, createSpy };
}

const ELIGIBLE_PACKET = mkPacket([s("REEXPOSURE_CHANGED", "high", ["f1"])], [fact("f1")], ["reexposure_change"], "high");
const LOW_RELATIONSHIP_PACKET = mkPacket([s("RELATIONSHIP_CONCENTRATION", "low", ["f1"])], [fact("f1")], ["relationship_concentration"], "low");
const OPEN_CONTRACT_PACKET = mkPacket([], [], ["open_contract_gravity"], "high", { id: "open", actionTextReference: "open:REF" });

describe("provider hard gate", () => {
  it("13. open contract → provider not required; contract preserved (no generation)", async () => {
    const { client, createSpy } = spyClient();
    const r = await admitAndGenerateTodayMirror({ packet: OPEN_CONTRACT_PACKET, recent: RECENT, locale: "en", client });
    expect(r.admitted).toBe(false);
    if (!r.admitted) expect(r.admission.reason).toBe("OPEN_CONTRACT_HANDLED_DETERMINISTICALLY");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("17. provider spy stays ZERO for ineligible cases", async () => {
    for (const packet of [LOW_RELATIONSHIP_PACKET, mkPacket([], [], [], "none")]) {
      const { client, createSpy } = spyClient();
      const r = await admitAndGenerateTodayMirror({ packet, recent: RECENT, locale: "en", client });
      expect(r.admitted).toBe(false);
      expect(createSpy).not.toHaveBeenCalled();
    }
  });

  it("17b. prohibited-field ineligibility also keeps the provider spy at zero", async () => {
    const { client, createSpy } = spyClient();
    const r = await admitAndGenerateTodayMirror({ packet: ELIGIBLE_PACKET, recent: RECENT, locale: "en", client, prohibitedFieldsPresent: true });
    expect(r.admitted).toBe(false);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("18. provider spy is invoked ONLY for an eligible synthetic case", async () => {
    const { client, createSpy } = spyClient();
    const r = await admitAndGenerateTodayMirror({ packet: ELIGIBLE_PACKET, recent: RECENT, locale: "en", client });
    expect(r.admitted).toBe(true);
    if (r.admitted) expect(r.generation.ok).toBe(true);
    expect(createSpy).toHaveBeenCalledTimes(1);
  });
});

describe("pilot status generationAdmission (§8)", () => {
  it("real-run-equivalent LOW relationship → status.generationAdmission ineligible, value-safe", async () => {
    // A brief that yields a LOW relationship_concentration signal and nothing substantive.
    const brief: TodayIntelligence = { userState: "returning_no_yesterday_activity", relationshipFocus: "Others", confidence: "low", reasonCodes: ["STALE_SIGNATURE"], fallbackMode: "none" };
    const { readers } = makeFakeReaders({ brief });
    const status = await runPilotEvidenceShadow({ config: okConfig(), now: NOW, armed: true, readers });
    expect(status.packet.selectedLens).toBe("relationship_concentration");
    expect(status.packet.confidence).toBe("low");
    expect(status.generationAdmission).toEqual({ eligible: false, reason: "LOW_CONFIDENCE_RELATIONSHIP_ONLY" });
    // value-safe: only a boolean + machine code, nothing private.
    expect(JSON.stringify(status.generationAdmission)).toBe('{"eligible":false,"reason":"LOW_CONFIDENCE_RELATIONSHIP_ONLY"}');
  });

  it("eligible packet path reports generationAdmission eligible", async () => {
    const brief: TodayIntelligence = { userState: "clean_start", relationshipFocus: "CleanStart", confidence: "none", reasonCodes: [], fallbackMode: "no_evidence" };
    const { readers } = makeFakeReaders({
      reexposure: { signatureId: "s1", patternFamily: "repair_avoidance", axis: "repair", repeatCount: 3, lastValidationResult: "changed", confidenceScore: 0.9, lastSeenAt: "2026-07-09T12:00:00Z", relationship: "Others", priorEventId: "e-prior", laterEventId: "e-later" },
      brief,
    });
    const status = await runPilotEvidenceShadow({ config: okConfig(), now: NOW, armed: true, readers });
    expect(status.generationAdmission.eligible).toBe(true);
    expect(status.generationAdmission.reason).toBe("QUALIFYING_EVIDENCE");
  });
});
