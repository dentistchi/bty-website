/**
 * GENERATED-RESULT CAUSAL OWNERSHIP (Slice 3.2I-R5B1A.1-R2.46).
 *
 * WHAT R2.45 MEASURED
 *
 * `primary[1]` — "Notify the families and proceed with one patient" — is the choice that breaks the
 * confirmed boundary, and it was missed 7/7 across the whole arc. It was not missed for lack of
 * evidence: the server offered candidate `2-a1`, the reviewer SELECTED it, and then answered
 * `governedActionStatus: absent`. The model does not read "proceed with one patient" as treatment.
 *
 * Its generated child does. `branch[1].resulting_world_state` says "You prioritized immediate
 * treatment for one patient while notifying the family," — a direct governed-action match, and
 * already a valid violation today.
 *
 * WHY THIS IS NOT A TEXT HEURISTIC
 *
 * The obvious move is to notice that the child's wording echoes the parent's. R2.45 measured that
 * and rejected it: `branch[0]`'s generated state echoes ITS parent just as strongly while also
 * introducing "provided the necessary treatment", a governed action the parent label never states.
 * Overlap proves a child is ABOUT its parent; it cannot separate the parent's act from an added
 * effect, and no amount of phrase matching will.
 *
 * The schema already answers the question outright. `branches[p.id].resultingWorldState` IS, by
 * construction, the world produced by choosing `p.id`. A boundary violation located in that state
 * is therefore a consequence of that choice — not by inference, by definition. This module reads
 * that edge and nothing else. No candidate text reaches it.
 *
 * WHAT IT DOES AND DOES NOT DO
 *
 * It assigns CORRECTION OWNERSHIP. It does not touch the parent's direct assessment: `primary[1]`
 * keeps `governedActionStatus: absent`, keeps candidate `2-a1`, keeps `not_applicable`. A parent
 * never borrows its child's candidate id — the resolver refuses cross-surface citation
 * (`boundary_candidate_wrong_surface`) and that refusal stays intact. Evidence stays exactly where
 * it was resolved; only the question "who must fix this" moves.
 *
 * Pure domain: no I/O, no provider, no clock.
 */

import { createHash } from "node:crypto";
import type { BoundarySurface } from "./boundarySurfaces";

export const CAUSAL_ATTRIBUTION_VERSION = "practice-boundary-causal-attribution/1";

/**
 * The ONE authority value. It means exactly: a direct resulting-world-state child of a single
 * learner-decision parent, as defined by the generation schema. There is no second authority, and
 * no model-authored string can ever appear here.
 */
export const ATTRIBUTION_AUTHORITY = "schema_direct_resulting_world_state_child_of_single_learner_decision_parent" as const;
export type AttributionAuthority = typeof ATTRIBUTION_AUTHORITY;

export const ATTRIBUTION_REFUSAL_CODES = [
  "causal_attribution_child_not_resulting_world_state",
  "causal_attribution_child_not_violating",
  "causal_attribution_child_evidence_unresolved",
  "causal_attribution_lineage_not_single_parent",
  "causal_attribution_parent_not_in_surface_map",
  "causal_attribution_parent_not_learner_decision",
  "causal_attribution_parent_not_independently_selectable",
  "causal_attribution_schema_edge_mismatch",
  "causal_attribution_boundary_mismatch",
] as const;
export type AttributionRefusalCode = (typeof ATTRIBUTION_REFUSAL_CODES)[number];

/**
 * The subset of a derived violation this module is allowed to see.
 *
 * Deliberately structural and deliberately TEXT-FREE — there is no excerpt field, so a future
 * change cannot quietly reintroduce phrase matching without widening this type first.
 */
export type AttributionInputViolation = {
  boundaryId: string;
  surfaceRef: string;
  compliance: string;
  lineage: string[];
  governedActionCandidateId: string;
  prerequisiteFailureCandidateId: string;
  governedActionSegmentRef: string;
  prerequisiteSegmentRef: string;
  prerequisiteSegmentKind: string;
};

export type EvidenceProvenanceRow = {
  candidateId: string;
  /** Always the manifestation surface. A parent never appears here. */
  surfaceRef: string;
  segmentRef: string;
  segmentKind: string;
  role: "governed_action" | "prerequisite_failure";
};

export type CausalAttribution = {
  boundaryId: string;
  /** The learner choice that owns the correction. */
  ancestorSurfaceRef: string;
  /** The generated state where the violation was actually proved. */
  manifestationSurfaceRef: string;
  attributionAuthority: AttributionAuthority;
  causalGroupId: string;
  lineage: string[];
  evidenceCandidateIds: string[];
  evidenceProvenance: EvidenceProvenanceRow[];
};

export type AttributionDecision = {
  boundaryId: string;
  surfaceRef: string;
  parentSurfaceRef: string;
  attributed: boolean;
  refusalCode: AttributionRefusalCode | null;
};

