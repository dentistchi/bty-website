import type { AxisVector } from "./fingerprint";
import { RULE_REGISTRY, ruleMatches, ruleScore, ruleSpecificity } from "./rules";
import type { ArchetypeRule } from "./rules";

export type SelectedArchetype = {
  name: string;
  archetypeClass: ArchetypeRule["archetypeClass"];
  selectedBy: "rule_engine";
  candidatePool: string[];
  selectionReason: string;
};

/** Thrown when no archetype rule matches the axis vector — indicates axis calibration needed (AL-1.7). */
export class SelectorInvariantError extends Error {
  readonly axisVector: AxisVector;
  constructor(axisVector: AxisVector) {
    super(
      "selectArchetype: no rule matched axis vector — axis distribution outside all thresholds. " +
        "Axis calibration audit required (AL-1.7).",
    );
    this.name = "SelectorInvariantError";
    this.axisVector = axisVector;
  }
}

/**
 * Selects the archetype with highest specificity that matches all conditions.
 * Tie-breaking: alphabetical by name (deterministic).
 * All archetypes including STILLWATER have real axis conditions (v1, Method X).
 * Guard fallback fires only when NO rule matches — should not occur for earned users
 * since lockService (A0) gate ensures the earned naming threshold is met before calling here.
 */
export function selectArchetype(axisVector: AxisVector): SelectedArchetype {
  const matching = RULE_REGISTRY.filter((r) => ruleMatches(r, axisVector));

  // Sort: specificity desc, name asc (deterministic tie-break)
  const sorted = [...matching].sort((a, b) => {
    const specDiff = ruleSpecificity(b) - ruleSpecificity(a);
    if (specDiff !== 0) return specDiff;
    return a.name.localeCompare(b.name);
  });

  const candidatePool = sorted.map((r) => r.name);
  const winner = sorted[0];

  if (!winner) {
    // No rule matched — axis vector outside all thresholds simultaneously.
    // Throwing rather than silent fallback: callers must handle explicitly.
    // Axis calibration audit deferred to AL-1.7.
    throw new SelectorInvariantError(axisVector);
  }

  const score = ruleScore(winner, axisVector);

  return {
    name: winner.name,
    archetypeClass: winner.archetypeClass,
    selectedBy: "rule_engine",
    candidatePool,
    selectionReason: `specificity=${ruleSpecificity(winner)},score=${score.toFixed(2)}`,
  };
}
