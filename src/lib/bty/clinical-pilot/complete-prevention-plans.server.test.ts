import { describe, expect, it } from "vitest";
import { discoveryPatients } from "./discovery-cases.server";
import { buildCompleteReviewVariants, COMPLETE_REVIEW_VERSION } from "./case-review-builder.server";
import { preventionReviewPlans } from "./complete-prevention-plans.server";

const selectedIds = ["drchi-007", "drchi-009", "drchi-010", "drchi-017", "drchi-018"];
const base = discoveryPatients.filter(p => selectedIds.includes(p.caseId) && p.version === "discovery-2026-10-23.1");
const build = () => buildCompleteReviewVariants(base, preventionReviewPlans);
const find = (caseId: string, id: string) => build().find(p => p.caseId === caseId)!.facts.find(f => f.id === `${caseId}:${id}`)!;
const deepFreeze = <T,>(value: T): T => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

describe("complete fictional prevention review plans", () => {
  it("creates the five requested versions without mutating source packs or registering them", () => {
    const frozen = deepFreeze(structuredClone(discoveryPatients));
    const before = JSON.stringify(frozen);
    const registryBefore = JSON.stringify(discoveryPatients);
    const variants = buildCompleteReviewVariants(frozen, preventionReviewPlans);
    expect(variants.map(p => p.caseId)).toEqual(selectedIds);
    expect(variants.every(p => p.version === COMPLETE_REVIEW_VERSION)).toBe(true);
    expect(COMPLETE_REVIEW_VERSION).toBe("discovery-2026-10-31.3-review-c");
    expect(JSON.stringify(frozen)).toBe(before);
    expect(JSON.stringify(discoveryPatients)).toBe(registryBefore);
    expect(variants).toEqual(build());
  });

  it("preserves every available original fact exactly, including embedded source limitations", () => {
    for (const copy of build()) {
      const original = base.find(p => p.caseId === copy.caseId)!;
      expect(copy.chiefComplaint).toBe(original.chiefComplaint);
      for (const source of original.facts.filter(f => f.available !== false)) {
        const retained = copy.facts.find(f => f.id === source.id)!;
        expect(retained).toEqual(source);
        expect(retained).not.toBe(source);
        expect(retained.patterns).not.toBe(source.patterns);
      }
    }
    expect(find("drchi-007", "local-probing").answer).toContain("Full periodontal charting has not been reviewed.");
    expect(find("drchi-017", "medication").answer).toContain("The rest of my medication history has not been supplied.");
    expect(find("drchi-009", "timing").answer).toContain("I have not stated that I refuse orthodontic treatment.");
  });

  it("limits replacements to unavailable source facts and labels all 100 designed entries", () => {
    expect(preventionReviewPlans.map(p => p.replacements.length + p.additions.length)).toEqual([20, 20, 20, 20, 20]);
    for (const plan of preventionReviewPlans) {
      const source = base.find(p => p.caseId === plan.caseId)!;
      expect(plan.replacements.map(f => f.id).sort()).toEqual(source.facts.filter(f => f.available === false).map(f => f.id).sort());
      for (const entry of [...plan.replacements, ...plan.additions]) {
        expect(entry.provenance).toBe("fictional-extension-awaiting-review");
        for (const pattern of entry.patterns) expect(() => new RegExp(pattern, "iu")).not.toThrow();
      }
    }
    for (const patient of build()) {
      expect(new Set(patient.facts.map(f => f.id)).size).toBe(patient.facts.length);
      expect(patient.facts.filter(f => f.provenance === "fictional-extension-awaiting-review")).toHaveLength(20);
    }
  });

  it("keeps diabetes, glycemic control, home-care barriers and willingness independently answerable", () => {
    const matches = (id: string, question: string) => find("drchi-007", id).patterns.some(p => new RegExp(p, "iu").test(question));
    expect(matches("diabetes", "Do you have diabetes?")).toBe(true);
    expect(matches("a1c", "What was your latest A1c?")).toBe(true);
    expect(matches("diabetes", "What was your latest A1c?")).toBe(false);
    expect(matches("a1c", "Do you have diabetes?")).toBe(false);
    expect(find("drchi-007", "homecare").answer).not.toMatch(/metformin|8\.2|willing|cigarette/i);
    expect(find("drchi-007", "adherence-barriers").answer).toContain("Late work shifts");
    expect(find("drchi-007", "willingness").answer).toContain("have not yet changed");
  });

  it("separates each anterior dimension and each root-lesion finding by tooth", () => {
    for (const [tooth, id] of [[7, "proportions-7"], [8, "proportions"], [9, "proportions-9"], [10, "proportions-10"]] as const) {
      const entry = find("drchi-009", id);
      expect(entry.toothNumbers).toEqual([tooth]);
      expect(entry.answer.match(/#\d+/g)).toEqual([`#${tooth}`]);
    }
    for (const tooth of [22, 27, 28]) {
      for (const prefix of ["depth", "structure"]) {
        const entry = find("drchi-017", `${prefix}-${tooth}`);
        expect(entry.toothNumbers).toEqual([tooth]);
        expect(entry.answer.match(/#\d+/g)).toEqual([`#${tooth}`]);
      }
      expect(find("drchi-017", `depth-${tooth}`).answer).not.toMatch(/extract|all.on|crown and|both cusps/i);
      expect(find("drchi-017", `structure-${tooth}`).answer).not.toMatch(/\b(?:1|1\.5) mm deep\b|restorable|extract|all.on/i);
    }
  });

  it("keeps brush, paste, pressure and acid exposure separate from objective tests", () => {
    expect(find("drchi-010", "brushing").answer).not.toMatch(/1450|medium|energy drink|cold stimulus/i);
    expect(find("drchi-010", "brush-type").answer).toContain("medium-bristle manual");
    expect(find("drchi-010", "toothpaste").answer).toContain("1450 ppm");
    expect(find("drchi-010", "brushing-pressure").answer).toContain("bristles bend");
    expect(find("drchi-010", "diet").channel).toBe("patient");
    expect(find("drchi-010", "erosive-surface").channel).toBe("exam");
    expect(find("drchi-010", "erosive-surface").answer).toContain("does not establish a cause");
    expect(find("drchi-010", "cold-test").answer).toContain("No electric pulp test was performed");
  });

  it("keeps individual muscles distinct and does not infer a sleep diagnosis from palpation", () => {
    for (const [id, muscle] of [["muscles", "masseter"], ["temporalis", "temporalis"], ["scm", "sternocleidomastoid"], ["neck", "cervical"], ["shoulder", "trapezius"]]) {
      const answer = find("drchi-018", id!).answer;
      expect(answer.toLowerCase()).toContain(muscle!);
      expect(answer).not.toMatch(/(?:has|confirms|diagnosed|indicates) sleep bruxism|night guard|stretching program/i);
    }
    expect(find("drchi-018", "habits").answer).toContain("during the day");
    expect(find("drchi-018", "sleep-habits").answer).toContain("do not know");
    expect(find("drchi-018", "sleep-testing").available).toBe(false);
    expect(find("drchi-018", "joint").answer).toContain("does not reproduce");
  });

  it("retains unperformed and future-dependent information as unavailable", () => {
    expect(build().flatMap(p => p.facts).filter(f => f.available === false).map(f => f.id)).toEqual([
      "drchi-007:previous-images", "drchi-007:full-chart",
      "drchi-009:spacing-cause", "drchi-010:lesion-trajectory",
      "drchi-017:restorability", "drchi-017:additional-medications", "drchi-017:future-full-arch",
      "drchi-018:sleep-testing", "drchi-018:joint-imaging",
    ]);
    expect(find("drchi-009", "palatal-clearance").answer).toContain("future clearance are undetermined");
    expect(find("drchi-017", "salivary-flow").answer).toContain("does not establish its cause");
    expect(find("drchi-017", "future-full-arch").answer).toContain("No tooth has fractured");
  });

  it("separates conditions, medicines and allergies without generic discovery triggers", () => {
    for (const caseId of selectedIds) {
      const ids = caseId === "drchi-017" ? ["medical-history", "additional-medications", "allergies"] : ["medical-history", "medications", "allergies"];
      for (const id of ids) {
        const entry = find(caseId, id);
        expect(entry.channel).toBe("patient");
        for (const generic of ["When?", "Inspect.", "Visual.", "Look at it."]) {
          expect(entry.patterns.some(p => new RegExp(p, "iu").test(generic))).toBe(false);
        }
      }
      expect(find(caseId, "medical-history").patterns.some(p => new RegExp(p, "iu").test("What medications do you take?"))).toBe(false);
      expect(find(caseId, "allergies").patterns.some(p => new RegExp(p, "iu").test("What medical conditions do you have?"))).toBe(false);
    }
  });
});
