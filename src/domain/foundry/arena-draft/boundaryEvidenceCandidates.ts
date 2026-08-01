/**
 * SERVER-OWNED EVIDENCE CANDIDATES (Slice 3.2I-R5B1A.1-R2.38 Parts 4-8).
 *
 * WHAT R2.37 MEASURED
 *
 * The R2.36 request exposed 41 segment refs carrying 15 distinct texts — 63% duplication. Six texts
 * appeared under five or six different refs. The reviewer was then asked to pick the one ref that
 * was legal for the surface it was judging, from a set the server had made indistinguishable by
 * content.
 *
 * It failed exactly there. `branch[1].action[1]` cited `8:own` for its prerequisite failure. `8:own`
 * and `12:par` are BYTE-IDENTICAL text; only `12:par` was citable by that surface. The response was
 * discarded — and it was the best live semantic result measured anywhere in the arc: two true
 * positives, zero false positives.
 *
 * A second defect compounded it. R2.36 merged prerequisite satisfaction and failure into one field
 * and gave it the sources FAILURE needs (`own_surface`, `parent_generated_state`). A prerequisite
 * satisfied by an EARLIER choice lives in `ancestor_primary`, and the rule that states it lives in
 * `scenario_opening`. Neither was citable, so every satisfaction claim was structurally homeless.
 *
 * WHAT THIS MODULE DOES
 *
 * The server builds a bounded, SURFACE-LOCAL and ROLE-SCOPED pool of candidate evidence spans and
 * gives each one an id. The reviewer selects an id. It never writes an excerpt, never names a
 * segment kind, never names a source surface.
 *
 *   - a candidate id is scoped to the surface that may use it, so another surface's identical text
 *     is not merely wrong, it is not offered;
 *   - satisfaction and failure have SEPARATE pools with different legal sources, so a prerequisite
 *     satisfied upstream finally has a legal home;
 *   - a failure candidate must concern the prerequisite the boundary's own semantic frame names, so
 *     "you still face delays in the ward" is never offered as proof a verification failed.
 *
 * PROVENANCE IS NOT COLLAPSED (Part 6). Two candidates are merged only when EVERY identity
 * component agrees — assessed surface, role, canonical segment kind, source surface, branch,
 * lineage and exact excerpt. The same world-state sentence under four different child surfaces stays
 * four distinct candidates, because it means something different at each one.
 *
 * Pure domain: no I/O, no provider, no clock.
 */

import { createHash } from "node:crypto";
import { ROLE_CODE, type EvidenceRole } from "./boundaryTruthContractTypes";
import type { ContextSegment, SegmentKind } from "./boundaryContextSegments";
import type { BoundarySurface } from "./boundarySurfaces";
import type { BoundarySemanticFrame } from "./boundarySemanticFrame";
import { clauseStems } from "./boundaryClauseTerms";

export const EVIDENCE_CANDIDATE_VERSION = "practice-boundary-evidence-candidates/1";

/** Bounded so the candidate table's contribution to the REQUEST stays measurable. */
export const CANDIDATE_EXCERPT_MAX = 160;
export const CANDIDATE_ID_MAX = 12;
/** Per surface, per role. A pool larger than this means extraction is too fine-grained. */
export const MAX_CANDIDATES_PER_POOL = 8;

export type BoundaryEvidenceCandidate = {
  /** `<surfaceIndex>-<roleCode><n>` — e.g. `12-f1`. Surface-scoped by construction. */
  candidateId: string;
  boundaryId: string;
  /** The ONE surface that may select this candidate. */
  assessedSurfaceRef: string;
  semanticRole: EvidenceRole;
  canonicalSegmentRef: string;
  canonicalSegmentKind: SegmentKind;
  /** Where the text actually lives, which may be an ancestor of the assessed surface. */
  sourceSurfaceRef: string;
  branchId: number;
  lineage: string[];
  excerpt: string;
  startOffset: number;
  endOffset: number;
  sha256: string;
};

const digest = (v: unknown): string => createHash("sha256").update(typeof v === "string" ? v : JSON.stringify(v)).digest("hex");

// ---------------------------------------------------------------------------
// Extraction — structural only
// ---------------------------------------------------------------------------

