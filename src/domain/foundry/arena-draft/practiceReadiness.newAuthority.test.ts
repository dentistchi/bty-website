/**
 * READINESS IS HONEST ABOUT NEW-AUTHORITY DRAFTS (Slice 3.2I-R5B2).
 *
 * 3.2J stopped before deployment on a measured contradiction: `regenerateArenaDraft` refuses a
 * NEW-AUTHORITY draft with `boundary_confirmation_required` unless a boundary is confirmed, while
 * this resolver reported `ready_no_boundaries` / `canGenerate: true` for exactly that draft. The
 * setup screen therefore said "Ready to create this practice situation" with nothing on it able to
 * produce a boundary.
 *
 * The fix moves the CLIENT toward the server, never the reverse. These tests pin both halves:
 *
 *   1. the new states exist and are reachable;
 *   2. LEGACY behaviour is byte-for-byte what it was (the discriminator defaults to absent);
 *   3. the invariant — for a new-authority draft, `canGenerate` is true if and only if the server
 *      would accept the setup — asserted against a model of the ACTUAL server rule rather than
 *      against the resolver's own reasoning.
 */

import { describe, it, expect } from "vitest";
import { resolvePracticeReadiness } from "./practiceReadiness";
import { availableSetKey, resolveActiveBoundaries, type PracticeBoundaryScope } from "./boundaryScope";
import type { BoundaryConstraint, PracticeBoundary } from "./boundary";

const rule = (n: number): BoundaryConstraint => ({
  id: `c${n}_rule`,
  statement: `Never skip step ${n} before acting.`,
  provenance: "manager_entered",
});
const rules = (n: number): BoundaryConstraint[] => Array.from({ length: n }, (_, i) => rule(i + 1));

const boundary = (n: number, confirmed: boolean): PracticeBoundary => ({
  mode: n > 0 ? "judgment_with_constraints" : "judgment",
  confirmed,
  constraints: rules(n),
});
/** Built through the canonical key helper so a valid scope is genuinely valid, not merely shaped right. */
const scope = (ids: string[], confirmed: boolean, available: BoundaryConstraint[]): PracticeBoundaryScope => ({
  activeIds: ids,
  availableIds: available.map((c) => c.id),
  availableKey: availableSetKey(available),
  confirmed,
});

/**
 * The server's ACTUAL generation rule, transcribed from the two places that own it:
 *
 *   foundryArenaDraftService.regenerateArenaDraft — a new-authority draft without a confirmed
 *     boundary is refused outright;
 *   arenaScenarioGenerationService — a confirmed `judgment` boundary generates with no constraints
 *     and never consults the scope; a confirmed `judgment_with_constraints` boundary must resolve
 *     to an ACTIVE set or it declines.
 */
function serverWouldAccept(b: PracticeBoundary | undefined, s: PracticeBoundaryScope | undefined): boolean {
  if (!b || !b.confirmed) return false; // new-authority: boundary_confirmation_required
  if (b.mode === "judgment") return true; // a positive "no rule constrains this"
  return resolveActiveBoundaries(b, s ?? null).kind === "active";
}

