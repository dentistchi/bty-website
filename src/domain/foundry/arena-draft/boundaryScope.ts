/**
 * ACTIVE-BOUNDARY SCOPE (Slice 3.2I-R5B1A.1-R2.23C).
 *
 * WHY A LIMIT EXISTS
 *
 * One Practice situation rehearses judgment inside the rules that are actually in play. Every
 * active rule has to be established in the scene, has to visibly constrain both options, has to
 * survive independently at every phase, and has to leave real judgment behind — and two options
 * that stay inside ten simultaneous non-negotiables are not a rehearsal, they are a compliance
 * quiz. Three is the point at which a situation still teaches something.
 *
 * The measured budget agrees, but it is not the reason: the product reason is that a situation with
 * more active rules than a person can hold has stopped being a situation.
 *
 * WHAT IT IS NOT
 *
 * It bounds ONE generated situation. It does not bound the organization, the training module, the
 * Manager's confirmed rule set, or anything already generated or persisted. A module with eight
 * confirmed rules is legitimate — it becomes several Practice situations, each rehearsing a
 * different subset, with every unselected rule preserved untouched.
 *
 * NO SILENT SELECTION. With four or more available, generation BLOCKS and the Host chooses. The
 * system never picks a first three, never merges rules, never summarises them, and never quietly
 * drops one. A boundary the Manager confirmed is not something software may decide to ignore.
 *
 * Pure domain: no I/O, no clock, no randomness.
 */

import type { BoundaryConstraint, PracticeBoundary } from "./boundary";

/** Active confirmed boundaries per generated Practice situation. */
export const MAX_ACTIVE_BOUNDARIES = 3;

/**
 * Host setup outcomes. These are SETUP states, not generation results — none of them means the
 * situation has no safe judgment space; they mean the Host has not finished scoping it.
 */
export const BOUNDARY_SCOPE_CODES = [
  "practice_boundary_scope_required",
  "too_many_active_boundaries",
  "unknown_active_boundary",
  "missing_required_active_boundary",
  "active_boundary_set_changed",
  "boundary_scope_not_confirmed",
] as const;
export type BoundaryScopeCode = (typeof BOUNDARY_SCOPE_CODES)[number];

/**
 * The Host's scoping decision, stored inside the existing versioned guided-answers JSON. No
 * migration: `guided_answers` is JSONB and already carries `practiceSetupVersion`.
 */
export type PracticeBoundaryScope = {
  /** Every confirmed boundary id available when the Host chose. */
  availableIds: string[];
  /** The 0-3 the Host activated for THIS situation. */
  activeIds: string[];
  confirmed: boolean;
  /**
   * Fingerprint of the available set at confirmation time. If the Manager later adds, removes or
   * edits a rule, the fingerprint moves and the scoping must be reconfirmed — a selection made
   * against a different rule set is not a decision about this one.
   */
  availableKey: string;
};

/**
 * Order-independent fingerprint of an available boundary set, including each statement — so an
 * EDITED rule invalidates a confirmation just as an added or removed one does. Deterministic and
 * pure; no hashing primitive needed for a change detector.
 */
export function availableSetKey(constraints: BoundaryConstraint[]): string {
  return constraints
    .map((c) => `${c.id}${c.statement.trim().toLowerCase().replace(/\s+/g, " ")}`)
    .sort()
    .join("");
}

export type ScopeResolution =
  | { kind: "active"; constraints: BoundaryConstraint[]; activeIds: string[] }
  | { kind: "scope_required"; code: BoundaryScopeCode; availableIds: string[]; maxActive: number };

/**
 * Resolve which confirmed boundaries are ACTIVE for this generation.
 *
 * 0 available  → generation proceeds with none active.
 * 1-3 available → all are active. None may be silently omitted, and no scoping step is imposed on
 *                 the Host for a set that already fits.
 * 4+ available → BLOCK until the Host has explicitly chosen 1-3.
 *
 * Fail-closed on every disagreement between the stored scope and the current rule set.
 */
