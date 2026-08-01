/**
 * CANONICAL DECISION-SURFACE MAP (Slice 3.2I-R5B1A.1-R2.29).
 *
 * THE MEASURED DEFECT (R2.28)
 *
 * The broad semantic reviewer received `c1_verify` — "Two identifiers must be verified before
 * treatment" — recognised the violation in eight separate free-text fields ("One patient is treated
 * without verification, risking safety"), and then returned ONE aggregate boundary assessment whose
 * four booleans all said comply. `boundaryCompliant: true`, `violatedBoundaryIds: []`,
 * `overallVerdict: accept`, derived boundary defects `[]`. Every derivation reads booleans; none
 * reads prose; so the violation was invisible to the server.
 *
 * The structural cause: FOUR booleans were asked to carry FOURTEEN choices, and NOTHING at all
 * carried the two resulting world states — which is exactly where the clearest evidence sat.
 *
 * THIS MODULE
 *
 * The server — never the model — enumerates every place a confirmed boundary can be honoured or
 * broken, and names each one with a stable coordinate. The narrow boundary reviewer then answers
 * one question per (boundary × surface) pair. It cannot invent a coordinate, cannot omit one, and
 * cannot collapse sixteen judgments into one assertion.
 *
 * A resulting world state is a first-class surface. It is not a choice the learner makes, but it IS
 * a state the scenario asserts, and a boundary can be broken by a state as surely as by an action.
 *
 * Pure domain: no I/O, no provider, no DB, no clock.
 */

import { createHash } from "node:crypto";
import type { ArenaScenarioDraft } from "./types";

/** Versioned: a change to coordinate construction is a contract change, and must be visible. */
export const SURFACE_MAP_VERSION = "practice-boundary-surface-map/1";

/**
 * A surface is either something the learner PICKS, or a state the scenario ASSERTS. The distinction
 * matters for evidence: a choice is judged on what it commits the learner to, a world state on what
 * it says has already happened.
 */
export const SURFACE_KINDS = ["choice", "resulting_world_state"] as const;
export type SurfaceKind = (typeof SURFACE_KINDS)[number];

export const SURFACE_PHASES = [
  "primary",
  "flat_tradeoff",
  "flat_action",
  "branch_resulting_world_state",
  "branch_tradeoff",
  "branch_action",
] as const;
export type SurfacePhase = (typeof SURFACE_PHASES)[number];

/**
 * One boundary-judgeable surface, with the minimum scenario text needed to judge it.
 *
 * Deliberately NOT included: construction metadata, generator rationale, sibling comparisons,
 * urgency records. Those belong to the broad reviewer's contracts and would only give the narrow
 * reviewer more ways to answer a different question than the one it was asked.
 */
export type BoundarySurface = {
  /** Stable server-owned coordinate, e.g. `primary[0]`, `branch[1].resulting_world_state`. */
  coordinate: string;
  kind: SurfaceKind;
  phase: SurfacePhase;
  /** -1 for the flat phases. */
  branchIndex: number;
  /** Position within its sibling group; -1 for a world state, which has no siblings. */
  index: number;
  /** The learner-facing text being judged: a choice label, or the resulting-world-state sentence. */
  text: string;
  /** The primary choice this surface follows from. Empty for the primary phase itself. */
  selectedPrimaryLabel: string;
  /** The branch escalation the learner has already read at this point. Empty for flat phases. */
  branchContext: string;
  /** True when the choice is a real observable action commitment. False for world states. */
  isActionCommitment: boolean;
  /** The generator's own accepted-cost note for this choice, when one exists. Never invented. */
  acceptedCost: string;
};

const text = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * Enumerate every boundary-judgeable surface in canonical order.
 *
 * The order IS part of the contract: primary, flat tradeoff, flat action, then each branch in
 * primary-choice order — world state first, because the state is what the later choices happen
 * inside of, then tradeoff, then action.
 *
 * `constructions` is the generator's per-choice record, keyed by choice id. Only `acceptedCost` is
 * read from it; everything else in that record is irrelevant to boundary compliance.
 */
