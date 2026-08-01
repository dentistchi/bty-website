/**
 * LEARNER-REACHABLE BOUNDARY SURFACE MAP (Slice 3.2I-R5B1A.1-R2.30).
 *
 * R2.29 SUCCEEDED AND OVERREACHED
 *
 * The narrow review correctly rejected the c18 scenario and found four real violations. It also
 * marked five surfaces violating on one rationale family:
 *
 *     flat_tradeoff[1]       "requesting additional staff"                        → "Does not address verification of identifiers."
 *     branch[1].tradeoff[0]  "Prepare a summary of events for the administrator"  → same
 *     branch[1].action[0]    "Finish the summary and send it to the administrator" → same
 *
 * Two separate defects produced that:
 *
 *  1. SILENCE WAS TREATED AS VIOLATION. Not mentioning verification is not evidence that a surface
 *     authorizes treatment without it. Applicability is now judged before compliance — see
 *     `narrowBoundaryReview.ts`.
 *
 *  2. UNREACHABLE FIELDS CARRIED PRODUCT AUTHORITY. `flat_tradeoff` / `flat_action` were reviewed as
 *     learner decisions. MEASURED at `ArenaPracticePlayer.tsx` — the only learner player for a
 *     published practice:
 *
 *         const active = isBranchAware(scenario) && selectedPrimaryId && branches[selectedPrimaryId]
 *           ? branches[selectedPrimaryId]            // ← every generated practice takes this path
 *           : { tradeoffChoices: scenario.tradeoff.choices, actionDecision: scenario.actionDecision };
 *
 *     Generated cardinality is 2 primary choices and 2 branches, so `isBranchAware` is always true
 *     and the flat fields are UNREACHABLE under every learner path. They are a legacy fallback for
 *     non-branch-aware snapshots. Reachability is therefore COMPUTED per draft, never assumed.
 *
 * RENDERED vs SELECTABLE vs ASSERTED — three different authorities, measured not guessed:
 *
 *   primary / branch tradeoff / branch action   rendered AND selectable  → learner decisions
 *   branch escalation                           rendered, not selectable → context, carried on each
 *                                               surface rather than judged as its own
 *   branch resultingWorldState                  NOT rendered by the learner player (Host preview
 *                                               only — `ArenaScenarioPreview.tsx:74`), never
 *                                               selectable; but it is the generator's own assertion
 *                                               of the world the branch is in, and the branch's later
 *                                               choices are authored against it. Reviewed as a STATE
 *                                               surface, never as a decision.
 *   flat tradeoff / flat action                 unreachable for a branch-aware draft → compatibility
 *
 * Pure domain: no I/O, no provider, no DB, no clock.
 */

import { createHash } from "node:crypto";
import { isBranchAware, type ArenaScenarioDraft } from "./types";

/** Versioned: a change to coordinate construction or reachability is a contract change. */
export const SURFACE_MAP_VERSION = "practice-boundary-surface-map/2";

export const SURFACE_KINDS = ["choice", "resulting_world_state"] as const;
export type SurfaceKind = (typeof SURFACE_KINDS)[number];

/**
 * How the learner actually meets this field. Only `learner_decision` and `generated_state` carry
 * independent product safety authority; `compatibility_projection` carries none.
 */
export const SURFACE_REACHABILITY = ["learner_decision", "generated_state", "compatibility_projection"] as const;
export type SurfaceReachability = (typeof SURFACE_REACHABILITY)[number];

export const SURFACE_PHASES = [
  "primary",
  "flat_tradeoff",
  "flat_action",
  "branch_resulting_world_state",
  "branch_tradeoff",
  "branch_action",
] as const;
export type SurfacePhase = (typeof SURFACE_PHASES)[number];

export type BoundarySurface = {
  /** Stable server-owned coordinate, e.g. `primary[0]`, `branch[1].resulting_world_state`. */
  coordinate: string;
  kind: SurfaceKind;
  phase: SurfacePhase;
  reachability: SurfaceReachability;
  /** True when the learner meets this field on some real path through the player. */
  userReachable: boolean;
  /** True only when the learner can PICK it. A world state is asserted, never chosen. */
  independentlySelectable: boolean;
  /** -1 for the flat phases. */
  branchIndex: number;
  /** Position within its sibling group; -1 for a world state, which has no siblings. */
  index: number;
  /** The coordinate of the primary choice this surface descends from. Empty at the root. */
  parentPrimaryCoordinate: string;
  /** Causal ancestors, nearest-first. Used to derive earliest causal violations. */
  lineage: string[];
  /** The exact generated text being judged. */
  text: string;
  /** The primary choice this surface follows from. Empty for the primary phase itself. */
  selectedPrimaryLabel: string;
  /** The escalation the learner has already read at this point. Context, not a judged surface. */
  branchContext: string;
  /** The resulting world state this surface is premised on. Empty at the root and on world states. */
  inheritedWorldState: string;
  /** True when the choice is a real observable action commitment. False for world states. */
  isActionCommitment: boolean;
  /** The generator's own accepted-cost note for this choice, when one exists. Never invented. */
  acceptedCost: string;
  /** For a compatibility projection: the reachable surface it duplicates, when one exists. */
  compatibilitySource: string;
};

