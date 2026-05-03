import { describe, it, expect } from "vitest";
import { buildArchetypeFingerprint, FINGERPRINT_VERSION } from "./fingerprint";
import type { FingerprintInput } from "./fingerprint";

const BASE_INPUT: FingerprintInput = {
  axisVector: {
    ownership: 0.6,
    time: 0.55,
    authority: 0.7,
    truth: 0.65,
    repair: 0.5,
    conflict: 0.6,
    integrity: 0.7,
    visibility: 0.6,
    accountability: 0.65,
    courage: 0.55,
    control: 0.7,
    identity: 0.7,
  },
  patternFamilies: ["ownership_escape", "repair_avoidance"],
  scenariosCompleted: 10,
  contractsCompleted: 3,
};

describe("buildArchetypeFingerprint — determinism", () => {
  it("produces the same hash for the same input (×10)", async () => {
    const first = await buildArchetypeFingerprint(BASE_INPUT);
    for (let i = 0; i < 9; i++) {
      const r = await buildArchetypeFingerprint(BASE_INPUT);
      expect(r.inputHash).toBe(first.inputHash);
    }
  });

  it("produces different hashes for different axis vectors", async () => {
    const a = await buildArchetypeFingerprint(BASE_INPUT);
    const b = await buildArchetypeFingerprint({
      ...BASE_INPUT,
      axisVector: { ...BASE_INPUT.axisVector, truth: 0.3 },
    });
    expect(a.inputHash).not.toBe(b.inputHash);
  });

  it("is invariant to pattern family array order", async () => {
    const a = await buildArchetypeFingerprint({
      ...BASE_INPUT,
      patternFamilies: ["repair_avoidance", "ownership_escape"],
    });
    const b = await buildArchetypeFingerprint({
      ...BASE_INPUT,
      patternFamilies: ["ownership_escape", "repair_avoidance"],
    });
    expect(a.inputHash).toBe(b.inputHash);
  });

  it("is invariant to pattern family case", async () => {
    const a = await buildArchetypeFingerprint({
      ...BASE_INPUT,
      patternFamilies: ["Ownership_Escape"],
    });
    const b = await buildArchetypeFingerprint({
      ...BASE_INPUT,
      patternFamilies: ["ownership_escape"],
    });
    expect(a.inputHash).toBe(b.inputHash);
  });

  it("deduplicates repeated pattern families", async () => {
    const a = await buildArchetypeFingerprint({
      ...BASE_INPUT,
      patternFamilies: ["ownership_escape", "ownership_escape"],
    });
    const b = await buildArchetypeFingerprint({
      ...BASE_INPUT,
      patternFamilies: ["ownership_escape"],
    });
    expect(a.inputHash).toBe(b.inputHash);
  });

  it("truncates float precision to 2 decimal places", async () => {
    // 0.601 and 0.609 both truncate to 0.60 → same hash
    const a = await buildArchetypeFingerprint({
      ...BASE_INPUT,
      axisVector: { ...BASE_INPUT.axisVector, ownership: 0.601 },
    });
    const b = await buildArchetypeFingerprint({
      ...BASE_INPUT,
      axisVector: { ...BASE_INPUT.axisVector, ownership: 0.609 },
    });
    expect(a.inputHash).toBe(b.inputHash);
  });

  it("distinguishes values that differ at the truncated level", async () => {
    const a = await buildArchetypeFingerprint({
      ...BASE_INPUT,
      axisVector: { ...BASE_INPUT.axisVector, ownership: 0.60 },
    });
    const b = await buildArchetypeFingerprint({
      ...BASE_INPUT,
      axisVector: { ...BASE_INPUT.axisVector, ownership: 0.61 },
    });
    expect(a.inputHash).not.toBe(b.inputHash);
  });

  it("stamps the correct version", async () => {
    const r = await buildArchetypeFingerprint(BASE_INPUT);
    expect(r.version).toBe(FINGERPRINT_VERSION);
    expect(JSON.parse(r.canonicalForm).v).toBe(FINGERPRINT_VERSION);
  });
});
