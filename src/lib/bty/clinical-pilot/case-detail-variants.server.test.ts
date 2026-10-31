import { describe, expect, it } from "vitest";
import { discoveryPatients } from "./discovery-cases.server";
import { CASE_DETAIL_REVISED_SOURCE_FACTS, CASE_DETAIL_REVIEW_VERSION, caseDetailVariants } from "./case-detail-variants.server";

const base = discoveryPatients.filter(p => ["drchi-005", "drchi-006", "drchi-011"].includes(p.caseId));
const deepFreeze = <T,>(value: T): T => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

describe("new review-only clinical detail pack construction", () => {
  it("builds three independently versioned copies from deeply frozen source packs", () => {
    const input = deepFreeze(structuredClone(base));
    const before = JSON.stringify(input);
    const variants = caseDetailVariants(input);
    expect(variants.map(p => p.caseId)).toEqual(["drchi-005", "drchi-006", "drchi-011"]);
    expect(variants.every(p => p.version === CASE_DETAIL_REVIEW_VERSION)).toBe(true);
    expect(JSON.stringify(input)).toBe(before);
    expect(variants.every((p, index) => p !== input[index])).toBe(true);
  });

  it("preserves every supplied original fact except the explicit mixed-observation revision", () => {
    const variants = caseDetailVariants(base);
    const exceptions = new Set<string>(CASE_DETAIL_REVISED_SOURCE_FACTS.map(row => row.factId));
    expect([...exceptions]).toEqual(["drchi-011:crown"]);
    for (const source of base) {
      const copy = variants.find(p => p.caseId === source.caseId)!;
      expect(copy.chiefComplaint).toBe(source.chiefComplaint);
      for (const fact of source.facts.filter(f => f.available !== false && !exceptions.has(f.id))) {
        expect(copy.facts.find(f => f.id === fact.id)).toEqual(fact);
      }
    }
  });

  it("attributes every addition and changed fact to the fictional review extension", () => {
    for (const copy of caseDetailVariants(base)) {
      const source = base.find(p => p.caseId === copy.caseId)!;
      for (const fact of copy.facts) {
        const old = source.facts.find(f => f.id === fact.id);
        if (!old || JSON.stringify(fact) !== JSON.stringify(old)) expect(fact.provenance).toBe("fictional-extension-awaiting-review");
      }
      expect(copy.facts.every(f => f.id.startsWith(copy.caseId + ":"))).toBe(true);
      expect(new Set(copy.facts.map(f => f.id)).size).toBe(copy.facts.length);
      for (const fact of copy.facts) for (const pattern of fact.patterns) expect(() => new RegExp(pattern, "iu")).not.toThrow();
    }
    const controls = caseDetailVariants(base)[0]!.facts;
    for (const tooth of [29, 31]) for (const protocol of ["cold", "percussion"]) {
      const fact = controls.find(f => f.id === `drchi-005:adjacent-${protocol}-${tooth}`)!;
      expect(fact.toothNumbers).toEqual([tooth]);
      expect(fact.answer).not.toContain(`#${tooth === 29 ? 31 : 29}`);
      const matches = (question: string) => fact.patterns.some(pattern => new RegExp(pattern, "iu").test(question));
      expect(matches(`Perform ${protocol} testing on tooth #${tooth}.`)).toBe(true);
      expect(matches(`Perform ${protocol} testing on tooth #${tooth === 29 ? 31 : 29}.`)).toBe(false);
      expect(matches(`Check tooth #${tooth}.`)).toBe(false);
    }
  });

  it("does not share retained fact objects or pattern arrays with the old pack", () => {
    const input = structuredClone(base);
    const original = input[0]!.facts.find(f => f.id === "drchi-005:rct-history")!;
    const retained = caseDetailVariants(input)[0]!.facts.find(f => f.id === original.id)!;
    retained.patterns.push("synthetic-local-change");
    expect(original.patterns).not.toContain("synthetic-local-change");
    expect(retained).not.toBe(original);
  });

  it("retains explicit unknowns for unperformed or unverified investigations", () => {
    const unknown = caseDetailVariants(base).flatMap(p => p.facts).filter(f => f.available === false).map(f => f.id);
    expect(unknown).toEqual(expect.arrayContaining([
      "drchi-005:cr-assessment", "drchi-005:covered-fracture-extent",
      "drchi-006:crack-extent", "drchi-011:component-compatibility", "drchi-011:torque-specification",
    ]));
  });

  it("requires exactly one frozen base version per selected case", () => {
    expect(() => caseDetailVariants(base.slice(1))).toThrow("CASE_DETAIL_BASE_REQUIRED:drchi-005");
    expect(() => caseDetailVariants([...base, base[0]!])).toThrow("CASE_DETAIL_BASE_REQUIRED:drchi-005");
    expect(() => caseDetailVariants(base.map(p => ({ ...p, version: CASE_DETAIL_REVIEW_VERSION })))).toThrow("CASE_DETAIL_BASE_REQUIRED:drchi-005");
  });

  it("produces repeatable content rather than generating truth during a question", () => {
    expect(caseDetailVariants(base)).toEqual(caseDetailVariants(base));
  });
});
