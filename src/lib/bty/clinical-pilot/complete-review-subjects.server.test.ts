import { describe, expect, it } from "vitest";
import type { DiscoveryChannel, DiscoveryPatient } from "@/domain/clinical-pilot/discovery";
import { completeReviewFactMatchesClause, completeReviewFactTeeth, completeReviewHasSubject, completeReviewSubject, isCompleteReview } from "./complete-review-subjects.server";

// Frozen semantic requests, authored from fixed review-C fact design before
// running the metadata. Empty answers keep this suite independent of routing.
const version = "discovery-2026-10-31.3-review-c";
const caseSuffixes: Record<number, string[]> = {
  7: ["medical-history", "medications", "allergies", "diabetes", "a1c", "homecare", "interdental-care", "adherence-barriers", "willingness", "vitality", "previous-images"],
  9: ["medical-history", "medications", "allergies", "teeth", "occlusion", "palatal-clearance", "proportions", "proportions-7", "proportions-9", "proportions-10", "spacing-cause"],
  10: ["medical-history", "medications", "allergies", "brushing", "brush-type", "toothpaste", "brushing-pressure", "diet", "cold-test", "air-test", "cervical", "lesion-trajectory"],
  12: ["medical", "medications", "allergies", "third-molar", "other-third-molars", "cbct", "cbct-mesial-root", "cbct-distal-root", "third-1-position", "third-1-disease", "third-16-position", "third-16-disease", "third-17-position", "third-17-disease", "sedation-assessment"],
  13: ["medical-history", "medications", "allergies", "smile-gingiva", "gingival-levels", "phenotype", "endodontic-seal", "coronal-seal", "risk-cause", "occlusion", "coronal-structure"],
  14: ["medical", "medications", "allergies", "cbct", "stability", "palatal-bone", "facial-defect-dimensions", "primary-stability", "esthetic-healing", "same-day-feasibility"],
  16: ["medical-history", "medications", "allergies", "anticoagulant", "renal-history", "renal", "creatinine", "prescriber", "procedure-outcome"],
  17: ["medical-history", "medication", "additional-medications", "allergies", "salivary-flow", "stimulated-flow", "depth-22", "depth-27", "depth-28", "structure-22", "structure-27", "structure-28", "caries", "restorability", "future-full-arch"],
  18: ["medical-history", "medications", "allergies", "muscles", "temporalis", "scm", "neck", "shoulder", "opening", "joint", "dental", "habits", "sleep-habits", "sleep-testing", "joint-imaging"],
  19: ["medical-history", "medications", "allergies", "other-postoperative-medications", "steroid-use", "opioid-use", "acetaminophen-use", "socket", "socket-clot", "socket-exposed-bone", "socket-pus", "socket-soft-tissue", "irrigation-result", "adjacent", "adjacent-cold-31", "adjacent-percussion-31"],
  20: ["medical", "medications", "allergies", "medication", "surgical", "cbct-apical", "medication-plan", "future-healing"],
  21: ["medical-history", "medications", "allergies", "cement", "crown", "occlusion", "defect", "remaining-support-buccal", "remaining-support-lingual", "implant-position", "hygiene-access", "treatment-outcome"],
  22: ["health", "antiresorptive", "medications", "allergies", "cbct-dimensions", "sinus-image", "sinus-membrane", "sinus-septum", "membrane-perforation", "restorative-space", "mesiodistal-space", "stability", "adjacent-crowns", "adjacent-periodontal", "crown-2", "crown-4", "periodontal-2", "periodontal-4", "abutment-assessment", "abutment-4-margins", "opposing-30"],
  23: ["medical-history", "medications", "allergies", "adjacent-restoration", "adjacent-contour", "composite-29-margin", "crown-margins", "crown-30-contour", "crown-30-visible-fracture", "occlusal", "occlusal-29", "mobility", "mobility-29", "mobility-30", "bitewing", "bitewing-29", "bitewing-30", "marginal-ridge-levels", "corrective-plan"],
};
const patient = (n: number): DiscoveryPatient => ({ caseId: `drchi-${String(n).padStart(3, "0")}`, version, chiefComplaint: "",
  facts: (caseSuffixes[n] ?? ["medical-history", "medications", "allergies"]).map(id => ({ id: `drchi-${String(n).padStart(3, "0")}:${id}`, topic: id, channel: ["medical", "medical-history", "health", "medications", "medication", "additional-medications", "other-postoperative-medications", "steroid-use", "opioid-use", "acetaminophen-use", "antiresorptive", "allergies", "homecare", "interdental-care", "adherence-barriers", "willingness", "diabetes", "a1c", "brushing", "brush-type", "toothpaste", "brushing-pressure", "diet", "renal-history", "anticoagulant", "habits", "sleep-habits"].includes(id) ? "patient" : "exam", patterns: [], answer: "" })) });
