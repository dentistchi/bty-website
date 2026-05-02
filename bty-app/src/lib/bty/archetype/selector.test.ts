import { describe, it, expect } from "vitest";
import { selectArchetype, SelectorInvariantError } from "./selector";
import type { AxisVector } from "./fingerprint";

const BASE: AxisVector = {
  ownership: 0.5,
  time: 0.5,
  authority: 0.5,
  truth: 0.5,
  repair: 0.5,
  conflict: 0.5,
  integrity: 0.5,
  visibility: 0.5,
  accountability: 0.5,
  courage: 0.5,
  control: 0.5,
  identity: 0.5,
};

describe("selectArchetype", () => {
  it("throws SelectorInvariantError when no rule matches flat 0.5 axis", () => {
    // BASE has all axes at 0.5 — STILLWATER requires conflict≤0.40 and repair≤0.40,
    // so it does not match. Silent STILLWATER fallback removed (AL-1.5.1 hotfix);
    // SelectorInvariantError surfaces the axis calibration gap explicitly.
    expect(() => selectArchetype(BASE)).toThrow(SelectorInvariantError);
    expect(() => selectArchetype(BASE)).toThrow("no rule matched axis vector");
  });

  it("returns STILLWATER via rule_engine when axis matches §5.1 conditions", () => {
    const r = selectArchetype({ ...BASE, conflict: 0.30, repair: 0.30, integrity: 0.55 });
    expect(r.name).toBe("STILLWATER");
    expect(r.selectedBy).toBe("rule_engine");
  });

  it("returns CLEARANCHOR when truth/accountability/integrity all high", () => {
    const r = selectArchetype({
      ...BASE,
      truth: 0.75,
      accountability: 0.7,
      integrity: 0.7,
    });
    expect(r.name).toBe("CLEARANCHOR");
    expect(r.selectedBy).toBe("rule_engine");
  });

  it("returns IRONROOT when authority/control/courage all high", () => {
    const r = selectArchetype({
      ...BASE,
      authority: 0.7,
      control: 0.7,
      courage: 0.6,
    });
    expect(r.name).toBe("IRONROOT");
  });

  it("returns NIGHTFORGE for courage ≥ 0.65 when no 2+ condition rule matches", () => {
    const r = selectArchetype({ ...BASE, courage: 0.7 });
    expect(r.name).toBe("NIGHTFORGE");
  });

  it("higher-specificity rule wins over lower-specificity", () => {
    // CLEARANCHOR (3 conditions) vs TRUEBEARING (3 conditions) — both partially met
    // All truth/accountability/integrity high → CLEARANCHOR wins
    const r = selectArchetype({
      ...BASE,
      truth: 0.75,
      accountability: 0.7,
      integrity: 0.7,
      identity: 0.65,
    });
    expect(r.name).toBe("CLEARANCHOR");
  });

  it("tie-breaks alphabetically when specificity is equal", () => {
    // CLEARANCHOR and TRUEBEARING both have 3 conditions
    // Give TRUEBEARING conditions only
    const r = selectArchetype({
      ...BASE,
      truth: 0.65,
      identity: 0.65,
      accountability: 0.6,
    });
    expect(r.name).toBe("TRUEBEARING");
  });

  it("candidatePool includes all matching rule names", () => {
    const r = selectArchetype({ ...BASE, courage: 0.7 });
    expect(r.candidatePool).toContain("NIGHTFORGE");
    // STILLWATER not in pool: conflict=0.5 violates max:0.40 condition
    expect(r.candidatePool).not.toContain("STILLWATER");
  });

  it("candidatePool includes STILLWATER when its axis conditions are met", () => {
    const r = selectArchetype({ ...BASE, conflict: 0.30, repair: 0.30, courage: 0.7 });
    expect(r.candidatePool).toContain("NIGHTFORGE");
    expect(r.candidatePool).toContain("STILLWATER");
    // NIGHTFORGE wins (specificity 100 > STILLWATER 70)
    expect(r.name).toBe("NIGHTFORGE");
  });

  it("is deterministic — same input returns same archetype (×20)", () => {
    const axis: AxisVector = { ...BASE, truth: 0.72, accountability: 0.68, integrity: 0.66 };
    const first = selectArchetype(axis);
    for (let i = 0; i < 19; i++) {
      expect(selectArchetype(axis).name).toBe(first.name);
    }
  });
});
