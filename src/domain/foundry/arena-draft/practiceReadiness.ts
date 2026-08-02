/**
 * PRACTICE GENERATION READINESS (Slice 3.2I-R5B1A.1-R2.23D).
 *
 * ONE AUTHORITY.
 *
 * R2.23C made generation block when four or more confirmed boundaries exist, and gave the Host no
 * way to resolve it: the setup surface showed a static "not ready yet" message with no boundaries,
 * no selector and no route forward. A fail-closed state that an authorized user cannot clear is a
 * dead end, not a safety property.
 *
 * This resolver is the single place that answers "can this situation be generated, and if not, what
 * exactly does the Host need to do". The setup UI, the readiness copy and the tests all read it, so
 * the screen can never disagree with the server about why generation is unavailable.
 *
 * It never chooses boundaries. It reports which are available, which are active, and what is
 * missing — deciding is the Host's.
 *
 * Pure domain: no I/O, no clock, no randomness.
 */

import type { BoundaryConstraint, PracticeBoundary } from "./boundary";
import { MAX_ACTIVE_BOUNDARIES, resolveActiveBoundaries, validateBoundaryScope, type PracticeBoundaryScope } from "./boundaryScope";

export const READINESS_STATES = [
  /** No confirmed boundary is attached. Generation may proceed. */
  "ready_no_boundaries",
  /**
   * NEW-AUTHORITY draft with no boundary at all (Slice 3.2I-R5B2). The server refuses generation
   * with `boundary_confirmation_required`; the Host must set the boundary before anything else.
   */
  "boundary_confirmation_required",
  /**
   * NEW-AUTHORITY draft carrying a boundary the Host has not confirmed yet. The work is not lost —
   * it simply has no authority until it is confirmed, and the server refuses generation until then.
   */
  "boundary_unconfirmed",
  /** 1-3 confirmed, so every one of them governs this situation. Generation may proceed. */
  "ready_all_available_boundaries_active",
  /** The Host confirmed a subset of a larger set. Generation may proceed. */
  "ready_confirmed_scope",
  /** 4+ confirmed and nothing chosen yet. */
  "boundary_scope_required",
  /** A selection exists but was never confirmed. */
  "boundary_scope_unconfirmed",
  /** The confirmed boundary list moved after the selection was made. */
  "active_boundary_set_changed",
  /** More than three selected. */
  "too_many_active_boundaries",
  /** A selected id is no longer among the confirmed boundaries. */
  "unknown_active_boundary",
] as const;
export type ReadinessState = (typeof READINESS_STATES)[number];

const READY: readonly ReadinessState[] = ["ready_no_boundaries", "ready_all_available_boundaries_active", "ready_confirmed_scope"];
export const isReadyState = (s: ReadinessState): boolean => READY.includes(s);

export type PracticeReadiness = {
  state: ReadinessState;
  canGenerate: boolean;
  /** Every confirmed boundary, exactly as the Manager wrote it. Never reordered or trimmed. */
  available: BoundaryConstraint[];
  /** Those governing THIS situation. Equal to `available` whenever it already fits. */
  active: BoundaryConstraint[];
  /** True when the Host must make an explicit choice (4+ available). */
  selectionRequired: boolean;
  maxActive: number;
  /** True once a stored confirmation exists and still matches the current set. */
  confirmed: boolean;
};