export function enumerateBoundarySurfaces(
  draft: ArenaScenarioDraft,
  constructions: Record<string, unknown> = {},
): BoundarySurface[] {
  const cost = (choiceId: string): string => {
    const rec = constructions[choiceId];
    return rec && typeof rec === "object" ? text((rec as Record<string, unknown>).acceptedCost) : "";
  };

  const out: BoundarySurface[] = [];
  // Defensive: a structurally broken draft must FAIL CLOSED at `validateSurfaceMap`, not throw
  // partway through enumeration. A thrown error here would surface as an unclassified crash rather
  // than a named authority failure, and the stage would lose the reason it refused.
  const list = <T>(v: T[] | undefined | null): T[] => (Array.isArray(v) ? v : []);

  list(draft.primary?.choices).forEach((c, i) =>
    out.push({
      coordinate: `primary[${i}]`,
      kind: "choice",
      phase: "primary",
      branchIndex: -1,
      index: i,
      text: c.label,
      selectedPrimaryLabel: "",
      branchContext: "",
      isActionCommitment: false,
      acceptedCost: cost(c.id),
    }),
  );

  list(draft.tradeoff?.choices).forEach((c, i) =>
    out.push({
      coordinate: `flat_tradeoff[${i}]`,
      kind: "choice",
      phase: "flat_tradeoff",
      branchIndex: -1,
      index: i,
      text: c.label,
      selectedPrimaryLabel: "",
      branchContext: text(draft.tradeoff?.escalationText),
      isActionCommitment: false,
      acceptedCost: cost(c.id),
    }),
  );

  list(draft.actionDecision?.choices).forEach((c, i) =>
    out.push({
      coordinate: `flat_action[${i}]`,
      kind: "choice",
      phase: "flat_action",
      branchIndex: -1,
      index: i,
      text: c.label,
      selectedPrimaryLabel: "",
      branchContext: text(draft.tradeoff?.escalationText),
      isActionCommitment: c.isActionCommitment === true,
      acceptedCost: cost(c.id),
    }),
  );

  // Branch order follows the primary-choice order — that ordering IS the branch relationship.
  list(draft.primary?.choices).forEach((p, b) => {
    const branch = draft.branches?.[p.id];
    if (!branch) return;
    const escalation = text(branch.escalationText);
    // The state the scenario ASSERTS after this primary choice. `resultingWorldState` states it
    // directly; when a draft omits it, the branch escalation IS the post-choice world the learner
    // reads, and judging that is strictly better than judging nothing. Only when BOTH are empty is
    // there no state to judge, and `validateSurfaceMap` then refuses the map.
    const stated = text(branch.resultingWorldState);
    const world = stated.trim() ? stated : escalation;

    out.push({
      coordinate: `branch[${b}].resulting_world_state`,
      kind: "resulting_world_state",
      phase: "branch_resulting_world_state",
      branchIndex: b,
      index: -1,
      text: world,
      selectedPrimaryLabel: p.label,
      branchContext: escalation,
      isActionCommitment: false,
      acceptedCost: "",
    });

    list(branch.tradeoffChoices).forEach((c, i) =>
      out.push({
        coordinate: `branch[${b}].tradeoff[${i}]`,
        kind: "choice",
        phase: "branch_tradeoff",
        branchIndex: b,
        index: i,
        text: c.label,
        selectedPrimaryLabel: p.label,
        branchContext: world || escalation,
        isActionCommitment: false,
        acceptedCost: cost(c.id),
      }),
    );

    list(branch.actionDecision?.choices).forEach((c, i) =>
      out.push({
        coordinate: `branch[${b}].action[${i}]`,
        kind: "choice",
        phase: "branch_action",
        branchIndex: b,
        index: i,
        text: c.label,
        selectedPrimaryLabel: p.label,
        branchContext: world || escalation,
        isActionCommitment: c.isActionCommitment === true,
        acceptedCost: cost(c.id),
      }),
    );
  });

  return out;
}

/**
 * The canonical surface count for the GENERATED cardinality (2 primary × 2 branches, 2 tradeoff and
 * 2 action choices flat and per branch, plus one world state per branch).
 *
 *   2 primary + 2 flat tradeoff + 2 flat action + 2 × (1 world state + 2 tradeoff + 2 action) = 16
 */
export const CANONICAL_SURFACE_COUNT = 16;

export const surfaceCoordinates = (surfaces: BoundarySurface[]): string[] => surfaces.map((s) => s.coordinate);

/**
 * Digest over the surface map. Covers coordinates AND content, so a mutated choice label produces a
 * different map even though the coordinates are unchanged — a reviewer answer about the old text can
 * never be attributed to the new text.
 */
export function surfaceMapSha256(surfaces: BoundarySurface[]): string {
  const canonical = surfaces.map((s) => ({
    coordinate: s.coordinate,
    kind: s.kind,
    phase: s.phase,
    branchIndex: s.branchIndex,
    index: s.index,
    text: s.text,
    selectedPrimaryLabel: s.selectedPrimaryLabel,
    branchContext: s.branchContext,
    isActionCommitment: s.isActionCommitment,
    acceptedCost: s.acceptedCost,
  }));
  return createHash("sha256")
    .update(JSON.stringify({ version: SURFACE_MAP_VERSION, surfaces: canonical }))
    .digest("hex");
}

export const SURFACE_MAP_CODES = [
  "surface_map_cardinality_mismatch",
  "surface_map_duplicate_coordinate",
  "surface_map_empty_text",
  "surface_map_missing_world_state",
] as const;
export type SurfaceMapCode = (typeof SURFACE_MAP_CODES)[number];

/**
 * Prove the map is well-formed BEFORE it is projected into a provider request. A duplicate or empty
 * coordinate would make coverage checking meaningless, and an empty world state would ask the
 * reviewer to judge nothing while looking like a real question.
 */
export function validateSurfaceMap(surfaces: BoundarySurface[], expectedCount = CANONICAL_SURFACE_COUNT): { ok: boolean; codes: SurfaceMapCode[] } {
  const codes: SurfaceMapCode[] = [];
  if (surfaces.length !== expectedCount) codes.push("surface_map_cardinality_mismatch");
  const seen = new Set<string>();
  for (const s of surfaces) {
    if (seen.has(s.coordinate)) codes.push("surface_map_duplicate_coordinate");
    seen.add(s.coordinate);
    if (!s.text.trim()) {
      codes.push(s.kind === "resulting_world_state" ? "surface_map_missing_world_state" : "surface_map_empty_text");
    }
  }
  return { ok: codes.length === 0, codes: [...new Set(codes)] };
}