/**
 * Split a segment into spans, each an EXACT contiguous substring with real offsets.
 *
 * The spans PARTITION the segment — they never nest. An earlier draft emitted the whole segment AND
 * its clauses, which put a span and its own sub-span in the same pool: the model would have had two
 * overlapping ways to cite one fact, and the legacy upgrade could not tell which one an old excerpt
 * meant. That is the R2.37 duplicate-alias defect in miniature, so it is not reintroduced here.
 *
 * A segment with no internal boundary yields exactly one span: itself.
 *
 * Purely structural. No safety meaning is assigned at this stage.
 */
export function extractSpans(text: string): Array<{ excerpt: string; startOffset: number; endOffset: number }> {
  const out: Array<{ excerpt: string; startOffset: number; endOffset: number }> = [];
  const push = (start: number, end: number) => {
    const raw = text.slice(start, end);
    const lead = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed.length < 12) return;
    const s = start + lead;
    out.push({ excerpt: trimmed.slice(0, CANDIDATE_EXCERPT_MAX), startOffset: s, endOffset: s + Math.min(trimmed.length, CANDIDATE_EXCERPT_MAX) });
  };
  // Sentence boundaries, plus the contrastive clause markers a world state uses to say what went
  // wrong ("…, but this left the second patient unverified").
  const re = /[.!?](?:\s+|$)|,\s+(?=but\b|yet\b|although\b|however\b|while\b)/gi;
  let cursor = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const end = m.index + m[0].length;
    push(cursor, end);
    cursor = end;
  }
  if (cursor < text.length) push(cursor, text.length);
  if (out.length === 0) push(0, text.length);
  return out;
}

// ---------------------------------------------------------------------------
// Role eligibility (Part 7)
// ---------------------------------------------------------------------------

/** Which surfaces count as a learner's own decision rather than an asserted state. */
const isGeneratedState = (s: BoundarySurface): boolean => s.kind === "resulting_world_state";
const isPrimaryDecision = (s: BoundarySurface): boolean => s.lineage.length === 0 && !isGeneratedState(s);

/**
 * The legal SOURCE KINDS for one role at one surface.
 *
 * (7A) A governed action can only ever be proved by the surface's own text. Inherited context must
 *      never make an administrative action guilty of treating a patient.
 * (7B) Satisfaction may come from upstream — this is the R2.36 homeless-satisfaction repair.
 * (7C) Failure sources follow the surface's position in the path.
 */
export function allowedSourceKinds(role: EvidenceRole, surface: BoundarySurface): SegmentKind[] {
  if (role === "governed_action") return ["own_surface"];
  if (role === "prerequisite_satisfaction") {
    const kinds: SegmentKind[] = ["own_surface"];
    if (!isPrimaryDecision(surface)) kinds.push("parent_generated_state", "ancestor_primary");
    kinds.push("scenario_opening");
    return kinds;
  }
  // prerequisite_failure
  if (isPrimaryDecision(surface)) return ["scenario_opening", "own_surface"];
  if (isGeneratedState(surface)) return ["own_surface"];
  return ["parent_generated_state", "own_surface"];
}

/**
 * (7D) PROHIBITED USES, applied at extraction so an ineligible span is never offered.
 *
 * A prerequisite span must genuinely concern the prerequisite the boundary's own frame names. This
 * is what makes "but you still face delays in the ward" — the measured R2.34 false positive —
 * unrepresentable rather than merely refused. The terms come from the boundary's decomposed clause,
 * never from a hand-written domain vocabulary.
 */
export function isEligibleExcerpt(role: EvidenceRole, excerpt: string, frame: BoundarySemanticFrame, boundaryStatement: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").replace(/\s+/g, " ").trim();
  const e = norm(excerpt);
  if (!e) return false;
  // The rule quoted back at itself is never proof of conduct.
  if (norm(boundaryStatement).includes(e)) return false;
  if (role === "governed_action") return true;
  const stems = clauseStems(frame.prerequisiteClause || frame.exactBoundaryText);
  if (stems.length === 0) return false;
  return stems.some((stem) => e.includes(stem));
}

// ---------------------------------------------------------------------------
// Building the map
// ---------------------------------------------------------------------------