export function resolveActiveBoundaries(boundary: PracticeBoundary | null | undefined, scope?: PracticeBoundaryScope | null): ScopeResolution {
  const available = boundary?.constraints ?? [];
  const availableIds: string[] = available.map((c) => c.id);

  if (available.length === 0) return { kind: "active", constraints: [], activeIds: [] };

  // A set that already fits needs no decision — every confirmed rule is in play.
  if (available.length <= MAX_ACTIVE_BOUNDARIES) {
    if (scope?.confirmed) {
      // A stale confirmation must not silently narrow a set that now fits.
      const check = validateBoundaryScope(scope, available);
      if (!check.ok) return { kind: "scope_required", code: check.errors[0] as BoundaryScopeCode, availableIds, maxActive: MAX_ACTIVE_BOUNDARIES };
      const active = available.filter((c) => scope.activeIds.includes(c.id));
      // Even a confirmed narrower scope may not drop a rule from a set that fits whole.
      if (active.length !== available.length) {
        return { kind: "scope_required", code: "missing_required_active_boundary", availableIds, maxActive: MAX_ACTIVE_BOUNDARIES };
      }
    }
    return { kind: "active", constraints: available, activeIds: available.map((c) => c.id) };
  }

  // 4+ — the Host must choose. Never a default, never the first three.
  if (!scope || !scope.confirmed) {
    return { kind: "scope_required", code: scope ? "boundary_scope_not_confirmed" : "practice_boundary_scope_required", availableIds, maxActive: MAX_ACTIVE_BOUNDARIES };
  }
  const check = validateBoundaryScope(scope, available);
  if (!check.ok) return { kind: "scope_required", code: check.errors[0] as BoundaryScopeCode, availableIds, maxActive: MAX_ACTIVE_BOUNDARIES };

  const active = available.filter((c) => scope.activeIds.includes(c.id));
  return { kind: "active", constraints: active, activeIds: active.map((c) => c.id) };
}

export type ScopeValidation = { ok: boolean; errors: BoundaryScopeCode[] };

/** Validate a stored scope against the CURRENT confirmed rule set. Fail-closed. */
export function validateBoundaryScope(scope: PracticeBoundaryScope, available: BoundaryConstraint[]): ScopeValidation {
  const errors: BoundaryScopeCode[] = [];
  const availableIds = new Set(available.map((c) => c.id));

  if (scope.availableKey !== availableSetKey(available)) errors.push("active_boundary_set_changed");
  if (scope.activeIds.length > MAX_ACTIVE_BOUNDARIES) errors.push("too_many_active_boundaries");
  for (const id of scope.activeIds) if (!availableIds.has(id)) errors.push("unknown_active_boundary");
  // A scoped situation with rules available but none selected has not been scoped.
  if (available.length > 0 && scope.activeIds.length === 0) errors.push("missing_required_active_boundary");
  if (new Set(scope.activeIds).size !== scope.activeIds.length) errors.push("unknown_active_boundary");

  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

/**
 * Build the scope a Host selection produces. Rejects rather than repairs: an out-of-range or
 * unknown selection is the Host's to correct, never software's to silently trim.
 */
export function buildBoundaryScope(available: BoundaryConstraint[], selectedIds: string[]): { ok: true; value: PracticeBoundaryScope } | { ok: false; errors: BoundaryScopeCode[] } {
  const scope: PracticeBoundaryScope = {
    availableIds: available.map((c) => c.id),
    activeIds: [...selectedIds],
    confirmed: true,
    availableKey: availableSetKey(available),
  };
  const check = validateBoundaryScope(scope, available);
  return check.ok ? { ok: true, value: scope } : { ok: false, errors: check.errors };
}

/** Rules NOT active in this situation. They are preserved untouched for another one. */
export function unselectedBoundaries(available: BoundaryConstraint[], scope?: PracticeBoundaryScope | null): BoundaryConstraint[] {
  if (!scope?.confirmed) return [];
  return available.filter((c) => !scope.activeIds.includes(c.id));
}
