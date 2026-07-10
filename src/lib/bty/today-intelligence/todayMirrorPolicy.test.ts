import { describe, it, expect } from "vitest";
import { validateMirrorResponse, scanProhibited } from "@/lib/bty/today-intelligence/todayMirrorPolicy";
import { selectMirrorLens } from "@/domain/daily/todayMirrorLens";
import { noveltySignatureOf } from "@/domain/daily/todayMirrorNovelty";
import { EMPTY_RECENT_CONTEXT, type TodayMirrorEvidencePacket, type TodayMirrorResponse } from "@/domain/daily/todayMirror.types";

function packet(): TodayMirrorEvidencePacket {
  return {
    userDay: { date: "2026-07-10", timezone: "Asia/Seoul", boundaryHour: 5 },
    confirmedFacts: [{ id: "f0", kind: "return", occurredAt: "2026-07-09T20:00:00+09:00", source: { tableOrService: "user_day" }, summaryCode: "RETURN" }],
    derivedSignals: [{ code: "RETURN_AFTER_MISS", relationship: "Others", confidence: "medium", supportingEvidenceIds: ["f0"] }],
    openContract: null,
    insufficientEvidence: [],
    prohibitedClaims: [],
    allowedLenses: ["return_after_miss"],
    confidence: "medium",
  };
}

function good(): TodayMirrorResponse {
  return {
    mirror: "After letting something slip, you came back to it.",
    perspective: "The edge today may be starting a little earlier.",
    suggestedStep: { text: "Reach out to the person you postponed, with one question.", observableCompletion: "a message is sent", timeWindow: "today" },
    uncertaintyNote: null,
    lens: "return_after_miss",
    evidenceIds: ["f0"],
    noveltySignature: noveltySignatureOf("return_after_miss", "After letting something slip", "Reach"),
  };
}

describe("todayMirror deterministic validators", () => {
  const p = packet();
  const a = selectMirrorLens(p);

  it("accepts a clean, evidence-bound response", () => {
    expect(validateMirrorResponse(good(), p, a, EMPTY_RECENT_CONTEXT).ok).toBe(true);
  });

  it("rejects generic filler", () => {
    const r = { ...good(), mirror: "Keep going, you've got this." };
    expect(validateMirrorResponse(r, p, a, EMPTY_RECENT_CONTEXT).violations).toContain("PROHIBITED_GENERIC");
  });

  it("rejects identity/motive labels", () => {
    const r = { ...good(), perspective: "You are avoidant and weak." };
    expect(validateMirrorResponse(r, p, a, EMPTY_RECENT_CONTEXT).violations).toContain("PROHIBITED_IDENTITY_MOTIVE");
  });

  it("rejects hidden metrics", () => {
    const r = { ...good(), mirror: "Your AIR rank and XP dropped." };
    expect(validateMirrorResponse(r, p, a, EMPTY_RECENT_CONTEXT).violations).toContain("PROHIBITED_HIDDEN_METRIC");
  });

  it("rejects unsupported counts in observation", () => {
    const r = { ...good(), mirror: "You returned 3 times this week." };
    expect(validateMirrorResponse(r, p, a, EMPTY_RECENT_CONTEXT).violations).toContain("UNSUPPORTED_COUNT");
  });

  it("rejects explicit relationship-choice claims", () => {
    const r = { ...good(), mirror: "You chose Others again." };
    const v = validateMirrorResponse(r, p, a, EMPTY_RECENT_CONTEXT).violations;
    expect(v).toContain("PROHIBITED_EXPLICIT_CHOICE");
  });

  it("rejects unknown evidence ids", () => {
    const r = { ...good(), evidenceIds: ["ghost"] };
    expect(validateMirrorResponse(r, p, a, EMPTY_RECENT_CONTEXT).violations.some((x) => x.startsWith("EVIDENCE_ID_UNKNOWN"))).toBe(true);
  });

  it("enforces open-contract → step must be null", () => {
    const pc = { ...packet(), openContract: { id: "c1", actionTextReference: "ref" }, allowedLenses: ["open_contract_gravity"] as TodayMirrorEvidencePacket["allowedLenses"], confidence: "high" as const };
    const ac = selectMirrorLens(pc);
    const r = { ...good(), lens: "open_contract_gravity" as const };
    expect(validateMirrorResponse(r, pc, ac, EMPTY_RECENT_CONTEXT).violations).toContain("OPEN_CONTRACT_DUPLICATION");
  });

  it("requires uncertainty note at low confidence", () => {
    const pl = { ...packet(), confidence: "low" as const, derivedSignals: [{ code: "RETURN_AFTER_MISS", relationship: "Others" as const, confidence: "low" as const, supportingEvidenceIds: ["f0"] }] };
    const al = selectMirrorLens(pl);
    const r = { ...good(), uncertaintyNote: null };
    expect(validateMirrorResponse(r, pl, al, EMPTY_RECENT_CONTEXT).violations).toContain("MISSING_UNCERTAINTY_NOTE");
  });

  it("scanProhibited surfaces categories", () => {
    expect(scanProhibited("trust the process")).toContain("GENERIC");
    expect(scanProhibited("우울증 진단")).toContain("DIAGNOSIS_TRAUMA");
  });
});
