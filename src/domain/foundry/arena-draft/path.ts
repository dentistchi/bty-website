/**
 * Foundry Practice — selected-path validation (pure) [Slice 3.2I].
 *
 * The learner's decision path (which PRIMARY branch, then which TRADEOFF and ACTION
 * choice) is truthful behavioral evidence. The SERVER must never trust client-supplied
 * ids: this validates a submitted path against the authoritative published scenario
 * snapshot, fail-closed. For a branch-aware scenario the tradeoff/action ids must belong
 * to the SELECTED primary's branch; for a legacy flat scenario they come from the shared
 * continuation. Phases are monotonic (action requires a tradeoff, tradeoff requires a
 * primary). No DB, no I/O.
 */

import { isBranchAware, type ArenaScenarioDraft, type SelectedPath } from "./types";

export type PathInput = {
  primaryChoiceId?: string;
  tradeoffChoiceId?: string;
  actionChoiceId?: string;
};

export type PathValidation = { ok: true; value: SelectedPath } | { ok: false; reason: string };

/** The tradeoff + action choice-id sets valid for a given primary choice, or null. */
function branchChoiceIds(
  scenario: ArenaScenarioDraft,
  primaryChoiceId: string,
): { tradeoff: Set<string>; action: Set<string> } | null {
  const primaryIds = new Set(scenario.primary.choices.map((c) => c.id));
  if (!primaryIds.has(primaryChoiceId)) return null;
  if (isBranchAware(scenario)) {
    const b = scenario.branches[primaryChoiceId];
    if (!b) return null; // fail-closed: a branch-aware scenario missing this branch is corrupt
    return {
      tradeoff: new Set(b.tradeoffChoices.map((c) => c.id)),
      action: new Set(b.actionDecision.choices.map((c) => c.id)),
    };
  }
  return {
    tradeoff: new Set(scenario.tradeoff.choices.map((c) => c.id)),
    action: new Set(scenario.actionDecision.choices.map((c) => c.id)),
  };
}

/**
 * Validate a submitted (cumulative) path against the scenario. Fail-closed on unknown
 * primary, cross-branch tradeoff/action, or out-of-order phases.
 */
export function validateSelectedPath(scenario: ArenaScenarioDraft, input: PathInput): PathValidation {
  const pid = input.primaryChoiceId;
  if (typeof pid !== "string" || pid.trim().length === 0) return { ok: false, reason: "primary_required" };
  const ids = branchChoiceIds(scenario, pid);
  if (!ids) return { ok: false, reason: "unknown_primary" };

  const out: SelectedPath = { v: 1, primaryChoiceId: pid };

  if (input.tradeoffChoiceId !== undefined) {
    if (!ids.tradeoff.has(input.tradeoffChoiceId)) return { ok: false, reason: "tradeoff_not_in_branch" };
    out.tradeoffChoiceId = input.tradeoffChoiceId;
  }
  if (input.actionChoiceId !== undefined) {
    if (out.tradeoffChoiceId === undefined) return { ok: false, reason: "phase_order" };
    if (!ids.action.has(input.actionChoiceId)) return { ok: false, reason: "action_not_in_branch" };
    out.actionChoiceId = input.actionChoiceId;
  }
  return { ok: true, value: out };
}

/**
 * Merge a validated incoming path onto the stored one. The primary choice is fixed for
 * the life of a run (a fresh Primary requires a fresh run/retry, not a mutation). Phases
 * only advance — a later write may not drop an id an earlier write recorded.
 */
export function mergeSelectedPath(existing: SelectedPath | null, incoming: SelectedPath): PathValidation {
  if (existing) {
    if (existing.primaryChoiceId !== incoming.primaryChoiceId) return { ok: false, reason: "primary_changed" };
    if (existing.tradeoffChoiceId !== undefined && incoming.tradeoffChoiceId === undefined) {
      return { ok: false, reason: "phase_regression" };
    }
    if (existing.actionChoiceId !== undefined && incoming.actionChoiceId === undefined) {
      return { ok: false, reason: "phase_regression" };
    }
  }
  return { ok: true, value: incoming };
}

/** Coerce an untrusted stored value into a SelectedPath, or null if not a valid shape. */
export function coerceStoredPath(raw: unknown): SelectedPath | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1 || typeof r.primaryChoiceId !== "string" || r.primaryChoiceId.length === 0) return null;
  const out: SelectedPath = { v: 1, primaryChoiceId: r.primaryChoiceId };
  if (typeof r.tradeoffChoiceId === "string" && r.tradeoffChoiceId.length > 0) out.tradeoffChoiceId = r.tradeoffChoiceId;
  if (typeof r.actionChoiceId === "string" && r.actionChoiceId.length > 0) out.actionChoiceId = r.actionChoiceId;
  return out;
}
