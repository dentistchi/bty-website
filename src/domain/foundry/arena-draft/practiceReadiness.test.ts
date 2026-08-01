import { describe, it, expect } from "vitest";
import { READINESS_STATES, inactiveBoundaries, isReadyState, resolvePracticeReadiness } from "./practiceReadiness";
import { buildBoundaryScope, resolveActiveBoundaries } from "./boundaryScope";
import type { BoundaryConstraint, PracticeBoundary } from "./boundary";

/**
 * CANONICAL GENERATION-READINESS AUTHORITY (Slice 3.2I-R5B1A.1-R2.23D).
 *
 * One resolver answers "can this be generated, and if not, what must the Host do". The setup screen
 * and the tests read it, and it agrees with `resolveActiveBoundaries` — the server's authority on
 * what generation actually receives — by construction rather than by convention.
 */

const rule = (n: number): BoundaryConstraint => ({ id: `c${n}_rule`, statement: `Rule ${n} must hold`, provenance: "manager_entered" });
const rules = (n: number) => Array.from({ length: n }, (_, i) => rule(i + 1));
const boundary = (n: number): PracticeBoundary => ({ mode: "judgment_with_constraints", confirmed: true, constraints: rules(n) });
const confirmed = (n: number, ids: string[]) => {
  const b = buildBoundaryScope(rules(n), ids);
  if (!b.ok) throw new Error(`fixture: ${b.errors.join(",")}`);
  return b.value;
};

describe("the eight structured states", () => {
  it("names exactly the contract's states, three of which are ready", () => {
    expect(READINESS_STATES).toHaveLength(8);
    expect(READINESS_STATES.filter(isReadyState)).toEqual([
      "ready_no_boundaries",
      "ready_all_available_boundaries_active",
      "ready_confirmed_scope",
    ]);
  });

  it("ready_no_boundaries — nothing confirmed, generation proceeds", () => {
    const r = resolvePracticeReadiness({ mode: "judgment", confirmed: true, constraints: [] });
    expect([r.state, r.canGenerate, r.selectionRequired]).toEqual(["ready_no_boundaries", true, false]);
  });

  it("an UNCONFIRMED manager boundary contributes nothing — it is not yet authority", () => {
    const r = resolvePracticeReadiness({ mode: "judgment_with_constraints", confirmed: false, constraints: rules(5) });
    expect(r.state).toBe("ready_no_boundaries");
    expect(r.available).toEqual([]);
  });

  it.each([1, 2, 3])("ready_all_available_boundaries_active — %i confirmed, all active, no decision asked", (n) => {
    const r = resolvePracticeReadiness(boundary(n));
    expect(r.state).toBe("ready_all_available_boundaries_active");
    expect(r.canGenerate).toBe(true);
    expect(r.selectionRequired).toBe(false);
    expect(r.active).toHaveLength(n);
  });

  it("boundary_scope_required — 4+ confirmed with no selection", () => {
    const r = resolvePracticeReadiness(boundary(5));
    expect([r.state, r.canGenerate, r.selectionRequired]).toEqual(["boundary_scope_required", false, true]);
    expect(r.available).toHaveLength(5); // the Host is shown everything
    expect(r.active).toEqual([]); // and nothing is chosen for them
  });

  it("boundary_scope_unconfirmed — a selection exists but was never confirmed, and SURVIVES", () => {
    const r = resolvePracticeReadiness(boundary(5), { ...confirmed(5, ["c2_rule", "c4_rule"]), confirmed: false });
    expect([r.state, r.canGenerate]).toEqual(["boundary_scope_unconfirmed", false]);
    // The Host's work is not thrown away just because it is unconfirmed.
    expect(r.active.map((c) => c.id)).toEqual(["c2_rule", "c4_rule"]);
  });

  it("ready_confirmed_scope — the confirmed subset governs, the rest stay available", () => {
    const r = resolvePracticeReadiness(boundary(6), confirmed(6, ["c1_rule", "c5_rule"]));
    expect([r.state, r.canGenerate, r.confirmed]).toEqual(["ready_confirmed_scope", true, true]);
    expect(r.active.map((c) => c.id)).toEqual(["c1_rule", "c5_rule"]);
    expect(inactiveBoundaries(r).map((c) => c.id)).toEqual(["c2_rule", "c3_rule", "c4_rule", "c6_rule"]);
  });

  it("active_boundary_set_changed — the confirmed list moved after the choice", () => {
    const scope = confirmed(5, ["c1_rule"]);
    const r = resolvePracticeReadiness(boundary(6), scope);
    expect([r.state, r.canGenerate]).toEqual(["active_boundary_set_changed", false]);
    expect(r.active).toEqual([]); // no stale subset carried forward
  });

  it("too_many_active_boundaries — a scope holding four is reported, never trimmed", () => {
    const overfull = { ...confirmed(6, ["c1_rule"]), activeIds: ["c1_rule", "c2_rule", "c3_rule", "c4_rule"] };
    expect(resolvePracticeReadiness(boundary(6), overfull).state).toBe("too_many_active_boundaries");
  });

  it("unknown_active_boundary — a chosen rule is no longer confirmed", () => {
    const stale = { ...confirmed(6, ["c1_rule"]), activeIds: ["c9_gone"] };
    expect(resolvePracticeReadiness(boundary(6), stale).state).toBe("unknown_active_boundary");
  });
});

