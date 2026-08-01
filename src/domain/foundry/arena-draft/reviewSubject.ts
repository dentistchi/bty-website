/**
 * FROZEN REVIEW SUBJECT (Slice 3.2I-R5B1A.1-R2.25).
 *
 * WHY A SCENARIO MUST BE FROZEN BEFORE IT IS REVIEWED
 *
 * In the R2.23D-R4 live run, four attempts ended because the reviewer voted `accept` while its own
 * structured detail fields derived at least one defect. The pipeline responded by discarding the
 * scenario and asking the model for a NEW one, with content-free feedback ("Produce a scenario whose
 * quality is unambiguous"). Two of the four discarded scenarios were, on inspection, serviceable.
 *
 * The correct recovery is to rerun the REVIEWER, not the generator. That is only sound if the second
 * review sees exactly what the first one saw — otherwise a "recovered" verdict is a verdict about a
 * different thing, and the measurement is worthless.
 *
 * So the subject is frozen before the first review and identified by a digest over everything that
 * can change a verdict: the canonical scenario, the confirmed boundaries, the active boundary scope,
 * the language, and the review contract (prompt + schema + sampling). Both attempts must reference
 * the same `reviewSubjectSha256`, and any drift fails CLOSED before the second call is made.
 *
 * Deliberately excluded from the digest — these may differ between attempts and cannot change what
 * is being judged: review attempt id, request timestamp, provider request id, latency, response.
 *
 * Pure: no I/O, no clock. `createHash` is a Node built-in with no side effects.
 */

import { createHash } from "node:crypto";
import {
  boundaryProvenanceSha256,
  detectBoundaryProvenanceDrift,
  type BoundaryReviewProvenance,
} from "./boundaryProvenance";

/** Everything that can legitimately change a review verdict. Nothing else belongs here. */
export type ReviewSubject = {
  /** The canonical adapted draft, exactly as the reviewer payload is built from it. */
  scenario: unknown;
  /** Digest of the canonical scenario alone, so scenario drift is distinguishable from context drift. */
  scenarioSha256: string;
  generationAttemptId: string;
  caseId: string;
  /**
   * R2.27 — the CANONICAL boundary record, with its own source and digest.
   *
   * `null` is not "no boundaries": it is "unknown", and the review authority refuses it. The
   * R2.25 replay passed empty arrays for a boundary-bearing case and nothing could tell that apart
   * from the legitimate c01 no-boundary case.
   */
  boundaryProvenance: BoundaryReviewProvenance | null;
  /** Confirmed boundaries, id + statement, in the order the reviewer receives them. */
  confirmedBoundaries: Array<{ id: string; statement: string }>;
  /** The active scope. A boundary that is in scope for one review and not the other is drift. */
  activeBoundaryIds: string[];
  language: string;
  generationModel: string;
  generationSampling: unknown;
  generationFinishReason: string | null;
  canonicalValidatorResult: unknown;
  deterministicGateResult: unknown;
  /** Digest over the review prompt + schema + sampling. */
  reviewContractSha256: string;
};

export const canonicalJson = (v: unknown): string => {
  const walk = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(walk);
    if (x && typeof x === "object") {
      return Object.fromEntries(
        Object.entries(x as Record<string, unknown>)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, v]) => [k, walk(v)]),
      );
    }
    return x;
  };
  return JSON.stringify(walk(v));
};

export const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

export const scenarioDigest = (scenario: unknown): string => sha256(canonicalJson(scenario));

/**
 * The digest BOTH review attempts must carry.
 *
 * Covers only verdict-relevant fields. Response-shaped and timing-shaped values are excluded by
 * construction rather than by filtering, so a future field cannot accidentally join the digest and
 * make every rerun look like drift.
 */
