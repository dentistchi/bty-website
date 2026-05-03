import { describe, it, expect } from "vitest";
import { ruleMatches, ruleSpecificity, RULE_REGISTRY } from "./rules";
import type { AxisVector } from "./fingerprint";

const BASE: AxisVector = {
  ownership: 0.5, time: 0.5, authority: 0.5, truth: 0.5,
  repair: 0.5, conflict: 0.5, integrity: 0.5, visibility: 0.5,
  accountability: 0.5, courage: 0.5, control: 0.5, identity: 0.5,
};

describe("ruleMatches — Method X (axis-only)", () => {
  it("STILLWATER matches when conflict≤0.40, repair≤0.40, integrity in [0.40,0.70]", () => {
    const stillwater = RULE_REGISTRY.find((r) => r.name === "STILLWATER")!;
    const axis: AxisVector = { ...BASE, conflict: 0.20, repair: 0.20, integrity: 0.55 };
    expect(ruleMatches(stillwater, axis)).toBe(true);
  });

  it("STILLWATER does not match when conflict exceeds max (0.50 > 0.40)", () => {
    const stillwater = RULE_REGISTRY.find((r) => r.name === "STILLWATER")!;
    expect(ruleMatches(stillwater, { ...BASE, conflict: 0.50, repair: 0.20, integrity: 0.55 })).toBe(false);
  });

  it("STILLWATER does not match when integrity below min (0.30 < 0.40)", () => {
    const stillwater = RULE_REGISTRY.find((r) => r.name === "STILLWATER")!;
    expect(ruleMatches(stillwater, { ...BASE, conflict: 0.20, repair: 0.20, integrity: 0.30 })).toBe(false);
  });

  it("STILLWATER does not match when integrity exceeds max (0.80 > 0.70)", () => {
    const stillwater = RULE_REGISTRY.find((r) => r.name === "STILLWATER")!;
    expect(ruleMatches(stillwater, { ...BASE, conflict: 0.20, repair: 0.20, integrity: 0.80 })).toBe(false);
  });
});

describe("ruleSpecificity — §3.3.1", () => {
  it("STILLWATER explicit specificity=70", () => {
    const stillwater = RULE_REGISTRY.find((r) => r.name === "STILLWATER")!;
    expect(ruleSpecificity(stillwater)).toBe(70);
  });

  it("NIGHTFORGE (1 condition) = 100", () => {
    const r = RULE_REGISTRY.find((r) => r.name === "NIGHTFORGE")!;
    expect(ruleSpecificity(r)).toBe(100);
  });

  it("OPENHAND (2 conditions) = 200", () => {
    const r = RULE_REGISTRY.find((r) => r.name === "OPENHAND")!;
    expect(ruleSpecificity(r)).toBe(200);
  });

  it("QUIETFLAME (2 conditions) = 200", () => {
    const r = RULE_REGISTRY.find((r) => r.name === "QUIETFLAME")!;
    expect(ruleSpecificity(r)).toBe(200);
  });

  it("CLEARANCHOR (3 conditions) = 300", () => {
    const r = RULE_REGISTRY.find((r) => r.name === "CLEARANCHOR")!;
    expect(ruleSpecificity(r)).toBe(300);
  });

  it("IRONROOT (3 conditions) = 300", () => {
    const r = RULE_REGISTRY.find((r) => r.name === "IRONROOT")!;
    expect(ruleSpecificity(r)).toBe(300);
  });

  it("TRUEBEARING (3 conditions) = 300", () => {
    const r = RULE_REGISTRY.find((r) => r.name === "TRUEBEARING")!;
    expect(ruleSpecificity(r)).toBe(300);
  });

  it("§3.3.2 specificity ordering: 70 < 100 < 200 < 300", () => {
    const values = RULE_REGISTRY.map(ruleSpecificity);
    const min = Math.min(...values);
    const max = Math.max(...values);
    expect(min).toBe(70); // STILLWATER
    expect(max).toBe(300); // 3-condition rules
  });
});

describe("RULE_REGISTRY integrity", () => {
  it("contains exactly 7 archetypes", () => {
    expect(RULE_REGISTRY).toHaveLength(7);
  });

  it("STILLWATER has exactly 3 conditions (§5.1 — not conditions:[])", () => {
    const stillwater = RULE_REGISTRY.find((r) => r.name === "STILLWATER")!;
    expect(stillwater.conditions).toHaveLength(3);
  });

  it("all archetype names are unique", () => {
    const names = RULE_REGISTRY.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
