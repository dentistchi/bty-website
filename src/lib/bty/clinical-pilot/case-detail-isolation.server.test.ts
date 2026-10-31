import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import hashes from "../../../../scripts/fixtures/clinical-discovery-frozen-pack-sha256.v1.json";
import { discoveryPatients, founderPreviewPackVersions } from "./discovery-cases.server";
import { CASE_DETAIL_REVIEW_VERSION } from "./case-detail-variants.server";

describe("frozen clinical record identity", () => {
  it("retains all 25 previously registered patient objects with exactly the same serialization", () => {
    expect(Object.keys(hashes)).toHaveLength(25);
    for (const [key, expected] of Object.entries(hashes)) {
      const patient = discoveryPatients.find(p => `${p.caseId}@${p.version}` === key);
      expect(patient, key).toBeDefined();
      expect(createHash("sha256").update(JSON.stringify(patient)).digest("hex"), key).toBe(expected);
    }
  });
  it("registers exactly three appended review versions, all behind the existing preview gate", () => {
    const review = discoveryPatients.filter(p => p.version === CASE_DETAIL_REVIEW_VERSION);
    expect(review.map(p => p.caseId)).toEqual(["drchi-005", "drchi-006", "drchi-011"]);
    expect(discoveryPatients.filter(p => p.version !== "discovery-2026-10-31.2-review-b")).toHaveLength(28);
    for (const p of review) expect(founderPreviewPackVersions.has(`${p.caseId}@${p.version}`)).toBe(true);
  });
});