type Probe = [number, string, string[]];
const probes: Probe[] = [
  [7, "What was your latest HbA1c?", ["a1c"]], [7, "Do you have diabetes?", ["diabetes"]],
  [7, "What makes daily brushing or flossing difficult, and are you willing to change?", ["homecare", "interdental-care", "adherence-barriers", "willingness"]],
  [7, "Test the presenting molar with cold only.", ["vitality"]],
  [9, "Measure only the clinical crown width and length of tooth #7.", ["proportions-7"]],
  [9, "Measure width-to-length ratios.", ["proportions", "proportions-7", "proportions-9", "proportions-10"]],
  [9, "Check the bite and clearance from the lower incisors.", ["occlusion"]],
  [9, "Is there room on the palatal side for a veneer?", ["palatal-clearance"]],
  [10, "Show me how you brush, including your brush and toothpaste.", ["brushing", "brush-type", "toothpaste"]],
  [10, "How hard do you press when brushing?", ["brushing-pressure"]],
  [10, "Apply an isolated air blast to the cervical area.", ["air-test"]],
  [12, "Measure the mesial root to canal distance at #32 only.", ["cbct-mesial-root"]],
  [12, "Measure distal root clearance at #32.", ["cbct-distal-root"]],
  [12, "Check tooth #16 for caries only.", ["third-16-disease"]],
  [12, "Is the upper left wisdom tooth erupted?", ["third-16-position"]],
  [13, "Assess only the smile line.", ["smile-gingiva"]],
  [13, "Compare gingival-margin heights.", ["gingival-levels"]],
  [13, "Check the gingival phenotype only.", ["phenotype"]],
  [13, "Check the root filling and coronal seal.", ["endodontic-seal", "coronal-seal"]],
  [14, "Measure only palatal bone thickness at #8.", ["palatal-bone"]],
  [14, "Evaluate apical and palatal anchorage and likely primary stability.", ["stability", "palatal-bone", "primary-stability"]],
  [14, "Is insertion torque available?", ["primary-stability"]],
  [14, "What is the final gingival healing outcome?", ["esthetic-healing"]],
  [16, "Check only serum creatinine.", ["creatinine"]],
  [16, "Check eGFR and creatinine results.", ["renal", "creatinine"]],
  [17, "Measure stimulated salivary flow only.", ["stimulated-flow"]],
  [17, "Measure unstimulated salivary flow only.", ["salivary-flow"]],
  [17, "Measure only accessible lesion depth at tooth #27.", ["depth-27"]],
  [17, "Inspect remaining structure at tooth #28.", ["structure-28"]],
  [17, "How deep are the lesions, and are these teeth restorable?", ["depth-22", "depth-27", "depth-28", "restorability"]],
  [18, "Palpate only the sternocleidomastoid muscles.", ["scm"]],
  [18, "Palpate only the temporalis.", ["temporalis"]],
  [18, "Palpate the masseter, temporalis, SCM, neck, and shoulders.", ["muscles", "temporalis", "scm", "neck", "shoulder"]],
  [18, "Palpate both TMJs.", ["joint"]],
  [18, "Do you clench while awake or grind in your sleep?", ["habits", "sleep-habits"]],
  [18, "Is an instrumented sleep study available?", ["sleep-testing"]],
  [19, "Inspect the socket only for pus.", ["socket-pus"]],
  [19, "Inspect and irrigate the socket for food, clot, exposed bone, or pus.", ["socket", "socket-clot", "socket-exposed-bone", "socket-pus", "irrigation-result"]],
  [19, "What was the pain response after socket irrigation?", ["irrigation-result"]],
  [20, "Show CBCT findings including exposed or necrotic bone.", ["surgical", "cbct-apical"]],
  [20, "Review only the apical CBCT finding.", ["cbct-apical"]],
  [20, "What prescriber medication-interruption plan is recorded?", ["medication-plan"]],
  [21, "Check only for residual cement.", ["cement"]],
  [21, "Review only the buccal bone support.", ["remaining-support-buccal"]],
  [21, "Review the lingual bone plate.", ["remaining-support-lingual"]],
  [21, "Evaluate remaining bony support and defect morphology.", ["defect", "remaining-support-buccal", "remaining-support-lingual"]],
  [21, "Inspect crown contours and check residual cement.", ["crown", "cement"]],
  [22, "What is the appearance of the sinus itself?", ["sinus-image"]],
  [22, "Measure residual ridge height and width on CBCT.", ["cbct-dimensions"]],
  [22, "Check only crown margins at tooth #4.", ["abutment-4-margins"]],
  [22, "Measure restorative clearance and mesiodistal space.", ["restorative-space", "mesiodistal-space"]],
  [23, "Inspect the distal contour and integrity of #29.", ["adjacent-contour", "composite-29-margin"]],
  [23, "Inspect only the margins of the #30 crown.", ["crown-margins"]],
  [23, "Check mobility only at #29.", ["mobility-29"]],
  [23, "Compare occlusal contacts and marginal ridges.", ["occlusal", "occlusal-29", "marginal-ridge-levels"]],
  [13, "How does #9 contact the lower teeth?", ["occlusion"]],
  [15, "What did palpation of the ulcer border show?", ["induration"]],
  [19, "Look inside the extraction socket only.", ["socket", "socket-clot", "socket-exposed-bone", "socket-pus"]],
  [20, "Look for exposed bone around #30.", ["surgical"]],
  [14, "From the scan, what apical anchorage is present, and have you already achieved primary stability?", ["stability", "primary-stability"]],
  [12, "Probe #16 for inflammation and pockets only.", ["third-16-periodontal"]],
  [19, "What medications and supplements do you take?", ["medications", "other-postoperative-medications", "steroid-use", "opioid-use", "acetaminophen-use"]],
  [19, "Have you taken a steroid since extraction?", ["steroid-use"]],
  [19, "Have you taken acetaminophen since extraction?", ["acetaminophen-use"]],
  [4, "Which tooth had the root canal?", ["location"]],
  [4, "What clinician-selected recall interval is documented?", ["recall-plan"]],
  [9, "Inspect the anterior teeth and document the spacing and rotation.", ["teeth"]],
  [15, "Was there any recent crown, implant crown, or partial denture treatment near that spot?", ["recent-prosthesis"]],
  [17, "Map the new caries lesions and their time course.", ["caries"]],
  [22, "Has a sinus membrane perforation actually occurred?", ["membrane-perforation"]],
  [23, "Pass floss through the #29-30 contact.", ["contact"]],
];