/** Everything that must agree before two candidates are treated as one. */
const identityOf = (c: Omit<BoundaryEvidenceCandidate, "candidateId" | "sha256">): string =>
  JSON.stringify([c.assessedSurfaceRef, c.semanticRole, c.canonicalSegmentKind, c.sourceSurfaceRef, c.branchId, c.lineage, c.excerpt]);

export type CandidateBuildResult = {
  candidates: BoundaryEvidenceCandidate[];
  /** How many spans collapsed into an existing candidate because ALL identity agreed. */
  aliasRemovedCount: number;
  /** Candidates that share an excerpt with another but differ in provenance — deliberately kept. */
  provenanceRetainedCount: number;
};

/**
 * Build every candidate for one boundary over the reachable surfaces.
 *
 * Deterministic in (segments, surfaces, frame): same inputs, byte-identical map.
 */
export function buildEvidenceCandidates(
  boundary: { id: string; statement: string },
  frame: BoundarySemanticFrame,
  surfaces: BoundarySurface[],
  segments: ContextSegment[],
): CandidateBuildResult {
  const candidates: BoundaryEvidenceCandidate[] = [];
  let aliasRemovedCount = 0;
  const seen = new Set<string>();

  surfaces.forEach((surface, surfaceIndex) => {
    const visible = segments.filter((s) => s.sourceSurfaceRef === "" || s.sourceSurfaceRef === surface.coordinate);
    for (const role of ["governed_action", "prerequisite_satisfaction", "prerequisite_failure"] as const) {
      const kinds = allowedSourceKinds(role, surface);
      let n = 0;
      for (const seg of visible) {
        if (!kinds.includes(seg.segmentKind)) continue;
        // (7D) branch escalation is never prerequisite proof unless the frame names it as the
        // prerequisite state — which no current frame kind does.
        if (seg.segmentKind === "branch_escalation") continue;
        for (const span of extractSpans(seg.text)) {
          if (!isEligibleExcerpt(role, span.excerpt, frame, boundary.statement)) continue;
          const body = {
            boundaryId: boundary.id,
            assessedSurfaceRef: surface.coordinate,
            semanticRole: role,
            canonicalSegmentRef: seg.segmentRef,
            canonicalSegmentKind: seg.segmentKind,
            sourceSurfaceRef: seg.sourceSurfaceRef || surface.coordinate,
            branchId: surface.branchIndex,
            lineage: surface.lineage,
            excerpt: span.excerpt,
            startOffset: span.startOffset,
            endOffset: span.endOffset,
          };
          const identity = identityOf(body);
          if (seen.has(identity)) {
            // (Part 6) An ALIAS: same surface, same role, same canonical provenance, same text.
            aliasRemovedCount++;
            continue;
          }
          if (n >= MAX_CANDIDATES_PER_POOL) continue;
          seen.add(identity);
          n++;
          candidates.push({ ...body, candidateId: `${surfaceIndex + 1}-${ROLE_CODE[role]}${n}`, sha256: digest(body).slice(0, 16) });
        }
      }
    }
  });

  // Candidates that share an excerpt with another but differ in provenance. R2.37 measured that
  // collapsing these is exactly what destroyed a correct answer, so they are counted, not merged.
  const byExcerpt = new Map<string, number>();
  for (const c of candidates) byExcerpt.set(c.excerpt, (byExcerpt.get(c.excerpt) ?? 0) + 1);
  const provenanceRetainedCount = candidates.filter((c) => (byExcerpt.get(c.excerpt) ?? 0) > 1).length;

  return { candidates, aliasRemovedCount, provenanceRetainedCount };
}

export const buildAllEvidenceCandidates = (
  boundaries: Array<{ id: string; statement: string }>,
  frames: BoundarySemanticFrame[],
  surfaces: BoundarySurface[],
  segments: ContextSegment[],
): CandidateBuildResult =>
  boundaries.reduce<CandidateBuildResult>(
    (acc, b) => {
      const frame = frames.find((f) => f.boundaryId === b.id);
      if (!frame) return acc;
      const r = buildEvidenceCandidates(b, frame, surfaces, segments);
      return {
        candidates: [...acc.candidates, ...r.candidates],
        aliasRemovedCount: acc.aliasRemovedCount + r.aliasRemovedCount,
        provenanceRetainedCount: acc.provenanceRetainedCount + r.provenanceRetainedCount,
      };
    },
    { candidates: [], aliasRemovedCount: 0, provenanceRetainedCount: 0 },
  );

