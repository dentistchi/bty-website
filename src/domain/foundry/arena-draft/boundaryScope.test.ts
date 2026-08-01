import { describe, it, expect } from "vitest";
import {
  BOUNDARY_SCOPE_CODES,
  MAX_ACTIVE_BOUNDARIES,
  availableSetKey,
  buildBoundaryScope,
  resolveActiveBoundaries,
  unselectedBoundaries,
  validateBoundaryScope,
  type PracticeBoundaryScope,
} from "./boundaryScope";
import type { BoundaryConstraint, PracticeBoundary } from "./boundary";

/**
 * ACTIVE-BOUNDARY SCOPE (Slice 3.2I-R5B1A.1-R2.23C).
 *
 * The limit bounds ONE generated situation, not the organization, the module, or anything already
 * persisted. With four or more confirmed rules the Host chooses — the system never picks a default
 * set, never merges, never summarises and never silently drops a rule the Manager confirmed.
 */

const rule = (n: number): BoundaryConstraint => ({ id: `c${n}_rule`, statement: `Rule number ${n} must hold`, provenance: "manager_entered" });
const rules = (n: number) => Array.from({ length: n }, (_, i) => rule(i + 1));
const boundary = (n: number): PracticeBoundary => ({ mode: "judgment_with_constraints", confirmed: true, constraints: rules(n) });
const scopeFor = (available: BoundaryConstraint[], ids: string[]): PracticeBoundaryScope => {
  const b = buildBoundaryScope(available, ids);
  if (!b.ok) throw new Error(`fixture invalid: ${b.errors.join(",")}`);
  return b.value;
};

describe("11-13. how many rules are active", () => {
  it("the maximum is three, and every fail-closed code is named", () => {
    expect(MAX_ACTIVE_BOUNDARIES).toBe(3);
    expect(BOUNDARY_SCOPE_CODES).toHaveLength(6);
  });

  it("11. zero confirmed boundaries proceeds with zero active", () => {
    const r = resolveActiveBoundaries({ mode: "judgment", confirmed: true, constraints: [] });
    expect(r.kind).toBe("active");
    expect(r.kind === "active" && r.constraints).toEqual([]);
  });

  it("12. one to three available means ALL are active — no scoping step is imposed", () => {
    for (const n of [1, 2, 3]) {
      const r = resolveActiveBoundaries(boundary(n));
      expect(r.kind, `${n} available`).toBe("active");
      expect(r.kind === "active" && r.constraints).toHaveLength(n);
    }
  });

  it("13. four or more BLOCKS until the Host chooses", () => {
    for (const n of [4, 7, 10]) {
      const r = resolveActiveBoundaries(boundary(n));
      expect(r.kind, `${n} available`).toBe("scope_required");
      expect(r.kind === "scope_required" && r.code).toBe("practice_boundary_scope_required");
      expect(r.kind === "scope_required" && r.maxActive).toBe(3);
      // The Host is shown every available rule, never a preselected subset.
      expect(r.kind === "scope_required" && r.availableIds).toHaveLength(n);
    }
  });

  it("14. THERE IS NO AUTOMATIC SELECTION — not the first three, not any three", () => {
    const r = resolveActiveBoundaries(boundary(5));
    expect(r.kind).toBe("scope_required");
    // Nothing in the result offers a chosen set. Blocking is the whole behaviour.
    expect(Object.keys(r)).not.toContain("constraints");
  });

  it("13b. a scope that exists but is unconfirmed still blocks", () => {
    const available = rules(5);
    const scope = { ...scopeFor(available, ["c1_rule", "c2_rule"]), confirmed: false };
    const r = resolveActiveBoundaries(boundary(5), scope);
    expect(r.kind === "scope_required" && r.code).toBe("boundary_scope_not_confirmed");
  });

  it("a confirmed selection activates EXACTLY the chosen rules", () => {
    const available = rules(6);
    const r = resolveActiveBoundaries(boundary(6), scopeFor(available, ["c2_rule", "c5_rule"]));
    expect(r.kind).toBe("active");
    expect(r.kind === "active" && r.activeIds).toEqual(["c2_rule", "c5_rule"]);
  });
});