const text = (v: unknown): string => (typeof v === "string" ? v : "");
const list = <T>(v: T[] | undefined | null): T[] => (Array.isArray(v) ? v : []);

export const SURFACE_MAP_CODES = [
  "surface_map_cardinality_mismatch",
  "surface_map_duplicate_coordinate",
  "surface_map_empty_text",
  "boundary_world_state_missing",
  "surface_map_no_reachable_surface",
] as const;
export type SurfaceMapCode = (typeof SURFACE_MAP_CODES)[number];

/**
 * Enumerate every surface, each labelled with how the learner actually reaches it.
 *
 * A branch-aware draft (every generated practice) yields 12 reviewable surfaces and 4 compatibility
 * projections. A legacy flat draft yields 6 reviewable surfaces and no world states — because in
 * that shape the flat fields ARE what the player renders.
 */
export function enumerateBoundarySurfaces(
  draft: ArenaScenarioDraft,
  constructions: Record<string, unknown> = {},
): BoundarySurface[] {
  const cost = (choiceId: string): string => {
    const rec = constructions[choiceId];
    return rec && typeof rec === "object" ? text((rec as Record<string, unknown>).acceptedCost) : "";
  };
  // MEASURED from `ArenaPracticePlayer`: the flat continuation is rendered ONLY when the draft has
  // no branches. This single fact decides which fields carry product authority.
  const branchAware = isBranchAware(draft);
  const out: BoundarySurface[] = [];

  const root = {
    parentPrimaryCoordinate: "",
    lineage: [] as string[],
    inheritedWorldState: "",
    compatibilitySource: "",
  };

  list(draft.primary?.choices).forEach((c, i) =>
    out.push({
      ...root,
      coordinate: `primary[${i}]`,
      kind: "choice",
      phase: "primary",
      reachability: "learner_decision",
      userReachable: true,
      independentlySelectable: true,
      branchIndex: -1,
      index: i,
      text: c.label,
      selectedPrimaryLabel: "",
      branchContext: "",
      isActionCommitment: false,
      acceptedCost: cost(c.id),
    }),
  );

  // --- the flat continuation -------------------------------------------------
  const flatEscalation = text(draft.tradeoff?.escalationText);
  const flatReach: SurfaceReachability = branchAware ? "compatibility_projection" : "learner_decision";
  list(draft.tradeoff?.choices).forEach((c, i) =>
    out.push({
      ...root,
      coordinate: `flat_tradeoff[${i}]`,
      kind: "choice",
      phase: "flat_tradeoff",
      reachability: flatReach,
      userReachable: !branchAware,
      independentlySelectable: !branchAware,
      branchIndex: -1,
      index: i,
      text: c.label,
      selectedPrimaryLabel: "",
      branchContext: flatEscalation,
      isActionCommitment: false,
      acceptedCost: cost(c.id),
      // The branch-specific tradeoff at the same position is what the learner actually gets.
      compatibilitySource: branchAware ? `branch[*].tradeoff[${i}]` : "",
    }),
  );

  list(draft.actionDecision?.choices).forEach((c, i) =>
    out.push({
      ...root,
      coordinate: `flat_action[${i}]`,
      kind: "choice",
      phase: "flat_action",
      reachability: flatReach,
      userReachable: !branchAware,
      independentlySelectable: !branchAware,
      branchIndex: -1,
      index: i,
      text: c.label,
      selectedPrimaryLabel: "",
      branchContext: flatEscalation,
      isActionCommitment: c.isActionCommitment === true,
      acceptedCost: cost(c.id),
      compatibilitySource: branchAware ? `branch[*].action[${i}]` : "",
    }),
  );

  // --- the branch continuations the learner actually walks --------------------
  list(draft.primary?.choices).forEach((p, b) => {
    const branch = draft.branches?.[p.id];
    if (!branch) return;
    const escalation = text(branch.escalationText);
    // R2.30 Part 3 — NO SILENT FALLBACK. An escalation is a new pressure, not a statement of the
    // world the primary choice produced. R2.29 substituted one for the other, which made an
    // unjudgeable surface look judged. Absence is now an AUTHORITY failure, named and refused.
    const world = text(branch.resultingWorldState);
    const parent = `primary[${b}]`;
    const worldCoord = `branch[${b}].resulting_world_state`;

    out.push({
      ...root,
      coordinate: worldCoord,
      kind: "resulting_world_state",
      phase: "branch_resulting_world_state",
      reachability: "generated_state",
      userReachable: true,
      independentlySelectable: false,
      branchIndex: b,
      index: -1,
      parentPrimaryCoordinate: parent,
      lineage: [parent],
      text: world,
      selectedPrimaryLabel: p.label,
      branchContext: escalation,
      isActionCommitment: false,
      acceptedCost: "",
    });

    const descendant = {
      parentPrimaryCoordinate: parent,
      // Nearest-first: the world state the choice happens inside of, then the primary that caused it.
      lineage: [worldCoord, parent],
      inheritedWorldState: world,
      compatibilitySource: "",
      selectedPrimaryLabel: p.label,
      branchContext: escalation,
      branchIndex: b,
      reachability: "learner_decision" as const,
      userReachable: true,
      independentlySelectable: true,
      kind: "choice" as const,
    };

    list(branch.tradeoffChoices).forEach((c, i) =>
      out.push({
        ...descendant,
        coordinate: `branch[${b}].tradeoff[${i}]`,
        phase: "branch_tradeoff",
        index: i,
        text: c.label,
        isActionCommitment: false,
        acceptedCost: cost(c.id),
      }),
    );

    list(branch.actionDecision?.choices).forEach((c, i) =>
      out.push({
        ...descendant,
        coordinate: `branch[${b}].action[${i}]`,
        phase: "branch_action",
        index: i,
        text: c.label,
        isActionCommitment: c.isActionCommitment === true,
        acceptedCost: cost(c.id),
      }),
    );
  });

  return out;
}

