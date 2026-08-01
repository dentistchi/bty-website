/**
 * THE BROAD SEMANTIC-REVIEW REQUEST PROJECTION (Slice 3.2I-R5B1A.1-R2.29 Part 15).
 *
 * THE MEASURED DEFECT (R2.28)
 *
 * Production built its reviewer payload with `activeBoundaryCount` and `boundaryComplianceScope`.
 * The replay path built its own payload without them — and `boundaryComplianceScope` is the ONLY
 * string in the entire contract that says "and every resulting world state". So the corrected c18
 * replay measured a WEAKER request than production, and its accept could not be attributed to the
 * production contract.
 *
 * The repair is structural rather than duplicated: ONE builder, used by production and by replay.
 * Parity is then provable by construction and pinned by a test, instead of maintained by discipline.
 *
 * The projection is unchanged for production — same keys, same values, same serialization. Only the
 * replay path gains what it was missing.
 */

import { enumerateChoices } from "@/domain/foundry/arena-draft/choiceConstruction";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";

/** The scope sentence. Empty active set and non-empty are deliberately different statements. */
export function broadBoundaryComplianceScope(activeBoundaryCount: number): string {
  return activeBoundaryCount === 0
    ? "No confirmed boundary applies to this case."
    : "Every primary, tradeoff and action choice — and every resulting world state — must comply with EVERY boundary listed in `constraints`. Return exactly one boundaryAssessment per listed id.";
}

export type BroadReviewRequest = {
  constraints: Array<{ id: string; statement: string }>;
  activeBoundaryCount: number;
  boundaryComplianceScope: string;
  visibleChoices: Array<{ phase: string; branchIndex: number; choiceIndex: number; label: string; construction: unknown }>;
  opening: string;
  primary: unknown;
  branches: Record<string, { escalation: string; tradeoff: unknown; action: unknown }>;
  flatTradeoff: unknown;
  flatAction: unknown;
};

/**
 * Build the broad reviewer's user payload.
 *
 * `constructions` is the generator's per-choice record; the replay path has none and passes `{}`,
 * which yields `construction: null` exactly as the replay did before — the reviewer is still told to
 * confirm or dispute a record, and correctly receives "there was none".
 */
export function buildBroadReviewRequest(
  draft: ArenaScenarioDraft,
  boundaries: Array<{ id: string; statement: string }>,
  constructions: Record<string, unknown> = {},
): BroadReviewRequest {
  const activeBoundaries = boundaries.map((c) => ({ id: c.id, statement: c.statement }));
  return {
    constraints: activeBoundaries,
    activeBoundaryCount: activeBoundaries.length,
    boundaryComplianceScope: broadBoundaryComplianceScope(activeBoundaries.length),
    visibleChoices: enumerateChoices(draft).map((c) => ({
      phase: c.phase,
      branchIndex: c.branchIndex,
      choiceIndex: c.index,
      label: c.label,
      construction: constructions[c.id] ?? null,
    })),
    opening: draft.opening,
    primary: draft.primary.choices,
    branches: Object.fromEntries(
      Object.entries(draft.branches ?? {}).map(([k, b]) => [
        k,
        { escalation: b.escalationText, tradeoff: b.tradeoffChoices, action: b.actionDecision.choices },
      ]),
    ),
    flatTradeoff: draft.tradeoff.choices,
    flatAction: draft.actionDecision.choices,
  };
}

/** The exact serialization both callers send. Parity means identical bytes, not merely equal keys. */
export const serializeBroadReviewRequest = (r: BroadReviewRequest): string => JSON.stringify(r);
