import type { AxisVector } from "./fingerprint";

export type ArchetypeClass = "stability" | "pressure" | "repair" | "truth" | "courage" | "identity";

export type AxisCondition = {
  axis: keyof AxisVector;
  min?: number;
  max?: number;
};

export type ArchetypeRule = {
  name: string;
  archetypeClass: ArchetypeClass;
  specificity?: number; // explicit override; default = conditions.length * 100
  conditions: AxisCondition[];
};

// Ordered by descending specificity. Tie-break: alphabetical (see selector.ts).
export const RULE_REGISTRY = [
  {
    name: "CLEARANCHOR",
    archetypeClass: "truth",
    conditions: [
      { axis: "truth", min: 0.7 },
      { axis: "accountability", min: 0.65 },
      { axis: "integrity", min: 0.65 },
    ],
  },
  {
    name: "IRONROOT",
    archetypeClass: "pressure",
    conditions: [
      { axis: "authority", min: 0.65 },
      { axis: "control", min: 0.65 },
      { axis: "courage", min: 0.55 },
    ],
  },
  {
    name: "TRUEBEARING",
    archetypeClass: "truth",
    conditions: [
      { axis: "truth", min: 0.6 },
      { axis: "identity", min: 0.6 },
      { axis: "accountability", min: 0.55 },
    ],
  },
  {
    name: "OPENHAND",
    archetypeClass: "identity",
    conditions: [
      { axis: "visibility", min: 0.65 },
      { axis: "identity", min: 0.65 },
    ],
  },
  {
    name: "QUIETFLAME",
    archetypeClass: "repair",
    conditions: [
      { axis: "repair", min: 0.6 },
      { axis: "truth", min: 0.5 },
    ],
  },
  {
    name: "NIGHTFORGE",
    archetypeClass: "courage",
    conditions: [{ axis: "courage", min: 0.65 }],
  },
  {
    name: "STILLWATER",
    archetypeClass: "stability",
    specificity: 70, // explicit — lower than any default (100+) to lose ties
    conditions: [
      { axis: "conflict", max: 0.40 },
      { axis: "repair", max: 0.40 },
      { axis: "integrity", min: 0.40, max: 0.70 },
    ],
  },
] as const satisfies readonly ArchetypeRule[];

export function ruleSpecificity(rule: ArchetypeRule): number {
  return rule.specificity ?? rule.conditions.length * 100;
}

export function ruleMatches(rule: ArchetypeRule, axisVector: AxisVector): boolean {
  for (const cond of rule.conditions) {
    const v = axisVector[cond.axis];
    if (cond.min !== undefined && v < cond.min) return false;
    if (cond.max !== undefined && v > cond.max) return false;
  }
  return true;
}

export function ruleScore(rule: ArchetypeRule, axisVector: AxisVector): number {
  if (rule.conditions.length === 0) return 0;
  const scores = rule.conditions.map((cond) => {
    const v = axisVector[cond.axis];
    if (cond.min !== undefined) return Math.min(1, v / cond.min);
    if (cond.max !== undefined) return Math.min(1, (1 - v) / (1 - cond.max));
    return 1;
  });
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}