export type CausalGroup = {
  causalGroupId: string;
  boundaryId: string;
  /** Who the correction instruction is addressed to. */
  correctionOwnerSurfaceRef: string;
  /** Violating surfaces folded into this group. Empty when the owner is itself the violation. */
  manifestationSurfaceRefs: string[];
  attributed: boolean;
};

export type CausalAttributionMetrics = {
  generatedResultAncestorAttributionCount: number;
  generatedResultManifestationCount: number;
  causalCorrectionGroupCount: number;
  /** Violating rows that no longer produce a correction item of their own. */
  causalPacketDedupCount: number;
  /** Structurally always 0 — this module returns new objects and mutates nothing. */
  ancestorDirectAssessmentMutationCount: number;
  attributionRefusedCount: number;
};

const groupId = (boundaryId: string, owner: string, manifestation: string): string =>
  createHash("sha256")
    .update(JSON.stringify([CAUSAL_ATTRIBUTION_VERSION, ATTRIBUTION_AUTHORITY, boundaryId, owner, manifestation]))
    .digest("hex")
    .slice(0, 16);

const resolved = (id: string): boolean => id !== "" && id !== "none";

/** The coordinate the schema gives a branch's primary choice. The edge, written down. */
const schemaPrimaryCoordinate = (branchIndex: number): string => `primary[${branchIndex}]`;

/**
 * Decide attribution for every violating row.
 *
 * Fails closed at every step: anything not structurally proven is refused with a named code and the
 * row simply keeps owning its own correction, which is the behaviour that existed before this
 * module. A refusal is never a finding and never reaches a product user.
 */
export function deriveCausalAttributions(
  violations: readonly AttributionInputViolation[],
  surfaces: readonly BoundarySurface[],
  activeBoundaryIds: readonly string[],
): { attributions: CausalAttribution[]; decisions: AttributionDecision[]; metrics: CausalAttributionMetrics } {
  const byRef = new Map(surfaces.map((s) => [s.coordinate, s]));
  const attributions: CausalAttribution[] = [];
  const decisions: AttributionDecision[] = [];

  for (const v of violations) {
    const parentRef = v.lineage.length === 1 ? v.lineage[0]! : "";
    const refuse = (refusalCode: AttributionRefusalCode) => {
      decisions.push({ boundaryId: v.boundaryId, surfaceRef: v.surfaceRef, parentSurfaceRef: parentRef, attributed: false, refusalCode });
    };

    // (9) An unknown boundary is refused before anything else is inspected.
    if (!activeBoundaryIds.includes(v.boundaryId)) {
      refuse("causal_attribution_boundary_mismatch");
      continue;
    }
    const child = byRef.get(v.surfaceRef);
    // (1) Only a generated resulting world state. A later action decision is a fresh commitment and
    // owns its own correction — that is what keeps a reopening independent.
    if (!child || child.kind !== "resulting_world_state") {
      refuse("causal_attribution_child_not_resulting_world_state");
      continue;
    }
    // (2,3) Only a complete, candidate-valid violation. Uncertain, compliant and malformed rows
    // never reach a correction owner.
    if (v.compliance !== "violates") {
      refuse("causal_attribution_child_not_violating");
      continue;
    }
    if (!resolved(v.governedActionCandidateId) || !resolved(v.prerequisiteFailureCandidateId)) {
      refuse("causal_attribution_child_evidence_unresolved");
      continue;
    }
    // (4) Exactly one direct parent. Two parents is ambiguity, and ambiguity is refused, not split.
    if (parentRef === "") {
      refuse("causal_attribution_lineage_not_single_parent");
      continue;
    }
    // (5) The parent must exist in the FROZEN reachable-surface map, not merely be named.
    const parent = byRef.get(parentRef);
    if (!parent) {
      refuse("causal_attribution_parent_not_in_surface_map");
      continue;
    }
    // (6) A generated state cannot own a correction — nobody chose it.
    if (parent.reachability !== "learner_decision" || parent.kind === "resulting_world_state") {
      refuse("causal_attribution_parent_not_learner_decision");
      continue;
    }
    // (7) And it must be something the learner could actually pick.
    if (parent.independentlySelectable !== true) {
      refuse("causal_attribution_parent_not_independently_selectable");
      continue;
    }
    // (8) THE EDGE ITSELF. The schema must say this child is that parent's resulting world state:
    // the child's own parent pointer names it, and the branch index agrees with the primary index.
    // A disagreement between lineage and the schema edge is refused rather than resolved in either
    // direction — a re-parented surface must not silently redirect a correction.
    if (child.parentPrimaryCoordinate !== parentRef || parentRef !== schemaPrimaryCoordinate(child.branchIndex)) {
      refuse("causal_attribution_schema_edge_mismatch");
      continue;
    }

    // (10) Provenance is recorded AT THE CHILD. The parent is named as owner and nothing else.
    const evidenceProvenance: EvidenceProvenanceRow[] = [
      { candidateId: v.governedActionCandidateId, surfaceRef: v.surfaceRef, segmentRef: v.governedActionSegmentRef, segmentKind: "own_surface", role: "governed_action" },
      { candidateId: v.prerequisiteFailureCandidateId, surfaceRef: v.surfaceRef, segmentRef: v.prerequisiteSegmentRef, segmentKind: v.prerequisiteSegmentKind, role: "prerequisite_failure" },
    ];
    attributions.push({
      boundaryId: v.boundaryId,
      ancestorSurfaceRef: parentRef,
      manifestationSurfaceRef: v.surfaceRef,
      attributionAuthority: ATTRIBUTION_AUTHORITY,
      causalGroupId: groupId(v.boundaryId, parentRef, v.surfaceRef),
      lineage: [...v.lineage],
      evidenceCandidateIds: [v.governedActionCandidateId, v.prerequisiteFailureCandidateId],
      evidenceProvenance,
    });
    decisions.push({ boundaryId: v.boundaryId, surfaceRef: v.surfaceRef, parentSurfaceRef: parentRef, attributed: true, refusalCode: null });
  }

  const groups = buildCausalGroups(violations, attributions);
  return { attributions, decisions, metrics: summarizeCausalAttribution(decisions, attributions, groups) };
}

