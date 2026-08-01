/**
 * SERVER-OWNED CONTEXT SEGMENTS (Slice 3.2I-R5B1A.1-R2.36 Parts 2, 3).
 *
 * THE MEASURED DEFECT (R2.35 over the R2.34 live run)
 *
 * Two separate failures traced to one cause: the reviewer received context as an unlabelled blob,
 * and the server could not tell afterwards where an excerpt had come from.
 *
 *   branch[0].action[0]  "Finalize the report and communicate with the administrator"
 *                        was rejected using "but you still face delays in the ward" — text that
 *                        belongs to the PARENT world state, not to the action. The grounding rule
 *                        permitted it because own text, inherited world state and branch context
 *                        were merged into ONE corpus.
 *
 *   primary[1]           "Notify the families and proceed with one patient" was judged as a bare
 *                        label: selectedPrimary "", branchContext "", inheritedWorldState "",
 *                        lineage []. The narrow request carried NO scenario opening, so the premise
 *                        that makes "proceed" clinical was never sent. `not_applicable` in 3/3 runs.
 *
 * THIS MODULE
 *
 * The server — never the model — cuts the context into labelled, separately digested segments and
 * assigns each a stable `segmentRef`. Evidence then cites a segment, and the server can verify not
 * only that an excerpt exists but WHERE it came from. Merging is what made the leak invisible; this
 * is the un-merge.
 *
 * Pure domain: no I/O, no provider, no clock.
 */

import { createHash } from "node:crypto";
import type { BoundarySurface } from "./boundarySurfaces";
import type { ArenaScenarioDraft } from "./types";

export const CONTEXT_SEGMENT_VERSION = "practice-boundary-context-segments/1";

/**
 * WHERE a piece of text lives. The locality rules in `narrowBoundaryReview` are written against
 * these kinds, so adding one is a contract change.
 */
export const SEGMENT_KINDS = [
  /** The scenario premise. Context for every surface; never own-action evidence. */
  "scenario_opening",
  /** The surface's own text — the only place its own governed action can be proved. */
  "own_surface",
  /** The resulting world state the surface sits inside. Where a missing prerequisite is stated. */
  "parent_generated_state",
  /** The primary choice that produced this branch. */
  "ancestor_primary",
  /** The branch escalation the learner has read at this point. */
  "branch_escalation",
  /** Anything else the projection carries. Never sufficient for a violation on its own. */
  "global_context",
] as const;
export type SegmentKind = (typeof SEGMENT_KINDS)[number];

export type ContextSegment = {
  /** Server-assigned, stable, compact. The model may cite it but never invent one. */
  segmentRef: string;
  segmentKind: SegmentKind;
  text: string;
  /** The surface this segment belongs to. Empty for scenario-wide segments. */
  sourceSurfaceRef: string;
  /** Branch index the segment belongs to; -1 for scenario-wide or flat. */
  branchId: number;
  lineage: string[];
  sha256: string;
};

/** Compact codes keep `segmentRef` short — it is repeated on every evidence reference. */
const KIND_CODE: Record<SegmentKind, string> = {
  scenario_opening: "opn",
  own_surface: "own",
  parent_generated_state: "par",
  ancestor_primary: "anc",
  branch_escalation: "esc",
  global_context: "glb",
};

const digest = (v: unknown): string => createHash("sha256").update(typeof v === "string" ? v : JSON.stringify(v)).digest("hex");

const makeSegment = (index: number, kind: SegmentKind, text: string, sourceSurfaceRef: string, branchId: number, lineage: string[]): ContextSegment => ({
  segmentRef: `${index}:${KIND_CODE[kind]}`,
  segmentKind: kind,
  text,
  sourceSurfaceRef,
  branchId,
  lineage,
  sha256: digest(text).slice(0, 16),
});

/** The scenario-wide opening segment. Index 0 by construction, so its ref is stable. */
export const OPENING_SEGMENT_REF = `0:${KIND_CODE.scenario_opening}`;