/** The surfaces that carry independent product safety authority — everything but compatibility. */
export const reviewableSurfaces = (all: BoundarySurface[]): BoundarySurface[] =>
  all.filter((s) => s.reachability !== "compatibility_projection");

export const compatibilitySurfaces = (all: BoundarySurface[]): BoundarySurface[] =>
  all.filter((s) => s.reachability === "compatibility_projection");

/** Branch-aware: 2 primary + 2 world states + 4 branch tradeoff + 4 branch action. */
export const BRANCH_AWARE_REACHABLE_SURFACE_COUNT = 12;
/** Legacy flat: 2 primary + 2 flat tradeoff + 2 flat action, and no world state exists. */
export const FLAT_REACHABLE_SURFACE_COUNT = 6;

export const surfaceCoordinates = (surfaces: BoundarySurface[]): string[] => surfaces.map((s) => s.coordinate);

/**
 * Digest over the map. Covers coordinates, content AND reachability, so promoting a compatibility
 * projection to a product surface produces a different map — a reviewer answer given under the old
 * authority can never be attributed to the new one.
 */
export function surfaceMapSha256(surfaces: BoundarySurface[]): string {
  const canonical = surfaces.map((s) => ({
    coordinate: s.coordinate,
    kind: s.kind,
    phase: s.phase,
    reachability: s.reachability,
    userReachable: s.userReachable,
    independentlySelectable: s.independentlySelectable,
    branchIndex: s.branchIndex,
    index: s.index,
    parentPrimaryCoordinate: s.parentPrimaryCoordinate,
    lineage: s.lineage,
    text: s.text,
    selectedPrimaryLabel: s.selectedPrimaryLabel,
    branchContext: s.branchContext,
    inheritedWorldState: s.inheritedWorldState,
    isActionCommitment: s.isActionCommitment,
    acceptedCost: s.acceptedCost,
    compatibilitySource: s.compatibilitySource,
  }));
  return createHash("sha256").update(JSON.stringify({ version: SURFACE_MAP_VERSION, surfaces: canonical })).digest("hex");
}

/** Digest over the lineage relation alone, so a re-parented surface is independently detectable. */
export const lineageSha256 = (surfaces: BoundarySurface[]): string =>
  createHash("sha256")
    .update(JSON.stringify({ version: SURFACE_MAP_VERSION, lineage: surfaces.map((s) => [s.coordinate, s.lineage]) }))
    .digest("hex");

/**
 * Prove the map is well-formed BEFORE it is projected into a provider request.
 *
 * A branch-aware draft MUST state a resulting world state per branch. Absence is
 * `boundary_world_state_missing` — an AUTHORITY failure, never a boundary violation.
 */
export function validateSurfaceMap(
  surfaces: BoundarySurface[],
  expected?: { branchAware: boolean; expectedReachable?: number },
): { ok: boolean; codes: SurfaceMapCode[] } {
  const codes: SurfaceMapCode[] = [];
  const reachable = reviewableSurfaces(surfaces);
  if (reachable.length === 0) codes.push("surface_map_no_reachable_surface");

  const seen = new Set<string>();
  for (const s of surfaces) {
    if (seen.has(s.coordinate)) codes.push("surface_map_duplicate_coordinate");
    seen.add(s.coordinate);
    if (s.reachability === "compatibility_projection") continue; // never gates the product
    if (!s.text.trim()) {
      codes.push(s.kind === "resulting_world_state" ? "boundary_world_state_missing" : "surface_map_empty_text");
    }
  }

  if (expected) {
    const want =
      expected.expectedReachable ?? (expected.branchAware ? BRANCH_AWARE_REACHABLE_SURFACE_COUNT : FLAT_REACHABLE_SURFACE_COUNT);
    if (reachable.length !== want) codes.push("surface_map_cardinality_mismatch");
  }
  return { ok: codes.length === 0, codes: [...new Set(codes)] };
}