export function reviewSubjectSha256(s: ReviewSubject): string {
  return sha256(
    canonicalJson({
      scenarioSha256: s.scenarioSha256,
      caseId: s.caseId,
      confirmedBoundaries: s.confirmedBoundaries,
      activeBoundaryIds: [...s.activeBoundaryIds].sort(),
      language: s.language,
      generationModel: s.generationModel,
      generationSampling: s.generationSampling,
      reviewContractSha256: s.reviewContractSha256,
      // R2.27 — folded in so a boundary swap moves the subject digest too. The provenance digest
      // remains SEPARATELY auditable via `subjectDigests`, so an auditor never has to unpick this one.
      boundaryProvenanceSha256: s.boundaryProvenance ? boundaryProvenanceSha256(s.boundaryProvenance) : null,
    }),
  );
}

/**
 * The three digests an auditor needs, kept apart.
 *
 * R2.27 requires that "which scenario / which contract / which boundaries" each be answerable
 * without unpicking a single opaque hash — so they are returned individually as well as folded into
 * `reviewSubjectSha256`.
 */
export function subjectDigests(s: ReviewSubject): {
  scenarioSha256: string;
  reviewContractSha256: string;
  boundaryProvenanceSha256: string | null;
  reviewSubjectSha256: string;
} {
  return {
    scenarioSha256: s.scenarioSha256,
    reviewContractSha256: s.reviewContractSha256,
    boundaryProvenanceSha256: s.boundaryProvenance ? boundaryProvenanceSha256(s.boundaryProvenance) : null,
    reviewSubjectSha256: reviewSubjectSha256(s),
  };
}

export type SubjectDriftCode =
  | "subject_digest_mismatch"
  | "boundary_provenance_mutated"
  | "boundary_provenance_absent"
  | "scenario_mutated"
  | "boundary_mutated"
  | "active_scope_mutated"
  | "review_contract_drift"
  | "language_mutated"
  | "case_mutated";

/**
 * Compare the subject the second review is about to use against the frozen original.
 *
 * Returns every drift it finds rather than the first, so a report names the whole divergence. An
 * empty array is the ONLY thing that may authorize a second review call.
 */
export function detectSubjectDrift(frozen: ReviewSubject, current: ReviewSubject): SubjectDriftCode[] {
  const drift: SubjectDriftCode[] = [];
  if (current.scenarioSha256 !== frozen.scenarioSha256) drift.push("scenario_mutated");
  if (scenarioDigest(current.scenario) !== frozen.scenarioSha256) drift.push("scenario_mutated");
  if (canonicalJson(current.confirmedBoundaries) !== canonicalJson(frozen.confirmedBoundaries)) drift.push("boundary_mutated");
  if (canonicalJson([...current.activeBoundaryIds].sort()) !== canonicalJson([...frozen.activeBoundaryIds].sort())) {
    drift.push("active_scope_mutated");
  }
  if (current.reviewContractSha256 !== frozen.reviewContractSha256) drift.push("review_contract_drift");
  // R2.27 — the boundary record is part of the subject's identity. A rerun judged against a
  // different rule set is a verdict about a different question.
  if (!!frozen.boundaryProvenance !== !!current.boundaryProvenance) drift.push("boundary_provenance_absent");
  else if (frozen.boundaryProvenance && current.boundaryProvenance) {
    if (detectBoundaryProvenanceDrift(frozen.boundaryProvenance, current.boundaryProvenance).length > 0) {
      drift.push("boundary_provenance_mutated");
    }
  }
  if (current.language !== frozen.language) drift.push("language_mutated");
  if (current.caseId !== frozen.caseId) drift.push("case_mutated");
  if (reviewSubjectSha256(current) !== reviewSubjectSha256(frozen)) drift.push("subject_digest_mismatch");
  return [...new Set(drift)];
}

/** The gate the rerun path must pass. Fail-closed: any drift refuses the second review. */
export function canRerunOverSubject(frozen: ReviewSubject, current: ReviewSubject): { ok: true } | { ok: false; drift: SubjectDriftCode[] } {
  const drift = detectSubjectDrift(frozen, current);
  return drift.length === 0 ? { ok: true } : { ok: false, drift };
}