// ---------------------------------------------------------------------------
// Resolution — the only way a candidate id becomes evidence
// ---------------------------------------------------------------------------

export type CandidateIndex = Map<string, BoundaryEvidenceCandidate>;
export const indexCandidates = (cs: BoundaryEvidenceCandidate[]): CandidateIndex => new Map(cs.map((c) => [c.candidateId, c]));

export const CANDIDATE_RESOLUTION_CODES = [
  "boundary_candidate_unknown",
  "boundary_candidate_wrong_surface",
  "boundary_candidate_wrong_role",
  "boundary_candidate_wrong_boundary",
] as const;
export type CandidateResolutionCode = (typeof CANDIDATE_RESOLUTION_CODES)[number];

export type CandidateResolution =
  | { ok: true; candidate: BoundaryEvidenceCandidate }
  | { ok: false; code: CandidateResolutionCode };

/**
 * Resolve one selected id. FAIL CLOSED on anything unexpected: an id nobody issued, an id belonging
 * to a different surface, a different role, or a different boundary.
 */
export function resolveCandidate(
  index: CandidateIndex,
  candidateId: string,
  expect: { boundaryId: string; surfaceRef: string; role: EvidenceRole },
): CandidateResolution {
  const c = index.get(candidateId);
  if (!c) return { ok: false, code: "boundary_candidate_unknown" };
  if (c.boundaryId !== expect.boundaryId) return { ok: false, code: "boundary_candidate_wrong_boundary" };
  if (c.assessedSurfaceRef !== expect.surfaceRef) return { ok: false, code: "boundary_candidate_wrong_surface" };
  if (c.semanticRole !== expect.role) return { ok: false, code: "boundary_candidate_wrong_role" };
  return { ok: true, candidate: c };
}

/** The pool one surface may choose from, for one role. This is what the request projects. */
export const poolFor = (cs: BoundaryEvidenceCandidate[], boundaryId: string, surfaceRef: string, role: EvidenceRole): BoundaryEvidenceCandidate[] =>
  cs.filter((c) => c.boundaryId === boundaryId && c.assessedSurfaceRef === surfaceRef && c.semanticRole === role);

/** Digest over the whole candidate map. Any candidate change moves the review-subject digest. */
export const evidenceCandidateMapSha256 = (cs: BoundaryEvidenceCandidate[]): string =>
  createHash("sha256")
    .update(
      JSON.stringify({
        version: EVIDENCE_CANDIDATE_VERSION,
        candidates: cs.map((c) => ({
          candidateId: c.candidateId,
          boundaryId: c.boundaryId,
          assessedSurfaceRef: c.assessedSurfaceRef,
          semanticRole: c.semanticRole,
          canonicalSegmentRef: c.canonicalSegmentRef,
          canonicalSegmentKind: c.canonicalSegmentKind,
          sourceSurfaceRef: c.sourceSurfaceRef,
          branchId: c.branchId,
          lineage: c.lineage,
          excerpt: c.excerpt,
          startOffset: c.startOffset,
          endOffset: c.endOffset,
        })),
      }),
    )
    .digest("hex");

/** The extraction + eligibility contract itself, digested for the manifest. */
export const candidateContractSha256 = (): string =>
  createHash("sha256")
    .update(
      JSON.stringify({
        version: EVIDENCE_CANDIDATE_VERSION,
        excerptMax: CANDIDATE_EXCERPT_MAX,
        idMax: CANDIDATE_ID_MAX,
        maxPerPool: MAX_CANDIDATES_PER_POOL,
        roleCodes: ROLE_CODE,
        resolutionCodes: CANDIDATE_RESOLUTION_CODES,
        governedActionSources: ["own_surface"],
        satisfactionSourcesUpstreamAllowed: true,
        failureSourcesByPosition: { primary: ["scenario_opening", "own_surface"], generatedState: ["own_surface"], descendantAction: ["parent_generated_state", "own_surface"] },
        escalationNeverPrerequisiteProof: true,
        boundaryRestatementNeverEvidence: true,
        prerequisiteSpansMustConcernPrerequisiteClause: true,
        candidateIdsAreSurfaceScoped: true,
        provenanceDistinctCandidatesRetained: true,
      }),
    )
    .digest("hex");
