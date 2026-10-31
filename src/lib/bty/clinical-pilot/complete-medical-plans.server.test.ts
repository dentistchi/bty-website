import { describe, expect, it } from "vitest";
import type { DiscoveryPatient } from "@/domain/clinical-pilot/discovery";
import { buildCompleteReviewVariants, COMPLETE_REVIEW_VERSION } from "./case-review-builder.server";
import { medicalReviewPlans } from "./complete-medical-plans.server";
import { discoveryPatients } from "./discovery-cases.server";

const ids = ["drchi-004", "drchi-015", "drchi-016", "drchi-020", "drchi-021"];
const base = discoveryPatients.filter(p => ids.includes(p.caseId) && p.version === "discovery-2026-10-23.1");
const build = (patients: readonly DiscoveryPatient[] = base) => buildCompleteReviewVariants(patients, medicalReviewPlans);
const get = (number: number, id: string) => build().find(p => p.caseId === `drchi-${String(number).padStart(3, "0")}`)!
  .facts.find(f => f.id.endsWith(`:${id}`))!;
const freeze = <T,>(value: T): T => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

describe("fixed medical review-C patient plans", () => {
  it("constructs only five new copies and leaves the frozen source registry unchanged", () => {
    const input = freeze(structuredClone(discoveryPatients));
    const before = JSON.stringify(input);
    const registryBefore = JSON.stringify(discoveryPatients);
    const copies = build(input);
    expect(copies.map(p => p.caseId)).toEqual(ids);
    expect(copies.every(p => p.version === "discovery-2026-10-31.3-review-c")).toBe(true);
    expect(COMPLETE_REVIEW_VERSION).toBe("discovery-2026-10-31.3-review-c");
    expect(JSON.stringify(input)).toBe(before);
    expect(JSON.stringify(discoveryPatients)).toBe(registryBefore);
    expect(copies.map(p => p.facts.length)).toEqual([20, 20, 20, 20, 25]);
  });

  it("retains every available original fact exactly, including all source limitations", () => {
    for (const copy of build()) {
      const source = base.find(p => p.caseId === copy.caseId)!;
      expect(copy.chiefComplaint).toBe(source.chiefComplaint);
      for (const old of source.facts.filter(f => f.available !== false)) {
        expect(copy.facts.find(f => f.id === old.id)).toEqual(old);
      }
      expect(copy.facts.filter(f => source.facts.some(old => old.id === f.id)).map(f => f.id))
        .toEqual(source.facts.map(f => f.id));
    }
    expect(get(16, "anticoagulant").answer).toBe("I take apixaban 5 mg twice daily. This is my reported medication history.");
    expect(get(16, "extraction").answer).toContain("underlying indication is not further specified");
    expect(get(20, "tooth-status").answer).toContain("does not give the specific structural reason");
  });

  it("marks every new or replaced fact and validates unique IDs and regular expressions", () => {
    expect(medicalReviewPlans.map(p => p.replacements.length + p.additions.length)).toEqual([14, 13, 13, 12, 14]);
    for (const copy of build()) {
      const source = base.find(p => p.caseId === copy.caseId)!;
      expect(new Set(copy.facts.map(f => f.id)).size).toBe(copy.facts.length);
      for (const fact of copy.facts) {
        const old = source.facts.find(f => f.id === fact.id);
        if (!old || JSON.stringify(old) !== JSON.stringify(fact)) {
          expect(fact.provenance).toBe("fictional-extension-awaiting-review");
          if (old) expect(old.available).toBe(false);
        }
        for (const pattern of fact.patterns) expect(() => new RegExp(pattern, "iu")).not.toThrow();
      }
    }
  });

  it("keeps core conditions, current medicines, and allergies independently answerable", () => {
    for (const n of [4, 15, 16, 20, 21]) {
      const medical = get(n, n === 20 ? "medical" : "medical-history");
      const medicines = get(n, "medications");
      const allergies = get(n, "allergies");
      expect(new Set([medical.id, medicines.id, allergies.id]).size).toBe(3);
      expect(medical.channel).toBe("patient");
      expect(medicines.channel).toBe("patient");
      expect(allergies.channel).toBe("patient");
      expect(medical.answer).not.toMatch(/\b(?:mg|IU|allergies)\b/);
      expect(medicines.answer).not.toContain("allergies");
      expect(allergies.answer).not.toMatch(/\b(?:mg|hypertension|diabetes)\b/);
    }
  });

  it("preserves the eight-month improving asymptomatic case without inventing a recall decision", () => {
    expect(get(4, "rct-timing").answer).toBe("My root canal treatment was completed eight months ago.");
    expect(get(4, "symptoms").answer).toBe("I do not have symptoms now.");
    expect(get(4, "radiographic-comparison").answer).toBe("Comparable radiographs show the lesion decreasing from approximately 6 mm to 3 mm.");
    expect(get(4, "percussion").answer).toContain("not tender");
    expect(get(4, "bite-test").answer).toContain("does not reproduce pain");
    expect(get(4, "recall-plan").available).toBe(false);
    expect(get(4, "recall-plan").answer).toContain("No clinician-selected recall interval");
  });

  it("keeps the three-week tongue-ulcer history and unperformed tissue diagnosis despite fictional palpation", () => {
    expect(get(15, "duration").answer).toBe("The sore has been there for three weeks.");
    expect(get(15, "lesion").answer).toBe("There is an approximately 8 mm ulcer on the right lateral tongue.");
    expect(get(15, "adjacent-edge").answer).toContain("traumatic cause has not been established");
    expect(get(15, "recent-prosthesis").answer).toContain("#31 six weeks ago");
    expect(get(15, "induration").answer).toContain("new fictional review-C finding");
    expect(get(15, "nodes").answer).toContain("does not establish the cause");
    expect(get(15, "biopsy")).toEqual(base.find(p => p.caseId === "drchi-015")!.facts.find(f => f.id === "drchi-015:biopsy"));
    expect(get(15, "biopsy").available).toBe(false);
    expect(get(15, "risk-history").answer).not.toMatch(/alcohol|weight loss|fever/);
    expect(get(15, "alcohol").answer).not.toMatch(/cigarettes|weight loss|fever/);
  });

  it("separates renal history from dated laboratory measurements and unrecorded prescriber instructions", () => {
    expect(get(16, "renal-history").channel).toBe("patient");
    expect(get(16, "renal-history").answer).not.toMatch(/68|1\.0|2026/);
    for (const [id, result] of [["renal", "68 mL/min/1.73 m²"], ["creatinine", "1.0 mg/dL"],
      ["platelets", "224 × 10⁹/L"], ["hemoglobin", "13.8 g/dL"]]) {
      expect(get(16, id!).channel).toBe("exam");
      expect(get(16, id!).answer).toContain("2026-10-12");
      expect(get(16, id!).answer).toContain(result);
    }
    expect(get(16, "renal").answer).not.toMatch(/creatinine|platelets|hemoglobin/);
    expect(get(16, "creatinine").answer).not.toMatch(/eGFR|platelets|hemoglobin/);
    expect(get(16, "prescriber")).toEqual(base.find(p => p.caseId === "drchi-016")!.facts.find(f => f.id === "drchi-016:prescriber"));
    expect(get(16, "prescriber").available).toBe(false);
    expect(get(16, "last-dose").answer).toContain("have not changed the schedule");
    expect(get(16, "procedure-outcome").available).toBe(false);
  });

  it("preserves the Prolia indication and timeline while separating present findings from future decisions", () => {
    expect(get(20, "medication").answer).toBe("I receive Prolia for osteoporosis.");
    expect(get(20, "interval").answer).toBe("I receive an injection every six months.");
    expect(get(20, "duration").answer).toBe("Treatment began four years ago.");
    expect(get(20, "last-injection").answer).toBe("My last injection was two months ago.");
    expect(get(20, "surgical").answer).toContain("No exposed bone");
    expect(get(20, "surgical").answer).not.toContain("4 mm");
    expect(get(20, "cbct-apical").answer).toContain("4 mm periapical radiolucency");
    expect(get(20, "medication-plan").available).toBe(false);
    expect(get(20, "medication-plan").answer).toContain("No individualized prescriber advice");
    expect(get(20, "future-healing").available).toBe(false);
    expect(get(20, "future-healing").answer).toContain("No extraction or implant placement has occurred");
  });

  it("preserves the stable implant and progressive findings without manufacturing an outcome or removal rule", () => {
    expect(get(21, "stability").answer).toBe("The implant and crown are stable.");
    expect(get(21, "probing").answer).toBe("Probing depths are 7–8 mm, with bleeding and localized suppuration.");
    expect(get(21, "bone").answer).toBe("Comparable PAs show crestal bone loss increasing from approximately 1 mm to 4 mm over two years.");
    expect(get(21, "cement").answer).toContain("has not been removed");
    expect(get(21, "defect").answer).toContain("no surgical wall inspection");
    expect(get(21, "remaining-support-buccal").answer).toContain("4 mm");
    expect(get(21, "remaining-support-buccal").answer).not.toContain("lingual");
    expect(get(21, "remaining-support-lingual").answer).toContain("3 mm");
    expect(get(21, "remaining-support-lingual").answer).not.toContain("buccal");
    expect(get(21, "implant-position").answer).toContain("does not establish a removal indication");
    expect(get(21, "treatment-outcome").available).toBe(false);
  });

  it("retains exactly the explicitly identified unknowns", () => {
    expect(build().flatMap(p => p.facts.filter(f => f.available === false).map(f => f.id))).toEqual([
      "drchi-004:recall-plan", "drchi-015:biopsy", "drchi-016:prescriber", "drchi-016:procedure-outcome",
      "drchi-020:medication-plan", "drchi-020:future-healing", "drchi-021:treatment-outcome",
    ]);
  });

  it("returns independent copies of retained and newly designed data", () => {
    const first = build();
    const second = build();
    expect(first).toEqual(second);
    first[0]!.facts[0]!.patterns.push("test-only");
    first[0]!.facts[0]!.toothNumbers!.push(29);
    expect(second[0]!.facts[0]!.patterns).not.toContain("test-only");
    expect(second[0]!.facts[0]!.toothNumbers).toEqual([30]);
    expect(medicalReviewPlans[0]!.additions[0]!.toothNumbers).toEqual([30]);
    expect(base[0]!.facts[0]!.patterns).not.toContain("test-only");
  });
});