describe("it agrees with the server authority", () => {
  const cases: Array<[string, PracticeBoundary, ReturnType<typeof confirmed> | undefined]> = [
    ["none", { mode: "judgment", confirmed: true, constraints: [] }, undefined],
    ["fits", boundary(3), undefined],
    ["scoped", boundary(6), confirmed(6, ["c2_rule", "c3_rule"])],
    ["needs scope", boundary(6), undefined],
    ["stale", boundary(6), confirmed(5, ["c1_rule"])],
  ];

  it.each(cases)("%s — canGenerate matches resolveActiveBoundaries, and so do the active rules", (_label, b, scope) => {
    const readiness = resolvePracticeReadiness(b, scope);
    const server = resolveActiveBoundaries(b, scope);
    expect(readiness.canGenerate).toBe(server.kind === "active");
    if (server.kind === "active") {
      expect(readiness.active.map((c) => c.id)).toEqual(server.constraints.map((c) => c.id));
    }
  });
});

describe("42-45. old shells without scope data", () => {
  it("42/43. an old 0-3 setup opens and derives a truthful active scope with no stored data", () => {
    for (const n of [0, 1, 2, 3]) {
      const r = resolvePracticeReadiness(n === 0 ? { mode: "judgment", confirmed: true, constraints: [] } : boundary(n), undefined);
      expect(r.canGenerate, `${n} boundaries`).toBe(true);
      expect(r.active, `${n} boundaries`).toHaveLength(n);
    }
  });

  it("44. an old 4+ setup requires an explicit scope rather than inheriting one", () => {
    const r = resolvePracticeReadiness(boundary(7), undefined);
    expect(r.state).toBe("boundary_scope_required");
    expect(r.active).toEqual([]);
  });

  it("45. `undefined` and `null` scope are both simply absent — no migration semantics", () => {
    expect(resolvePracticeReadiness(boundary(2), null).state).toBe("ready_all_available_boundaries_active");
    expect(resolvePracticeReadiness(boundary(2), undefined).state).toBe("ready_all_available_boundaries_active");
  });
});

describe("26/28. what the resolver never does", () => {
  it("it never selects, reorders or rewrites a boundary", () => {
    const r = resolvePracticeReadiness(boundary(6));
    expect(r.available.map((c) => c.id)).toEqual(["c1_rule", "c2_rule", "c3_rule", "c4_rule", "c5_rule", "c6_rule"]);
    expect(r.available.map((c) => c.statement)).toEqual(rules(6).map((c) => c.statement));
    expect(r.active).toEqual([]);
  });

  it("28. no invalid state carries a stale subset forward as if it were active", () => {
    for (const scope of [
      confirmed(5, ["c1_rule"]), // set changed
      { ...confirmed(6, ["c1_rule"]), activeIds: ["c1_rule", "c2_rule", "c3_rule", "c4_rule"] }, // too many
      { ...confirmed(6, ["c1_rule"]), activeIds: ["c9_gone"] }, // unknown
    ]) {
      expect(resolvePracticeReadiness(boundary(6), scope).active).toEqual([]);
    }
  });
});
