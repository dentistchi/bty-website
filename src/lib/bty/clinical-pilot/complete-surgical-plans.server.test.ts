import { describe, expect, it } from "vitest";
import type { DiscoveryPatient } from "@/domain/clinical-pilot/discovery";
import { buildCompleteReviewVariants, COMPLETE_REVIEW_VERSION } from "./case-review-builder.server";
import { discoveryPatients } from "./discovery-cases.server";
import { surgicalReviewPlans } from "./complete-surgical-plans.server";

const ids = [12, 13, 14, 19, 22, 23].map(n => `drchi-${String(n).padStart(3, "0")}`);
const base = discoveryPatients.filter(p => ids.includes(p.caseId) && p.version === "discovery-2026-10-23.1");
const variants = () => buildCompleteReviewVariants(base, surgicalReviewPlans);
const fact = (patients: DiscoveryPatient[], n: number, suffix: string) => {
  const id = `drchi-${String(n).padStart(3, "0")}`;
  const entry = patients.find(p => p.caseId === id)?.facts.find(f => f.id === `${id}:${suffix}`);
  expect(entry, `${id}:${suffix}`).toBeDefined();
  return entry!;
};
const freeze = <T,>(value: T): T => {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

describe("review-C surgical and restorative fictional case plans", () => {
  it("builds the six selected versions without modifying frozen inputs or registering packs", () => {
    const input = freeze(structuredClone(base));
    const before = JSON.stringify(input);
    const registry = JSON.stringify(discoveryPatients);
    const copies = buildCompleteReviewVariants(input, surgicalReviewPlans);
    expect(copies.map(p => p.caseId)).toEqual(ids);
    expect(copies.every(p => p.version === "discovery-2026-10-31.3-review-c")).toBe(true);
    expect(COMPLETE_REVIEW_VERSION).toBe("discovery-2026-10-31.3-review-c");
    expect(JSON.stringify(input)).toBe(before);
    expect(JSON.stringify(discoveryPatients)).toBe(registry);
  });

  it("preserves every available source fact byte for byte, including embedded unknown statements", () => {
    for (const copy of variants()) {
      const original = base.find(p => p.caseId === copy.caseId)!;
      expect(copy.chiefComplaint).toBe(original.chiefComplaint);
      for (const old of original.facts.filter(f => f.available !== false)) {
        expect(JSON.stringify(copy.facts.find(f => f.id === old.id))).toBe(JSON.stringify(old));
      }
      for (const replacement of surgicalReviewPlans.find(p => p.caseId === copy.caseId)!.replacements) {
        expect(original.facts.find(f => f.id === replacement.id)?.available).toBe(false);
      }
    }
    expect(fact(variants(), 22, "antiresorptive").answer).toBe("There is no antiresorptive medication history. A complete list of unrelated medications is not supplied.");
    expect(fact(variants(), 12, "panoramic").answer).toContain("actual three-dimensional relationship is undetermined");
    expect(fact(variants(), 23, "bitewing").answer).toBe("The bitewing shows no obvious recurrent caries.");
    expect(fact(variants(), 23, "concern").answer).toContain("No fee responsibility or warranty arrangement is specified.");
  });

  it("marks all 110 additions and replacements as fictional and validates every unique fact pattern", () => {
    const copies = variants();
    expect(copies.map(p => p.facts.filter(f => f.provenance === "fictional-extension-awaiting-review").length)).toEqual([17, 19, 16, 20, 21, 17]);
    for (const copy of copies) {
      const original = base.find(p => p.caseId === copy.caseId)!;
      expect(new Set(copy.facts.map(f => f.id)).size).toBe(copy.facts.length);
      for (const entry of copy.facts) {
        const old = original.facts.find(f => f.id === entry.id);
        if (JSON.stringify(old) !== JSON.stringify(entry)) expect(entry.provenance).toBe("fictional-extension-awaiting-review");
        expect(entry.id.startsWith(`${copy.caseId}:`)).toBe(true);
        for (const pattern of entry.patterns) expect(() => new RegExp(pattern, "iu")).not.toThrow();
      }
    }
  });

  it("copies source and review tooth metadata without sharing mutable arrays", () => {
    const input = structuredClone(base);
    const old = input.find(p => p.caseId === "drchi-023")!.facts.find(f => f.id === "drchi-023:contact")!;
    const copies = buildCompleteReviewVariants(input, surgicalReviewPlans);
    const sourceCopy = fact(copies, 23, "contact");
    expect(sourceCopy).toEqual(old);
    expect(sourceCopy).not.toBe(old);
    sourceCopy.patterns.push("only-local-copy");
    sourceCopy.toothNumbers!.push(1);
    expect(old.patterns).not.toContain("only-local-copy");
    expect(old.toothNumbers).toEqual([29, 30]);
    const newCopy = fact(copies, 12, "cbct");
    newCopy.toothNumbers!.push(1);
    expect(surgicalReviewPlans[0]!.replacements[0]!.toothNumbers).toEqual([32]);
  });

  it("keeps root-specific CBCT measurements and each other third molar separate", () => {
    const copies = variants();
    expect(fact(copies, 12, "cbct").answer).toContain("courses lingual");
    for (const [root, measurement, other] of [["mesial", "1.4 mm", "distal"], ["distal", "0.8 mm", "mesial"]]) {
      const entry = fact(copies, 12, `cbct-${root}-root`);
      expect(entry.toothNumbers).toEqual([32]);
      expect(entry.answer).toContain(measurement);
      expect(entry.answer).not.toContain(other);
      expect(entry.answer).toContain("not a surgical nerve-injury prediction");
    }
    for (const tooth of [1, 16, 17]) for (const suffix of ["position", "disease"]) {
      const entry = fact(copies, 12, `third-${tooth}-${suffix}`);
      expect(entry.toothNumbers).toEqual([tooth]);
      expect(entry.answer.match(/#\d+/g)).toEqual([`#${tooth}`]);
    }
    expect(fact(copies, 12, "third-16-disease").answer).toContain("cavitated occlusal lesion");
    expect(fact(copies, 12, "third-1-disease").answer).toContain("No cavitated caries");
  });

  it("records anxiety without establishing sedation suitability", () => {
    const copies = variants();
    expect(fact(copies, 12, "medical").answer).not.toMatch(/anxi|sedation/);
    expect(fact(copies, 12, "anxiety").answer).toContain("very anxious");
    expect(fact(copies, 12, "anxiety").answer).not.toContain("eligible");
    expect(fact(copies, 12, "sedation-assessment").available).toBe(false);
    expect(fact(copies, 12, "sedation-assessment").answer).toContain("does not establish sedation eligibility");
  });

  it("separates #9 root filling, coronal seal, smile, gingival levels, diet and fluoride", () => {
    const copies = variants();
    expect(fact(copies, 13, "endodontic-seal").answer).toContain("1 mm short");
    expect(fact(copies, 13, "endodontic-seal").answer).not.toContain("composite");
    expect(fact(copies, 13, "coronal-seal").answer).toContain("palatal-composite margins");
    expect(fact(copies, 13, "coronal-seal").answer).not.toContain("root filling");
    expect(fact(copies, 13, "smile-gingiva").answer).toContain("1 mm of gingival display");
    expect(fact(copies, 13, "smile-gingiva").answer).not.toContain("0.5 mm");
    expect(fact(copies, 13, "gingival-levels").answer).toContain("0.5 mm");
    expect(fact(copies, 13, "diet").answer).not.toContain("fluoride");
    expect(fact(copies, 13, "fluoride").answer).not.toContain("biscuits");
    expect(fact(copies, 13, "esthetic-scope").answer).toContain("options focused on this tooth");
    expect(fact(copies, 13, "discoloration-cause").available).toBe(false);
    expect(fact(copies, 13, "definitive-esthetic-plan").available).toBe(false);
  });

  it("distinguishes #8 measured preoperative geometry from future stability and healing", () => {
    const copies = variants();
    expect(fact(copies, 14, "stability").answer).toContain("5 mm of bone apical");
    expect(fact(copies, 14, "stability").answer).not.toContain("4 mm");
    expect(fact(copies, 14, "palatal-bone").answer).toContain("4 mm of palatal bone");
    expect(fact(copies, 14, "facial-defect-dimensions").answer).toContain("5 mm apicocoronally and 4 mm mesiodistally");
    expect(fact(copies, 14, "primary-stability").available).toBe(false);
    expect(fact(copies, 14, "primary-stability").answer).toContain("No implant has been placed");
    expect(fact(copies, 14, "esthetic-healing").available).toBe(false);
    expect(fact(copies, 14, "same-day-feasibility").available).toBe(false);
    expect(fact(copies, 14, "interim-preference").answer).toContain("have not chosen an interim option");
  });

  it("keeps each socket observation separate from irrigation outcome and antibiotic decisions", () => {
    const copies = variants();
    expect(fact(copies, 19, "socket").answer).toContain("food debris");
    expect(fact(copies, 19, "socket").answer).not.toMatch(/clot|exposed|pus/);
    expect(fact(copies, 19, "socket-clot").answer).toContain("clot remnant");
    expect(fact(copies, 19, "socket-clot").answer).not.toMatch(/debris|pus/);
    expect(fact(copies, 19, "socket-exposed-bone").answer).toContain("visibly exposed");
    expect(fact(copies, 19, "socket-exposed-bone").answer).not.toMatch(/clot|debris|pus/);
    expect(fact(copies, 19, "socket-pus").answer).toContain("No pus");
    expect(fact(copies, 19, "socket-pus").answer).not.toMatch(/clot|debris|exposed/);
    expect(fact(copies, 19, "irrigation-result").available).toBe(false);
    expect(fact(copies, 19, "irrigation-result").answer).toContain("not yet been irrigated");
    expect(fact(copies, 19, "medications").answer).toContain("taken ibuprofen");
    expect(fact(copies, 19, "medications").answer).not.toMatch(/should|recommend|prescribe/);
    expect(fact(copies, 19, "other-postoperative-medications").answer).toContain("have not taken an antibiotic");
    expect(fact(copies, 19, "other-postoperative-medications").answer).not.toMatch(/steroid|opioid|acetaminophen/);
    expect(fact(copies, 19, "steroid-use").answer).not.toMatch(/antibiotic|opioid|acetaminophen/);
    expect(fact(copies, 19, "opioid-use").answer).not.toMatch(/antibiotic|steroid|acetaminophen/);
    for (const suffix of ["adjacent", "adjacent-cold-31", "adjacent-percussion-31"]) {
      expect(fact(copies, 19, suffix).toothNumbers).toEqual([31]);
      expect(fact(copies, 19, suffix).answer).not.toContain("#32");
    }
  });

  it("preserves the 6–7 mm ridge observation while keeping future sinus surgery unknown", () => {
    const copies = variants();
    expect(fact(copies, 22, "cbct-dimensions").answer).toContain("6–7 mm");
    expect(fact(copies, 22, "restorative-space").answer).toContain("7 mm in habitual closure");
    expect(fact(copies, 22, "opposing-30").toothNumbers).toEqual([30]);
    expect(fact(copies, 22, "sinus-membrane").answer).toContain("1.5 mm thick");
    expect(fact(copies, 22, "membrane-perforation").available).toBe(false);
    expect(fact(copies, 22, "stability").available).toBe(false);
    expect(fact(copies, 22, "medications").available).toBe(false);
    for (const tooth of [2, 4]) {
      for (const suffix of [`crown-${tooth}`, `periodontal-${tooth}`, `mobility-${tooth}`, `covered-structure-${tooth}`]) {
        const entry = fact(copies, 22, suffix);
        expect(entry.toothNumbers).toEqual([tooth]);
        expect(entry.answer.match(/#\d+/g)).toEqual([`#${tooth}`]);
      }
      expect(fact(copies, 22, `covered-structure-${tooth}`).available).toBe(false);
      expect(fact(copies, 22, `periodontal-${tooth}`).answer).not.toContain("mobility");
      expect(fact(copies, 22, `mobility-${tooth}`).answer).not.toContain("probing");
    }
  });

  it("separates #29 and #30 contours and source projections without choosing a remake", () => {
    const copies = variants();
    expect(fact(copies, 23, "adjacent-contour").toothNumbers).toEqual([29]);
    expect(fact(copies, 23, "adjacent-contour").answer).not.toContain("#30");
    expect(fact(copies, 23, "crown-30-contour").toothNumbers).toEqual([30]);
    expect(fact(copies, 23, "crown-30-contour").answer).not.toContain("#29");
    expect(fact(copies, 23, "marginal-ridge-levels").answer).toContain("1 mm apical");
    for (const tooth of [29, 30]) for (const suffix of [`mobility-${tooth}`, `bitewing-${tooth}`]) {
      const entry = fact(copies, 23, suffix);
      expect(entry.toothNumbers).toEqual([tooth]);
      expect(entry.answer.match(/#\d+/g)).toEqual([`#${tooth}`]);
    }
    expect(fact(copies, 23, "corrective-plan").available).toBe(false);
    expect(fact(copies, 23, "corrective-plan").answer).toContain("No corrective procedure or fee responsibility has been agreed");
  });
});
