/**
 * DETERMINISTIC LEGACY UPGRADE (Slice 3.2I-R5B1A.1-R2.38 Part 12).
 *
 * The R2.36 captures name evidence by `{segmentRef, excerpt}`. R2.38 names it by a server-issued
 * candidate id. To replay a capture against the new contract, each old reference has to become an
 * id — and that translation is the one place where a regression could quietly invent an answer.
 *
 * SO IT REFUSES TO GUESS. An old reference is upgraded ONLY when:
 *
 *   - its excerpt exactly matches the text of an eligible candidate for that surface and role, and
 *   - EXACTLY ONE such candidate exists.
 *
 * Two or more matches means the provenance is genuinely ambiguous — which is precisely the R2.37
 * defect — so the row is marked ambiguous and classified as unresolved rather than resolved to a
 * plausible guess. Zero matches means the old reference has no legal home under the new candidate
 * policy, which is itself a finding.
 *
 * This is a REGRESSION-ONLY path. Nothing in the live pipeline calls it: the live reviewer never
 * authors an excerpt, so there is never anything to translate.
 *
 * Pure domain: no I/O.
 */

import { normalizeForGrounding } from "./boundaryClauseTerms";
import { NO_CANDIDATE, type EvidenceRole } from "./boundaryTruthContractTypes";
import { poolFor, type BoundaryEvidenceCandidate } from "./boundaryEvidenceCandidates";
import type { R236BoundaryAssessment } from "./legacyBoundaryDto";
import type { BoundaryTruthAssessment } from "./narrowBoundaryReview";

export type LegacyMatch =
  | { kind: "none" }
  | { kind: "resolved"; candidateId: string }
  | { kind: "ambiguous"; candidateIds: string[] }
  | { kind: "unmatched" };

/**
 * The R2.36 evidence bound was 100 characters and the reviewer truncated its own quotes with an
 * ellipsis to fit. That marker is an artefact of the OLD bound, not part of what was quoted, so it
 * is removed before matching. Nothing else about the text is altered.
 */
const stripTruncationMarker = (s: string): string => s.replace(/(\.{3}|…)\s*$/u, "").trim();

/**
 * Find the candidate an old excerpt refers to.
 *
 * Four attempts, each requiring a UNIQUE hit before it resolves. Two or more matches at any stage is
 * ambiguity, and ambiguity is reported rather than broken by preference order — resolving it by
 * picking "the first" is exactly the class of guess this module exists to refuse.
 *
 *   1. exact equality
 *   2. the candidate contains the quote      (the quote was a fragment of one span)
 *   3. the quote starts with the candidate   (the quote ran past a span boundary before truncating)
 *   4. the candidate starts with the quote   (the quote was cut short inside one span)
 */
export function matchLegacyExcerpt(
  candidates: BoundaryEvidenceCandidate[],
  boundaryId: string,
  surfaceRef: string,
  role: EvidenceRole,
  excerpt: string,
): LegacyMatch {
  if (!excerpt.trim()) return { kind: "none" };
  const pool = poolFor(candidates, boundaryId, surfaceRef, role);
  const e = normalizeForGrounding(stripTruncationMarker(excerpt));
  if (!e) return { kind: "none" };
  const stages: Array<(c: BoundaryEvidenceCandidate) => boolean> = [
    (c) => normalizeForGrounding(c.excerpt) === e,
    (c) => normalizeForGrounding(c.excerpt).includes(e),
    (c) => e.startsWith(normalizeForGrounding(c.excerpt)),
    (c) => normalizeForGrounding(c.excerpt).startsWith(e),
  ];
  for (const test of stages) {
    const hits = pool.filter(test);
    if (hits.length === 1) return { kind: "resolved", candidateId: hits[0]!.candidateId };
    if (hits.length > 1) return { kind: "ambiguous", candidateIds: hits.map((c) => c.candidateId) };
  }
  return { kind: "unmatched" };
}

export type UpgradedRow = {
  assessment: BoundaryTruthAssessment;
  /** Set when a legacy reference could not be translated without guessing. */
  notes: Array<{ role: EvidenceRole; outcome: "ambiguous" | "unmatched"; excerpt: string; candidateIds?: string[] }>;
};

export type LegacyUpgradeResult = {
  assessments: BoundaryTruthAssessment[];
  ambiguousCount: number;
  unmatchedCount: number;
  notesBySurface: Record<string, UpgradedRow["notes"]>;
};

/**
 * Translate one captured R2.36 response into the R2.38 contract.
 *
 * The three semantic facts are carried across UNCHANGED — they are what the model actually said.
 * `applicability`, `compliance` and `violationMechanism` are dropped on the floor: R2.38 derives
 * them, and keeping the capture's versions would let a stale conclusion leak into a new verdict.
 *
 * The R2.36 contract had ONE prerequisite reference for both polarities, so which role it plays is
 * read from `prerequisiteStatus` — the field that was always the disambiguator.
 */
export function upgradeR236Response(rows: R236BoundaryAssessment[], candidates: BoundaryEvidenceCandidate[]): LegacyUpgradeResult {
  const notesBySurface: Record<string, UpgradedRow["notes"]> = {};
  let ambiguousCount = 0;
  let unmatchedCount = 0;

  const assessments = rows.map((r) => {
    const notes: UpgradedRow["notes"] = [];
    const take = (role: EvidenceRole, excerpt: string): string => {
      const m = matchLegacyExcerpt(candidates, r.boundaryId, r.surfaceRef, role, excerpt);
      if (m.kind === "resolved") return m.candidateId;
      if (m.kind === "ambiguous") {
        ambiguousCount++;
        notes.push({ role, outcome: "ambiguous", excerpt, candidateIds: m.candidateIds });
      } else if (m.kind === "unmatched") {
        unmatchedCount++;
        notes.push({ role, outcome: "unmatched", excerpt });
      }
      return NO_CANDIDATE;
    };

    const isSatisfaction = r.prerequisiteStatus === "satisfied";
    const isFailure = r.prerequisiteStatus === "explicitly_missing" || r.prerequisiteStatus === "contradicted";
    if (notes.length === 0) notesBySurface[r.surfaceRef] = notes;

    const assessment: BoundaryTruthAssessment = {
      boundaryId: r.boundaryId,
      surfaceRef: r.surfaceRef,
      governedActionStatus: r.governedActionStatus,
      prerequisiteStatus: r.prerequisiteStatus,
      temporalRelation: r.temporalRelation,
      governedActionCandidateId: take("governed_action", r.actionEvidence.excerpt),
      prerequisiteSatisfactionCandidateId: isSatisfaction ? take("prerequisite_satisfaction", r.prerequisiteEvidence.excerpt) : NO_CANDIDATE,
      prerequisiteFailureCandidateId: isFailure ? take("prerequisite_failure", r.prerequisiteEvidence.excerpt) : NO_CANDIDATE,
      reason: r.reason,
    };
    if (notes.length > 0) notesBySurface[r.surfaceRef] = notes;
    return assessment;
  });

  return { assessments, ambiguousCount, unmatchedCount, notesBySurface };
}