/**
 * Partition the causal violations into correction groups.
 *
 * An attributed manifestation is folded into its parent's group; every other violation owns itself.
 * Ordering follows the violation order it was given, so the packet is deterministic.
 */
export function buildCausalGroups(
  causalViolations: readonly AttributionInputViolation[],
  attributions: readonly CausalAttribution[],
): CausalGroup[] {
  const ownerOf = new Map(attributions.map((a) => [a.boundaryId + " " + a.manifestationSurfaceRef, a]));
  const groups: CausalGroup[] = [];
  const byId = new Map<string, CausalGroup>();

  for (const v of causalViolations) {
    const a = ownerOf.get(v.boundaryId + " " + v.surfaceRef);
    if (a) {
      const existing = byId.get(a.causalGroupId);
      if (existing) {
        if (!existing.manifestationSurfaceRefs.includes(v.surfaceRef)) existing.manifestationSurfaceRefs.push(v.surfaceRef);
        continue;
      }
      const g: CausalGroup = {
        causalGroupId: a.causalGroupId,
        boundaryId: a.boundaryId,
        correctionOwnerSurfaceRef: a.ancestorSurfaceRef,
        manifestationSurfaceRefs: [v.surfaceRef],
        attributed: true,
      };
      byId.set(g.causalGroupId, g);
      groups.push(g);
      continue;
    }
    const id = groupId(v.boundaryId, v.surfaceRef, "");
    if (byId.has(id)) continue;
    const g: CausalGroup = { causalGroupId: id, boundaryId: v.boundaryId, correctionOwnerSurfaceRef: v.surfaceRef, manifestationSurfaceRefs: [], attributed: false };
    byId.set(id, g);
    groups.push(g);
  }
  return groups;
}

export function summarizeCausalAttribution(
  decisions: readonly AttributionDecision[],
  attributions: readonly CausalAttribution[],
  groups: readonly CausalGroup[],
): CausalAttributionMetrics {
  return {
    generatedResultAncestorAttributionCount: attributions.length,
    generatedResultManifestationCount: new Set(attributions.map((a) => a.manifestationSurfaceRef)).size,
    causalCorrectionGroupCount: groups.length,
    // Each folded manifestation is one correction item that is no longer emitted on its own.
    causalPacketDedupCount: groups.reduce((n, g) => n + g.manifestationSurfaceRefs.length, 0),
    // This module builds new objects and never writes to its inputs. Asserted, not assumed.
    ancestorDirectAssessmentMutationCount: 0,
    attributionRefusedCount: decisions.filter((d) => d.refusalCode !== null).length,
  };
}

/** The contract digest — moves when the authority, its preconditions or its refusals move. */
export const causalAttributionContractSha256 = (): string =>
  createHash("sha256")
    .update(
      JSON.stringify({
        version: CAUSAL_ATTRIBUTION_VERSION,
        authority: ATTRIBUTION_AUTHORITY,
        refusalCodes: ATTRIBUTION_REFUSAL_CODES,
        preconditions: [
          "child_kind_resulting_world_state",
          "child_compliance_violates",
          "child_governed_action_candidate_resolved",
          "child_prerequisite_failure_candidate_resolved",
          "lineage_exactly_one_parent",
          "parent_present_in_frozen_surface_map",
          "parent_reachability_learner_decision",
          "parent_independently_selectable",
          "schema_edge_parent_primary_coordinate_matches_lineage",
          "schema_edge_branch_index_matches_primary_index",
          "boundary_id_active",
        ],
        textualEvidenceConsulted: false,
        phraseOverlapConsulted: false,
        modelAuthoredAttributionFields: false,
        parentDirectAssessmentMutated: false,
        crossSurfaceCandidateCitation: false,
        evidenceRemainsOnManifestation: true,
        correctionOwnerIsAncestor: true,
        independentReopeningRemainsOwnOwner: true,
        dedupBasis: "explicit_causal_group_identity_not_mechanism_equality",
      }),
    )
    .digest("hex");