/**
 * Cut the reviewable surfaces into labelled segments.
 *
 * EVERY surface gets the scenario opening and its own text. A branch surface additionally gets its
 * parent generated state, its ancestor primary and its branch escalation — each SEPARATELY, so an
 * excerpt can be attributed rather than guessed at.
 */
export function buildContextSegments(draft: ArenaScenarioDraft, surfaces: BoundarySurface[]): ContextSegment[] {
  // Defensive by design: a malformed or absent draft must fail the subject CLOSED through
  // `validateContextSegments`, never throw halfway through building the context.
  const opening = typeof draft?.opening === "string" ? draft.opening : "";
  const out: ContextSegment[] = [makeSegment(0, "scenario_opening", opening, "", -1, [])];

  surfaces.forEach((s, i) => {
    // 1-based so the opening keeps index 0 and every surface index is stable under reordering.
    const n = i + 1;
    out.push(makeSegment(n, "own_surface", s.text, s.coordinate, s.branchIndex, s.lineage));
    if (s.inheritedWorldState.trim()) {
      out.push(makeSegment(n, "parent_generated_state", s.inheritedWorldState, s.coordinate, s.branchIndex, s.lineage));
    }
    if (s.selectedPrimaryLabel.trim()) {
      out.push(makeSegment(n, "ancestor_primary", s.selectedPrimaryLabel, s.coordinate, s.branchIndex, s.lineage));
    }
    if (s.branchContext.trim()) {
      out.push(makeSegment(n, "branch_escalation", s.branchContext, s.coordinate, s.branchIndex, s.lineage));
    }
  });
  return out;
}

/** Index for lookup during validation. */
export const segmentIndex = (segments: ContextSegment[]): Map<string, ContextSegment> =>
  new Map(segments.map((s) => [s.segmentRef, s]));

/** The segments one surface may cite. Scenario-wide segments are visible to every surface. */
export const segmentsForSurface = (segments: ContextSegment[], surfaceRef: string): ContextSegment[] =>
  segments.filter((s) => s.sourceSurfaceRef === surfaceRef || s.sourceSurfaceRef === "");

export const CONTEXT_SEGMENT_CODES = [
  "context_opening_missing",
  "context_segment_duplicate_ref",
  "context_segment_empty_text",
  "context_own_surface_missing",
] as const;
export type ContextSegmentCode = (typeof CONTEXT_SEGMENT_CODES)[number];

/**
 * Fail closed BEFORE a provider call. R2.35 measured the opening simply absent; that must now be a
 * named refusal rather than a silently thinner question.
 */
export function validateContextSegments(segments: ContextSegment[], surfaces: BoundarySurface[]): { ok: boolean; codes: ContextSegmentCode[] } {
  const codes: ContextSegmentCode[] = [];
  const opening = segments.find((s) => s.segmentKind === "scenario_opening");
  if (!opening || !opening.text.trim()) codes.push("context_opening_missing");

  const seen = new Set<string>();
  for (const s of segments) {
    if (seen.has(s.segmentRef)) codes.push("context_segment_duplicate_ref");
    seen.add(s.segmentRef);
    if (!s.text.trim()) codes.push("context_segment_empty_text");
  }
  for (const surface of surfaces) {
    if (!segments.some((s) => s.segmentKind === "own_surface" && s.sourceSurfaceRef === surface.coordinate)) {
      codes.push("context_own_surface_missing");
    }
  }
  return { ok: codes.length === 0, codes: [...new Set(codes)] };
}

/** Digest over the whole segment map. Any context mutation moves the review-subject digest. */
export function contextSegmentMapSha256(segments: ContextSegment[]): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        version: CONTEXT_SEGMENT_VERSION,
        segments: segments.map((s) => ({
          segmentRef: s.segmentRef,
          segmentKind: s.segmentKind,
          text: s.text,
          sourceSurfaceRef: s.sourceSurfaceRef,
          branchId: s.branchId,
          lineage: s.lineage,
        })),
      }),
    )
    .digest("hex");
}
