import { describe, it, expect } from "vitest";
import {
  admitLivingResponse,
  evidenceFingerprint,
  isLivingResponseRelationship,
  type LivingResponseEvidenceFact,
  type LivingResponsePacket,
  type LivingResponseRelationship,
} from "@/domain/daily/livingResponse";
import { deriveCommitmentFrame } from "@/domain/daily/livingResponseFrame";

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
  const commitmentFrame = deriveCommitmentFrame(relationship)!;
  return { commitmentId: "c1", userId: "u1", dayKey: "2026-07-12", relationship, commitmentFrame, facts, concepts: [], prohibitedFieldsPresent: false, evidenceFingerprint: evidenceFingerprint(facts, commitmentFrame), ...over };
}

describe("admitLivingResponse — V2.1 depth-aware, fail-closed guards preserved", () => {
  it("commitment alone (valid frame, no facts) → ELIGIBLE at commitment depth", () => {
    const a = admitLivingResponse(packet("self", []));
    expect(a.eligible).toBe(true);
    expect(a.reason).toBe("ELIGIBLE");
    expect(a.depth).toBe("commitment");
    expect(a.qualifyingEvidenceCodes).toEqual([]);
  });

  it("single same-day arrival (return continuity, LOW) → commitment depth (history too weak for repetition)", () => {
    const a = admitLivingResponse(packet("self", [fact({ code: "SELF_RETURN_EMERGING", confidence: "low" })]));
    expect(a.eligible).toBe(true);
    expect(a.depth).toBe("commitment");
  });

  it("qualifying Self return continuity (medium/high) → ELIGIBLE at repetition depth", () => {
    const a = admitLivingResponse(packet("self", [fact({ confidence: "high", code: "SELF_RETURN_STRONG" })]));
    expect(a.eligible).toBe(true);
    expect(a.reason).toBe("ELIGIBLE");
    expect(a.depth).toBe("repetition");
    expect(a.confidence).toBe("grounded");
    expect(a.qualifyingEvidenceCodes).toContain("SELF_RETURN_STRONG");
  });

  it("two distinct Self classes with ≥1 strong → repetition depth", () => {
    const a = admitLivingResponse(
      packet("self", [
        fact({ evidenceClass: "self_return_continuity", code: "SELF_RETURN_EMERGING", confidence: "low", provenanceIds: ["d1"] }),
        fact({ id: "fact:self_keep_continuity", evidenceClass: "self_keep_continuity", code: "SELF_KEEP_STEADY", confidence: "medium", provenanceIds: ["k1"] }),
      ]),
    );
    expect(a.eligible).toBe(true);
    expect(a.depth).toBe("repetition");
  });

  it("relationship mismatch (fact ≠ committed) → RELATIONSHIP_MISMATCH, ineligible (guard preserved)", () => {
    const a = admitLivingResponse(packet("self", [fact({ relationship: "others", evidenceClass: "others_verified_relational_action" })]));
    expect(a.reason).toBe("RELATIONSHIP_MISMATCH");
    expect(a.eligible).toBe(false);
    expect(a.depth).toBeNull();
  });

  it("World with valid frame → ELIGIBLE at commitment depth (frame is valid evidence; no history)", () => {
    const a = admitLivingResponse(packet("world", []));
    expect(a.eligible).toBe(true);
    expect(a.depth).toBe("commitment");
  });

  it("invalid / mismatched frame → FRAME_INVALID, ineligible (fail closed)", () => {
    // packet says self but the frame is the others derivation → forged/mismatched → denied.
    const a = admitLivingResponse(packet("self", [], { commitmentFrame: deriveCommitmentFrame("others")! }));
    expect(a.eligible).toBe(false);
    expect(a.reason).toBe("FRAME_INVALID");
  });

  it("prohibited fields present → PROHIBITED_FIELDS (guard preserved)", () => {
    const a = admitLivingResponse(packet("self", [fact({ confidence: "high" })], { prohibitedFieldsPresent: true }));
    expect(a.reason).toBe("PROHIBITED_FIELDS");
    expect(a.eligible).toBe(false);
  });

  it("unknown evidence class fails closed → PROVENANCE_INCOMPLETE (guard preserved)", () => {
    const a = admitLivingResponse(packet("self", [fact({ evidenceClass: "mystery" as never, confidence: "high" })]));
    expect(a.reason).toBe("PROVENANCE_INCOMPLETE");
    expect(a.eligible).toBe(false);
  });

  it("empty provenance → PROVENANCE_INCOMPLETE (historical provenance guard NOT weakened)", () => {
    const a = admitLivingResponse(packet("self", [fact({ confidence: "high", provenanceIds: [] })]));
    expect(a.reason).toBe("PROVENANCE_INCOMPLETE");
    expect(a.eligible).toBe(false);
  });

  it("Others verified relational action (medium) → ELIGIBLE at repetition depth", () => {
    const a = admitLivingResponse(
      packet("others", [fact({ relationship: "others", evidenceClass: "others_verified_relational_action", code: "OTHERS_RELATIONAL_PRESENT", confidence: "medium", provenanceIds: ["c1"] })]),
    );
    expect(a.eligible).toBe(true);
    expect(a.reason).toBe("ELIGIBLE");
    expect(a.depth).toBe("repetition");
  });

  it("Others low-confidence only → commitment depth (history too weak for repetition)", () => {
    const a = admitLivingResponse(
      packet("others", [fact({ relationship: "others", evidenceClass: "others_reexposure_change", confidence: "low", provenanceIds: ["s1"] })]),
    );
    expect(a.eligible).toBe(true);
    expect(a.depth).toBe("commitment");
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

  it("frame material changes the fingerprint but keeps it reproducible per relationship", () => {
    const f = [fact({ provenanceIds: ["a"] })];
    const selfFrame = deriveCommitmentFrame("self")!;
    const othersFrame = deriveCommitmentFrame("others")!;
    const noFrame = evidenceFingerprint(f);
    const withSelf = evidenceFingerprint(f, selfFrame);
    // frame folds into the hash → distinct from the frameless hash and from a different frame
    expect(withSelf).not.toBe(noFrame);
    expect(withSelf).not.toBe(evidenceFingerprint(f, othersFrame));
    // reproducible: same facts + same (relationship-derived) frame → identical
    expect(withSelf).toBe(evidenceFingerprint(f, deriveCommitmentFrame("self")!));
    expect(withSelf).toMatch(/^lrf1_[0-9a-f]{8}$/);
  });
});
