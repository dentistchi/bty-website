import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import hashes from "../../../../scripts/fixtures/clinical-discovery-pr90-pack-sha256.v1.json";
import { discoveryPatients, founderPreviewPackVersions } from "./discovery-cases.server";

const version = "discovery-2026-10-31.2-review-b";

describe("next review cases preserve the PR90 patient record boundary", () => {
  it("retains all 28 previously registered objects with their exact serialization", () => {
    expect(Object.keys(hashes)).toHaveLength(28);
    for (const [key, hash] of Object.entries(hashes)) {
      const patient = discoveryPatients.find(p => `${p.caseId}@${p.version}` === key);
      expect(patient, key).toBeDefined();
      expect(createHash("sha256").update(JSON.stringify(patient)).digest("hex"), key).toBe(hash);
    }
  });

  it("appends only the three new Founder preview versions", () => {
    const added = discoveryPatients.filter(p => p.version === version);
    expect(added.map(p => p.caseId)).toEqual(["drchi-002", "drchi-003", "drchi-008"]);
    expect(discoveryPatients).toHaveLength(31);
    for (const patient of added) {
      expect(founderPreviewPackVersions.has(`${patient.caseId}@${patient.version}`)).toBe(true);
    }
    expect(founderPreviewPackVersions.size).toBe(7);
  });
});