describe("[R5B2] a new-authority draft cannot claim readiness it does not have", () => {
  it("no boundary at all → boundary_confirmation_required, generation unavailable", () => {
    const r = resolvePracticeReadiness(undefined, null, { newAuthority: true });
    expect(r.state).toBe("boundary_confirmation_required");
    expect(r.canGenerate).toBe(false);
  });

  it("a boundary the Host has not confirmed → boundary_unconfirmed, generation unavailable", () => {
    const r = resolvePracticeReadiness(boundary(2, false), null, { newAuthority: true });
    expect(r.state).toBe("boundary_unconfirmed");
    expect(r.canGenerate).toBe(false);
    // The work is not lost, but it carries no authority either.
    expect(r.available).toEqual([]);
    expect(r.confirmed).toBe(false);
  });

  it("a CONFIRMED boundary with no rules is a real decision, and generation proceeds", () => {
    // The server maps this to `judgment` and generates with an empty constraint list.
    const r = resolvePracticeReadiness(boundary(0, true), null, { newAuthority: true });
    expect(r.state).toBe("ready_no_boundaries");
    expect(r.canGenerate).toBe(true);
  });

  it.each([1, 2, 3])("a confirmed boundary with %i rule(s) needs no further decision", (n) => {
    const r = resolvePracticeReadiness(boundary(n, true), null, { newAuthority: true });
    expect(r.state).toBe("ready_all_available_boundaries_active");
    expect(r.canGenerate).toBe(true);
    expect(r.selectionRequired).toBe(false);
    expect(r.available).toHaveLength(n);
  });

  it("4+ confirmed rules still require the Host's scope decision", () => {
    const r = resolvePracticeReadiness(boundary(4, true), null, { newAuthority: true });
    expect(r.state).toBe("boundary_scope_required");
    expect(r.canGenerate).toBe(false);
    expect(r.selectionRequired).toBe(true);
  });

  it("4+ confirmed rules with a valid confirmed scope become ready", () => {
    const b = boundary(4, true);
    const ids = b.constraints.map((c) => c.id);
    const r = resolvePracticeReadiness(b, scope(ids.slice(0, 3), true, b.constraints), { newAuthority: true });
    expect(r.state).toBe("ready_confirmed_scope");
    expect(r.canGenerate).toBe(true);
  });
});

describe("[R5B2] LEGACY drafts are untouched", () => {
  it("the discriminator defaults to absent — the old reading is preserved exactly", () => {
    // Identical inputs, no options object: the pre-R5B2 answer, unchanged.
    expect(resolvePracticeReadiness(undefined, null).state).toBe("ready_no_boundaries");
    expect(resolvePracticeReadiness(undefined, null).canGenerate).toBe(true);
    expect(resolvePracticeReadiness(boundary(2, false), null).state).toBe("ready_no_boundaries");
    expect(resolvePracticeReadiness(boundary(2, false), null).canGenerate).toBe(true);
  });

  it("an explicit newAuthority:false reads exactly like omitting it", () => {
    for (const b of [undefined, boundary(0, true), boundary(2, false), boundary(2, true), boundary(4, true)]) {
      expect(resolvePracticeReadiness(b, null, { newAuthority: false })).toEqual(resolvePracticeReadiness(b, null));
    }
  });

  it("the new states are unreachable without the discriminator", () => {
    for (const b of [undefined, boundary(0, false), boundary(2, false), boundary(4, false)]) {
      const s = resolvePracticeReadiness(b, null).state;
      expect(s).not.toBe("boundary_confirmation_required");
      expect(s).not.toBe("boundary_unconfirmed");
    }
  });
});

describe("[R5B2] INVARIANT — canGenerate agrees with the server, case for case", () => {
  const cases: Array<[string, PracticeBoundary | undefined, PracticeBoundaryScope | undefined]> = [];
  for (const n of [0, 1, 3, 4, 6]) {
    for (const confirmed of [true, false]) {
      const b = boundary(n, confirmed);
      const ids = b.constraints.map((c) => c.id);
      cases.push([`n=${n} confirmed=${confirmed} no-scope`, b, undefined]);
      if (n > 0) {
        cases.push([`n=${n} confirmed=${confirmed} scope-unconfirmed`, b, scope(ids.slice(0, 3), false, b.constraints)]);
        cases.push([`n=${n} confirmed=${confirmed} scope-confirmed`, b, scope(ids.slice(0, 3), true, b.constraints)]);
        cases.push([`n=${n} confirmed=${confirmed} scope-stale`, b, scope(["gone"], true, [rule(99)])]);
      }
    }
  }
  cases.push(["no boundary", undefined, undefined]);

  it.each(cases)("%s", (_label, b, s) => {
    const r = resolvePracticeReadiness(b, s ?? null, { newAuthority: true });
    expect(r.canGenerate).toBe(serverWouldAccept(b, s));
  });

  it("covers both outcomes, so the invariant is not vacuously satisfied", () => {
    const results = cases.map(([, b, s]) => resolvePracticeReadiness(b, s ?? null, { newAuthority: true }).canGenerate);
    expect(results).toContain(true);
    expect(results).toContain(false);
  });
});
