import type { DiscoveryFact, DiscoveryPatient } from "@/domain/clinical-pilot/discovery";

export const COMPLETE_REVIEW_VERSION = "discovery-2026-10-31.3-review-c";
const BASE_VERSION = "discovery-2026-10-23.1";
export type ReviewFact = DiscoveryFact & { provenance: "fictional-extension-awaiting-review" };
export type ReviewPlan = { caseId: string; replacements: ReviewFact[]; additions: ReviewFact[] };

export function reviewFact(number: number, id: string, channel: "patient" | "exam", topic: string,
  pattern: string | readonly string[], answer: string, available = true, teeth?: number[]): ReviewFact {
  return { id: `drchi-${String(number).padStart(3, "0")}:${id}`, channel, topic,
    patterns: typeof pattern === "string" ? [pattern] : [...pattern], answer, available,
    provenance: "fictional-extension-awaiting-review", ...(teeth ? { toothNumbers: [...teeth] } : {}) };
}

/** Copy only explicitly designed fictional details. Available source facts are
 * immutable; an unperformed assessment can remain unavailable in the new copy.
 * No registration, user selection, treatment decision or persistence occurs here. */
export function buildCompleteReviewVariants(basePatients: readonly DiscoveryPatient[], plans: readonly ReviewPlan[]): DiscoveryPatient[] {
  const seen = new Set<string>();
  const clone = (fact: DiscoveryFact): DiscoveryFact => ({ ...fact, patterns: [...fact.patterns],
    ...(fact.toothNumbers ? { toothNumbers: [...fact.toothNumbers] } : {}) });
  return plans.map(plan => {
    if (seen.has(plan.caseId)) throw Error(`REVIEW_DUPLICATE_CASE:${plan.caseId}`);
    seen.add(plan.caseId);
    const source = basePatients.filter(p => p.caseId === plan.caseId && p.version === BASE_VERSION);
    if (source.length !== 1) throw Error(`REVIEW_BASE_REQUIRED:${plan.caseId}`);
    const patient = source[0]!;
    const ids = new Set(patient.facts.map(f => f.id));
    if (ids.size !== patient.facts.length) throw Error(`REVIEW_DUPLICATE_SOURCE:${plan.caseId}`);
    const replacements = new Map<string, ReviewFact>();
    for (const fact of plan.replacements) {
      const original = patient.facts.find(f => f.id === fact.id);
      if (!original || original.available !== false || replacements.has(fact.id)) throw Error(`REVIEW_REPLACEMENT_DENIED:${fact.id}`);
      replacements.set(fact.id, fact);
    }
    for (const fact of [...plan.replacements, ...plan.additions]) {
      if (!fact.id.startsWith(`${plan.caseId}:`) || fact.provenance !== "fictional-extension-awaiting-review") throw Error(`REVIEW_PROVENANCE_REQUIRED:${fact.id}`);
    }
    for (const fact of plan.additions) {
      if (ids.has(fact.id)) throw Error(`REVIEW_DUPLICATE_FACT:${fact.id}`);
      ids.add(fact.id);
    }
    const addedLocation = plan.additions.find(f => f.id === `${plan.caseId}:location`);
    return { ...patient, version: COMPLETE_REVIEW_VERSION, facts: [
      ...(addedLocation ? [clone(addedLocation)] : []),
      ...patient.facts.map(f => clone(replacements.get(f.id) ?? f)),
      ...plan.additions.filter(f => f !== addedLocation).map(clone),
    ] };
  });
}