/**
 * Resolve readiness from the CONFIRMED boundary and the stored scope.
 *
 * The server's `resolveActiveBoundaries` remains the authority on what generation receives; this
 * adds the Host-facing distinctions that authority does not need — whether a selection is required,
 * whether one exists but is unconfirmed, and which of the fail-closed reasons applies.
 *
 * `newAuthority` is the draft's lifecycle discriminator (`guided_answers.practiceSetupVersion`).
 * It matters because the server applies a DIFFERENT generation rule to each kind of draft:
 *
 *   NEW-AUTHORITY — `regenerateArenaDraft` refuses with `boundary_confirmation_required` unless a
 *                   boundary exists AND is confirmed. Absence is not permission.
 *   LEGACY        — no discriminator, so the boundary requirement never applies and generation
 *                   falls through to the free-text eligibility contract, exactly as before.
 *
 * Reading only the boundary could not tell those apart, so this resolver reported `canGenerate:
 * true` for a brand-new draft the server would reject — the screen said "ready" while nothing on
 * it could produce a boundary. Passing the discriminator is what closes that gap.
 *
 * INVARIANT: `canGenerate` is true if and only if the server's generation path would accept the
 * current setup (transport and provider availability excluded).
 *
 * The parameter is optional and defaults to the legacy reading, so every existing caller keeps its
 * exact behaviour.
 */
export function resolvePracticeReadiness(
  boundary: PracticeBoundary | null | undefined,
  scope?: PracticeBoundaryScope | null,
  options?: { newAuthority?: boolean },
): PracticeReadiness {
  const newAuthority = options?.newAuthority === true;
  const available = boundary?.confirmed ? boundary.constraints : [];
  const base = {
    available,
    maxActive: MAX_ACTIVE_BOUNDARIES,
    selectionRequired: available.length > MAX_ACTIVE_BOUNDARIES,
  };

  // A new-authority draft without a CONFIRMED boundary is refused by the server. Say so, and say
  // which of the two situations it is, so the surface can name the actual next action.
  if (newAuthority && !boundary?.confirmed) {
    return {
      ...base,
      state: boundary ? "boundary_unconfirmed" : "boundary_confirmation_required",
      canGenerate: false,
      active: [],
      confirmed: false,
    };
  }

  if (available.length === 0) {
    // Either a legacy draft, or a new-authority draft whose CONFIRMED boundary carries no rules —
    // a legitimate, deliberate "nothing every option must obey". The server accepts both.
    return { ...base, state: "ready_no_boundaries", canGenerate: true, active: [], confirmed: false };
  }

  // A set that already fits needs no decision from the Host — every rule is in play.
  if (available.length <= MAX_ACTIVE_BOUNDARIES) {
    const resolved = resolveActiveBoundaries(boundary, scope);
    if (resolved.kind === "active") {
      return { ...base, state: "ready_all_available_boundaries_active", canGenerate: true, active: resolved.constraints, confirmed: false };
    }
    // A stale confirmation from a larger set must not silently narrow one that now fits.
    return { ...base, state: "active_boundary_set_changed", canGenerate: false, active: [], confirmed: false };
  }

  // 4+ — the Host chooses.
  if (!scope) return { ...base, state: "boundary_scope_required", canGenerate: false, active: [], confirmed: false };

  const check = validateBoundaryScope(scope, available);
  if (!check.ok) {
    // Report the most specific reason so the screen can say something true and actionable.
    const state: ReadinessState = check.errors.includes("active_boundary_set_changed")
      ? "active_boundary_set_changed"
      : check.errors.includes("too_many_active_boundaries")
        ? "too_many_active_boundaries"
        : check.errors.includes("unknown_active_boundary")
          ? "unknown_active_boundary"
          : "boundary_scope_required";
    return { ...base, state, canGenerate: false, active: [], confirmed: false };
  }
  if (!scope.confirmed) {
    return {
      ...base,
      state: "boundary_scope_unconfirmed",
      canGenerate: false,
      // The selection survives an unconfirmed state — the Host does not lose their work.
      active: available.filter((c) => scope.activeIds.includes(c.id)),
      confirmed: false,
    };
  }
  return {
    ...base,
    state: "ready_confirmed_scope",
    canGenerate: true,
    active: available.filter((c) => scope.activeIds.includes(c.id)),
    confirmed: true,
  };
}

/** Boundaries available but NOT governing this situation. Shown, never hidden. */
export function inactiveBoundaries(readiness: PracticeReadiness): BoundaryConstraint[] {
  const activeIds = new Set(readiness.active.map((c) => c.id));
  return readiness.available.filter((c) => !activeIds.has(c.id));
}
