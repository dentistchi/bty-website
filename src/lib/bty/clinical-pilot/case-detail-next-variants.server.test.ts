import { describe, expect, it } from "vitest";
import type { DiscoveryPatient } from "@/domain/clinical-pilot/discovery";
import { discoveryPatients } from "./discovery-cases.server";
import { CASE_DETAIL_NEXT_REVIEW_VERSION, caseDetailNextVariants } from "./case-detail-next-variants.server";

const BASE_VERSION = "discovery-2026-10-23.1";
const selectedIds = ["drchi-002", "drchi-003", "drchi-008"];
const base = discoveryPatients.filter(p => selectedIds.includes(p.caseId) && p.version === BASE_VERSION);
const deepFreeze = <T,>(value: T): T => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};
const find = (patients: DiscoveryPatient[], caseId: string, id: string) => patients
  .find(p => p.caseId === caseId)!.facts.find(f => f.id === `${caseId}:${id}`)!;

describe("next fictional clinical review pack construction", () => {
  it("constructs only the three requested versions without mutating frozen inputs or the registry", () => {
    const input = deepFreeze(structuredClone(discoveryPatients));
    const before = JSON.stringify(input);
    const registryBefore = JSON.stringify(discoveryPatients);
    const variants = caseDetailNextVariants(input);
    expect(variants.map(p => p.caseId)).toEqual(selectedIds);
    expect(variants.every(p => p.version === "discovery-2026-10-31.2-review-b")).toBe(true);
    expect(CASE_DETAIL_NEXT_REVIEW_VERSION).toBe("discovery-2026-10-31.2-review-b");
    expect(JSON.stringify(input)).toBe(before);
    expect(JSON.stringify(discoveryPatients)).toBe(registryBefore);
    for (const copy of variants) expect(input).not.toContain(copy);
  });

  it("preserves every available original statement, topic, channel, pattern, and availability", () => {
    for (const copy of caseDetailNextVariants(base)) {
      const source = base.find(p => p.caseId === copy.caseId)!;
      expect(copy.chiefComplaint).toBe(source.chiefComplaint);
      expect(copy.facts.filter(f => source.facts.some(old => old.id === f.id)).map(f => f.id))
        .toEqual(source.facts.map(f => f.id));
      for (const old of source.facts.filter(f => f.available !== false)) {
        expect(copy.facts.find(f => f.id === old.id)).toEqual(old);
      }
    }
    const variants = caseDetailNextVariants(base);
    expect(find(variants, "drchi-002", "restoration").answer).toBe("Deep recurrent caries is present beneath a large restoration.");
    expect(find(variants, "drchi-002", "radiograph").answer).toBe("Radiographically, the recurrent caries approaches the pulp.");
    expect(find(variants, "drchi-002", "margin").answer).toBe("The distal restorative margin is subgingival.");
    expect(find(variants, "drchi-008", "duration").answer).toBe("A lower first molar has been missing for five years.");
  });

  it("marks every addition and replacement and builds valid uniquely identified facts", () => {
    const variants = caseDetailNextVariants(base);
    expect(variants.map(p => p.facts.filter(f => f.provenance === "fictional-extension-awaiting-review").length))
      .toEqual([21, 29, 27]);
    for (const copy of variants) {
      const source = base.find(p => p.caseId === copy.caseId)!;
      for (const entry of copy.facts) {
        const old = source.facts.find(f => f.id === entry.id);
        if (!old || JSON.stringify(entry) !== JSON.stringify(old)) {
          expect(entry.provenance).toBe("fictional-extension-awaiting-review");
        }
        expect(entry.id.startsWith(`${copy.caseId}:`)).toBe(true);
        for (const pattern of entry.patterns) expect(() => new RegExp(pattern, "iu")).not.toThrow();
      }
      expect(new Set(copy.facts.map(f => f.id)).size).toBe(copy.facts.length);
    }
  });

  it("copies retained fact objects, pattern arrays, and optional tooth metadata", () => {
    const input = structuredClone(base);
    const old = input[0]!.facts.find(f => f.id === "drchi-002:cold")!;
    old.toothNumbers = [30];
    const copy = find(caseDetailNextVariants(input), "drchi-002", "cold");
    expect(copy).toEqual(old);
    expect(copy).not.toBe(old);
    copy.patterns.push("local-test-only");
    copy.toothNumbers!.push(29);
    expect(old.patterns).not.toContain("local-test-only");
    expect(old.toothNumbers).toEqual([30]);
  });

  it("keeps pre-excavation structure, bone relationship, ferrule, isolation, and sensibility distinct", () => {
    const variants = caseDetailNextVariants(base);
    expect(find(variants, "drchi-002", "lesion-to-bone").answer).toMatch(/2\.5 mm coronal.*deepest boundary.*not yet visible/);
    expect(find(variants, "drchi-002", "ferrule").answer).toContain("complete circumferential ferrule is not established");
    expect(find(variants, "drchi-002", "isolation").answer).toContain("pre-excavation");
    expect(find(variants, "drchi-002", "pulp-testing").answer).toContain("two seconds");
    expect(find(variants, "drchi-002", "ept").answer).toContain("electric pulp testing");
    expect(find(variants, "drchi-002", "pulp-testing").answer).not.toContain("electric");
    expect(find(variants, "drchi-002", "ept").answer).not.toContain("cold");
    expect(find(variants, "drchi-002", "apical-imaging").answer).toContain("does not determine whether endodontic treatment will be needed");
  });

  it("establishes missing #30 identity before conditional #31 and #3 position findings", () => {
    const copy = caseDetailNextVariants(base).find(p => p.caseId === "drchi-008")!;
    expect(copy.facts[0]!.id).toBe("drchi-008:location");
    expect(copy.facts[0]!.answer).toContain("For this fictional review version");
    expect(copy.facts[0]!.toothNumbers).toEqual([30]);
    expect(find([copy], "drchi-008", "movement").toothNumbers).toEqual([31]);
    expect(find([copy], "drchi-008", "opposing").toothNumbers).toEqual([3]);
    expect(find([copy], "drchi-008", "bone").answer).not.toContain("11.2");
    expect(find([copy], "drchi-008", "ian-dimensions").answer).toContain("11.2 mm");
    expect(find([copy], "drchi-008", "medical").answer).not.toContain("amlodipine");
    expect(find([copy], "drchi-008", "medications").answer).toContain("amlodipine 5 mg");
    expect(find([copy], "drchi-008", "allergies").answer).toContain("allergies");
  });

  it("provides fixed single-tooth and single-root projections without disclosing paired measurements", () => {
    const variants = caseDetailNextVariants(base);
    for (const tooth of [29, 31]) {
      const other = tooth === 29 ? 31 : 29;
      for (const id of [`adjacent-${tooth}`, `adjacent-cold-${tooth}`, `adjacent-percussion-${tooth}`]) {
        const entry = find(variants, "drchi-003", id);
        expect(entry.toothNumbers).toEqual([tooth]);
        expect(entry.answer).toContain(`#${tooth}`);
        expect(entry.answer).not.toContain(`#${other}`);
      }
      for (const id of [`adjacent-${tooth}`, `adjacent-probing-${tooth}`, `adjacent-mobility-${tooth}`]) {
        const entry = find(variants, "drchi-008", id);
        expect(entry.toothNumbers).toEqual([tooth]);
        expect(entry.answer).toContain(`#${tooth}`);
        expect(entry.answer).not.toContain(`#${other}`);
      }
    }
    for (const root of ["mesial", "distal"]) {
      const other = root === "mesial" ? "distal" : "mesial";
      expect(find(variants, "drchi-003", `probing-${root}`).answer).not.toContain(other);
      expect(find(variants, "drchi-003", `root-filling-quality-${root}`).answer).not.toContain(other);
    }
  });

  it("retains genuine unknowns for excavation, fracture, retreatment, future stability, and final planning", () => {
    const variants = caseDetailNextVariants(base);
    expect(variants.flatMap(p => p.facts).filter(f => f.available === false).map(f => f.id)).toEqual([
      "drchi-002:post-excavation", "drchi-003:fracture", "drchi-003:retreatment-feasibility",
      "drchi-008:primary-stability", "drchi-008:final-plan",
    ]);
    expect(find(variants, "drchi-003", "fracture").answer).toContain("do not exclude a fracture");
    expect(find(variants, "drchi-003", "retreatment-feasibility").answer).toContain("has not been completed");
    expect(find(variants, "drchi-008", "primary-stability").answer).toContain("No implant has been placed");
  });

  it("requires one exact original version for each selected case", () => {
    expect(() => caseDetailNextVariants(base.slice(1))).toThrow("CASE_DETAIL_NEXT_BASE_REQUIRED:drchi-002");
    expect(() => caseDetailNextVariants([...base, base[0]!])).toThrow("CASE_DETAIL_NEXT_BASE_REQUIRED:drchi-002");
    expect(() => caseDetailNextVariants(base.map(p => ({ ...p, version: CASE_DETAIL_NEXT_REVIEW_VERSION }))))
      .toThrow("CASE_DETAIL_NEXT_BASE_REQUIRED:drchi-002");
    expect(caseDetailNextVariants([...base, ...caseDetailNextVariants(base)])).toEqual(caseDetailNextVariants(base));
  });

  it("rejects attempts to replace an available observation or accept duplicate source fact IDs", () => {
    const available = structuredClone(base);
    available[0]!.facts.find(f => f.id === "drchi-002:isolation")!.available = true;
    expect(() => caseDetailNextVariants(available)).toThrow("CASE_DETAIL_NEXT_REPLACEMENT_NOT_ALLOWED:drchi-002:isolation");
    const missing = structuredClone(base);
    missing[0]!.facts = missing[0]!.facts.filter(f => f.id !== "drchi-002:isolation");
    expect(() => caseDetailNextVariants(missing)).toThrow("CASE_DETAIL_NEXT_REPLACEMENT_NOT_ALLOWED:drchi-002:isolation");
    const duplicate = structuredClone(base);
    duplicate[0]!.facts.push(structuredClone(duplicate[0]!.facts[0]!));
    expect(() => caseDetailNextVariants(duplicate)).toThrow("CASE_DETAIL_NEXT_DUPLICATE_SOURCE:drchi-002");
  });

  it("constructs identical independent data on repeated calls", () => {
    const first = caseDetailNextVariants(base);
    const second = caseDetailNextVariants(base);
    expect(first).toEqual(second);
    first[0]!.facts[0]!.patterns.push("local-test-only");
    expect(second[0]!.facts[0]!.patterns).not.toContain("local-test-only");
  });
});
