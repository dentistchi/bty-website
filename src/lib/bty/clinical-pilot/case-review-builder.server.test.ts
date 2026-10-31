import { describe, expect, it } from "vitest";
import type { DiscoveryPatient } from "@/domain/clinical-pilot/discovery";
import { buildCompleteReviewVariants, COMPLETE_REVIEW_VERSION, reviewFact } from "./case-review-builder.server";

const base = (): DiscoveryPatient => ({ caseId: "drchi-004", version: "discovery-2026-10-23.1", chiefComplaint: "Follow-up",
  facts: [{ id: "drchi-004:known", channel: "patient", topic: "Known", patterns: ["known"], answer: "Recorded fact", toothNumbers: [30] },
    { id: "drchi-004:unknown", channel: "exam", topic: "Unknown", patterns: ["unknown"], answer: "Unperformed", available: false }] });
const addition = () => reviewFact(4, "location", "patient", "Location", "where", "#30", true, [30]);

describe("immutable complete-review construction", () => {
  it("copies source arrays and separately marks fictional replacement and location", () => {
    const source = base(), before = JSON.stringify(source);
    const [result] = buildCompleteReviewVariants([source], [{ caseId: source.caseId,
      replacements: [reviewFact(4, "unknown", "exam", "Observed", "observed", "Fixed fictional observation")], additions: [addition()] }]);
    expect(result!.version).toBe(COMPLETE_REVIEW_VERSION);
    expect(result!.facts[0]!.id).toBe("drchi-004:location");
    expect(result!.facts.find(f => f.id.endsWith(":known"))).toEqual(source.facts[0]);
    result!.facts.find(f => f.id.endsWith(":known"))!.patterns.push("changed");
    result!.facts.find(f => f.id.endsWith(":known"))!.toothNumbers!.push(29);
    expect(JSON.stringify(source)).toBe(before);
    expect(result!.facts.filter(f => f.id !== "drchi-004:known").every(f => f.provenance === "fictional-extension-awaiting-review")).toBe(true);
  });
  it("rejects replacing a recorded available finding", () => {
    expect(() => buildCompleteReviewVariants([base()], [{ caseId: "drchi-004", additions: [],
      replacements: [reviewFact(4, "known", "patient", "Known", "known", "Changed")] }])).toThrow("REVIEW_REPLACEMENT_DENIED");
  });
  it("rejects duplicate cases, duplicate facts, missing bases and foreign provenance", () => {
    const plan = { caseId: "drchi-004", replacements: [], additions: [addition()] };
    expect(() => buildCompleteReviewVariants([base()], [plan, plan])).toThrow("REVIEW_DUPLICATE_CASE");
    expect(() => buildCompleteReviewVariants([base()], [{ ...plan, additions: [addition(), addition()] }])).toThrow("REVIEW_DUPLICATE_FACT");
    expect(() => buildCompleteReviewVariants([], [plan])).toThrow("REVIEW_BASE_REQUIRED");
    expect(() => buildCompleteReviewVariants([base(), base()], [plan])).toThrow("REVIEW_BASE_REQUIRED");
    expect(() => buildCompleteReviewVariants([base()], [{ ...plan, additions: [reviewFact(5, "location", "patient", "Wrong case", "where", "#30")] }])).toThrow("REVIEW_PROVENANCE_REQUIRED");
  });
});