describe("review-C interpretation metadata", () => {
  it.each(probes)("case %i maps the fixed requested subject: %s", (n, q, expected) => {
    const result = completeReviewSubject(q, "exam", patient(n));
    expect(result?.suffixes.toSorted()).toEqual(expected.toSorted());
    expect(result).not.toHaveProperty("answer");
  });
  it.each([4, 7, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23])("case %i separates general histories in either mode", n => {
    const p = patient(n), condition = n === 22 ? "health" : [12, 14, 20].includes(n) ? "medical" : "medical-history";
    for (const channel of ["patient", "exam"] as DiscoveryChannel[]) {
      expect(completeReviewSubject("What medical conditions do you have?", channel, p)?.suffixes).toEqual([condition]);
      expect(completeReviewSubject("Do you have medication allergies?", channel, p)?.suffixes).toEqual(["allergies"]);
      expect(completeReviewSubject("What medical conditions and allergies do you have?", channel, p)?.suffixes.toSorted()).toEqual([condition, "allergies"].toSorted());
    }
  });
  it("retains the Case017 incomplete medication list and Case022 antiresorptive distinction", () => {
    expect(completeReviewSubject("Which medicines are you taking?", "exam", patient(17))?.suffixes).toEqual(["medication"]);
    expect(completeReviewSubject("What medications and supplements do you take?", "exam", patient(17))?.suffixes).toEqual(["medication", "additional-medications"]);
    expect(completeReviewSubject("What medications do you take?", "patient", patient(22))?.suffixes).toEqual(["antiresorptive", "medications"]);
  });
  it("keeps objective examinations out of patient mode and leaves all old versions untouched", () => {
    for (const [n, q] of probes.filter(([, q]) => /^(?:measure|palpate|apply|test|inspect|review|check only|evaluate)/iu.test(q))) {
      expect(completeReviewSubject(q, "patient", patient(n))?.channel).not.toBe("exam");
    }
    const old = { ...patient(18), version: "discovery-2026-10-23.1" };
    expect(isCompleteReview(old)).toBe(false);
    expect(completeReviewSubject("Palpate the SCM.", "exam", old)).toBeUndefined();
    expect(completeReviewFactMatchesClause("SCM", old, old.facts.find(f => f.id.endsWith(":muscles"))!)).toBe(true);
  });
  it("vetoes unrelated broad source facts in a narrow clause", () => {
    for (const [n, q, forbidden] of [[18, "Palpate the SCM only.", "muscles"], [17, "Measure stimulated salivary flow only.", "salivary-flow"], [17, "Depth at #27 only.", "caries"], [12, "Inspect #16 for caries.", "other-third-molars"], [21, "Check cement only.", "crown"], [22, "Sinus appearance only.", "cbct-dimensions"], [23, "Mobility at #29 only.", "mobility"]] as const) {
      const p = patient(n), f = p.facts.find(f => f.id.endsWith(`:${forbidden}`))!;
      expect(completeReviewFactMatchesClause(q, p, f)).toBe(false);
    }
  });
  it("supplies inherited tooth metadata without reading or modifying answer strings", () => {
    const p = patient(23), broad = p.facts.find(f => f.id.endsWith(":bitewing"))!;
    expect(completeReviewFactTeeth(p, broad)).toEqual([29, 30]);
    expect(completeReviewFactMatchesClause("Bitewing at #29 only.", p, broad)).toBe(false);
    expect(completeReviewHasSubject("Please examine only tooth #29.")).toBe(false);
    expect(completeReviewHasSubject("What else?")).toBe(false);
    expect(completeReviewHasSubject("Inspect residual cement.")).toBe(true);
  });
});