describe("15-17. fail-closed validation", () => {
  it("15. more than three selected is rejected, never trimmed", () => {
    const available = rules(6);
    const built = buildBoundaryScope(available, ["c1_rule", "c2_rule", "c3_rule", "c4_rule"]);
    expect(built.ok).toBe(false);
    expect(!built.ok && built.errors).toContain("too_many_active_boundaries");
  });

  it("16. an unknown or duplicated id is rejected", () => {
    const available = rules(5);
    expect(buildBoundaryScope(available, ["c9_invented"]).ok).toBe(false);
    const dup = buildBoundaryScope(available, ["c1_rule", "c1_rule"]);
    expect(!dup.ok && dup.errors).toContain("unknown_active_boundary");
  });

  it("16b. selecting nothing while rules exist is not a scoping decision", () => {
    const built = buildBoundaryScope(rules(5), []);
    expect(!built.ok && built.errors).toContain("missing_required_active_boundary");
  });

  it("17. a change to the AVAILABLE set invalidates a confirmation", () => {
    const before = rules(5);
    const scope = scopeFor(before, ["c1_rule", "c2_rule"]);
    // Adding a rule…
    expect(validateBoundaryScope(scope, [...before, rule(6)]).errors).toContain("active_boundary_set_changed");
    // …removing one…
    expect(validateBoundaryScope(scope, before.slice(0, 4)).errors).toContain("active_boundary_set_changed");
    // …and EDITING one, which a naive id-only fingerprint would have missed.
    const edited = before.map((c) => (c.id === "c3_rule" ? { ...c, statement: "Rule number 3 was reworded" } : c));
    expect(validateBoundaryScope(scope, edited).errors).toContain("active_boundary_set_changed");
  });

  it("17b. the fingerprint ignores order and whitespace — a re-save is not a change", () => {
    const a = rules(4);
    const reordered = [a[2], a[0], a[3], a[1]].map((c) => ({ ...c, statement: `  ${c.statement.toUpperCase()}  ` }));
    expect(availableSetKey(a)).toBe(availableSetKey(reordered));
  });

  it("17c. a stale confirmation blocks rather than silently applying", () => {
    const scope = scopeFor(rules(5), ["c1_rule"]);
    const r = resolveActiveBoundaries(boundary(6), scope);
    expect(r.kind === "scope_required" && r.code).toBe("active_boundary_set_changed");
  });

  it("a narrower confirmation may not drop a rule from a set that now FITS whole", () => {
    // The Manager removed rules until only three remain; the old 2-of-5 selection must not persist
    // as a silent narrowing of a set every rule of which is now in play.
    const scope = scopeFor(rules(5), ["c1_rule", "c2_rule"]);
    const r = resolveActiveBoundaries(boundary(3), scope);
    expect(r.kind).toBe("scope_required");
  });
});

describe("18/19. what survives a selection", () => {
  it("18. reopening preserves the selection — it is stored, not recomputed", () => {
    const available = rules(6);
    const scope = scopeFor(available, ["c3_rule", "c4_rule"]);
    const reopened = JSON.parse(JSON.stringify(scope)) as PracticeBoundaryScope;
    const r = resolveActiveBoundaries(boundary(6), reopened);
    expect(r.kind === "active" && r.activeIds).toEqual(["c3_rule", "c4_rule"]);
  });

  it("19. the exact ACTIVE ids and statements are what a retry would pin", () => {
    const r = resolveActiveBoundaries(boundary(6), scopeFor(rules(6), ["c2_rule", "c6_rule"]));
    expect(r.kind === "active" && r.constraints.map((c) => c.statement)).toEqual([
      "Rule number 2 must hold",
      "Rule number 6 must hold",
    ]);
  });

  it("UNSELECTED rules are preserved intact for another situation — never deleted or merged", () => {
    const available = rules(6);
    const scope = scopeFor(available, ["c1_rule", "c2_rule"]);
    const left = unselectedBoundaries(available, scope);
    expect(left.map((c) => c.id)).toEqual(["c3_rule", "c4_rule", "c5_rule", "c6_rule"]);
    // Byte-identical to the originals: nothing was summarised or rewritten.
    expect(left).toEqual(available.slice(2));
  });
});
