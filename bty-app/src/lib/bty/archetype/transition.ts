import type { AxisVector } from "./fingerprint";
import { RULE_REGISTRY, ruleMatches, ruleScore, ruleSpecificity } from "./rules";

const TRANSITION_SCORE_THRESHOLD = 0.7;
const TRANSITION_HARD_FLOOR_DAYS = 7;

export type TransitionCheckResult =
  | { eligible: false; reason: "too_soon" | "same_archetype" | "score_below_threshold"; daysLocked: number; score: number }
  | { eligible: true; candidateName: string; score: number; daysLocked: number };

/**
 * Determines whether the new fingerprint input warrants superseding the active lock.
 *
 * Rules:
 *  1. 7-day hard floor — no transition before 7 days regardless of score.
 *  2. Best-matching archetype must differ from current locked archetype.
 *  3. Transition score (how strongly the new input satisfies the candidate's rules) must be ≥ 0.7.
 */
export function checkTransitionEligibility(
  currentArchetypeName: string,
  lockedAt: string,
  newAxisVector: AxisVector,
): TransitionCheckResult {
  const lockedMs = new Date(lockedAt).getTime();
  const daysLocked = (Date.now() - lockedMs) / (1000 * 60 * 60 * 24);

  if (daysLocked < TRANSITION_HARD_FLOOR_DAYS) {
    return { eligible: false, reason: "too_soon", daysLocked, score: 0 };
  }

  // Find the best candidate for the new axis vector (same logic as selectArchetype)
  const matching = RULE_REGISTRY.filter((r) => ruleMatches(r, newAxisVector));
  const sorted = [...matching].sort((a, b) => {
    const specDiff = ruleSpecificity(b) - ruleSpecificity(a);
    if (specDiff !== 0) return specDiff;
    return a.name.localeCompare(b.name);
  });

  const candidate = sorted[0];
  if (!candidate || candidate.name === currentArchetypeName) {
    return { eligible: false, reason: "same_archetype", daysLocked, score: 0 };
  }

  const score = ruleScore(candidate, newAxisVector);
  if (score < TRANSITION_SCORE_THRESHOLD) {
    return { eligible: false, reason: "score_below_threshold", daysLocked, score };
  }

  return { eligible: true, candidateName: candidate.name, score, daysLocked };
}
