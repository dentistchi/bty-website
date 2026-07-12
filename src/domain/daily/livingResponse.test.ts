import { describe, it, expect } from "vitest";
import {
  admitLivingResponse,
  evidenceFingerprint,
  isLivingResponseRelationship,
  type LivingResponseEvidenceFact,
  type LivingResponsePacket,
  type LivingResponseRelationship,
} from "@/domain/daily/livingResponse";

function fact(over: Partial<LivingResponseEvidenceFact> = {}): LivingResponseEvidenceFact {
  return {
    id: "fact:self_return_continuity",
    code: "SELF_RETURN_STEADY",
    relationship: "self",
    evidenceClass: "self_return_continuity",
    confidence: "medium",
    provenanceIds: ["2026-07-12"],
    ...over,
  };
}
function packet(relationship: LivingResponseRelationship, facts: LivingResponseEvidenceFact[], over: Partial<LivingResponsePacket> = {}): LivingResponsePacket {
  return { commitmentId: "c1", userId: "u1", dayKey: "2026-07-12", relationship, facts, prohibitedFieldsPresent: false, evidenceFingerprint: evidenceFingerprint(facts), ...over };
}

describe("admitLivingResponse — fail-closed generation gate", () => {
  it("commitment alone (no facts) → INSUFFICIENT_EVIDENCE, ineligible", () => {
    const a = admitLivingResponse(packet("self", []));
    expect(a.eligible).toBe(false);
    expect(a.reason).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("single same-day arrival (return continuity, LOW) is insufficient → not eligible", () => {
    const a = admitLivingResponse(packet("self", [fact({ code: "SELF_RETURN_EMERGING", confidence: "low" })]));
    expect(a.eligible).toBe(false);
    expect(a.reason).toBe("LOW_CONFIDENCE");
  });

  it("qualifying Self return continuity (medium/high) → ELIGIBLE grounded", () => {
    const a = admitLivingResponse(packet("self", [fact({ confidence: "high", code: "SELF_RETURN_STRONG" })]));
    expect(a.eligible).toBe(true);
    expect(a.reason).toBe("ELIGIBLE");
    expect(a.confidence).toBe("grounded");
    expect(a.qualifyingEvidenceCodes).toContain("SELF_RETURN_STRONG");
  });

  it("two distinct Self classes with ≥1 strong → ELIGIBLE", () => {
    const a = admitLivingResponse(
      packet("self", [
        fact({ evidenceClass: "self_return_continuity", code: "SELF_RETURN_EMERGING", confidence: "low", provenanceIds: ["d1"] }),
        fact({ id: "fact:self_keep_continuity", evidenceClass: "self_keep_continuity", code: "SELF_KEEP_STEADY", confidence: "medium", provenanceIds: ["k1"] }),
      ]),
    );
    expect(a.eligible).toBe(true);
  });

  it("relationship mismatch (fact ≠ committed) → RELATIONSHIP_MISMATCH", () => {
    const a = admitLivingResponse(packet("self", [fact({ relationship: "others", evidenceClass: "others_verified_relational_action" })]));
    expect(a.reason).toBe("RELATIONSHIP_MISMATCH");
    expect(a.eligible).toBe(false);
  });

  it("World always → WORLD_FALLBACK_ONLY (never eligible)", () => {
    const a = admitLivingResponse(packet("world", []));
    expect(a.reason).toBe("WORLD_FALLBACK_ONLY");
  });

  it("prohibited fields present → PROHIBITED_FIELDS", () => {
    const a = admitLivingResponse(packet("self", [fact({ confidence: "high" })], { prohibitedFieldsPresent: true }));
    expect(a.reason).toBe("PROHIBITED_FIELDS");
  });

  it("unknown evidence class fails closed → PROVENANCE_INCOMPLETE", () => {
    const a = admitLivingResponse(packet("self", [fact({ evidenceClass: "mystery" as never, confidence: "high" })]));
    expect(a.reason).toBe("PROVENANCE_INCOMPLETE");
  });

  it("empty provenance → PROVENANCE_INCOMPLETE", () => {
    const a = admitLivingResponse(packet("self", [fact({ confidence: "high", provenanceIds: [] })]));
    expect(a.reason).toBe("PROVENANCE_INCOMPLETE");
  });

  it("Others verified relational action (medium) → ELIGIBLE", () => {
    const a = admitLivingResponse(
      packet("others", [fact({ relationship: "others", evidenceClass: "others_verified_relational_action", code: "OTHERS_RELATIONAL_PRESENT", confidence: "medium", provenanceIds: ["c1"] })]),
    );
    expect(a.eligible).toBe(true);
    expect(a.reason).toBe("ELIGIBLE");
  });

  it("Others low-confidence only → LOW_CONFIDENCE (0 provider)", () => {
    const a = admitLivingResponse(
      packet("others", [fact({ relationship: "others", evidenceClass: "others_reexposure_change", confidence: "low", provenanceIds: ["s1"] })]),
    );
    expect(a.eligible).toBe(false);
    expect(a.reason).toBe("LOW_CONFIDENCE");
  });
});

describe("evidenceFingerprint", () => {
  it("is deterministic, order-independent, and contains no raw text", () => {
    const f1 = fact({ provenanceIds: ["a", "b"] });
    const f2 = fact({ id: "fact:self_keep_continuity", evidenceClass: "self_keep_continuity", code: "SELF_KEEP_STEADY", provenanceIds: ["k"] });
    const a = evidenceFingerprint([f1, f2]);
    const b = evidenceFingerprint([f2, f1]);
    expect(a).toBe(b);
    expect(a).toMatch(/^lrf1_[0-9a-f]{8}$/);
  });

  it("relationship guard accepts only self/others/world", () => {
    for (const v of ["self", "others", "world"]) expect(isLivingResponseRelationship(v)).toBe(true);
    for (const v of ["Self", "ground", "", null]) expect(isLivingResponseRelationship(v)).toBe(false);
  });
});
