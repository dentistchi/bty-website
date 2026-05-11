/**
 * Earned Naming Threshold — gates archetype assignment behind behavioral evidence.
 * Spec: docs/specs/ARCHETYPE_DETERMINISM_LOCK_V1.md §2
 *
 * DB sources (lifetime, no rotation):
 *   scenariosCompleted ← user_scenario_choice_history COUNT(*) WHERE user_id = ?
 *   contractsCompleted ← bty_action_contracts COUNT(*) WHERE user_id = ? AND status = 'approved'
 *
 * v1 scope: 2-dimension only. daysInSystem / distinctAxesActivated deferred to AL-1.7.
 */

export const ENTRY_THRESHOLD = {
  scenariosCompleted: 12,
  contractsCompleted: 3,
} as const;

export const EXIT_THRESHOLD = {
  scenariosCompleted: 8,
  contractsCompleted: 2,
} as const;

export type EvidenceContext = {
  scenariosCompleted: number;
  contractsCompleted: number;
};

export type EarnedNamingResult = {
  eligible: boolean;
  threshold: typeof ENTRY_THRESHOLD | typeof EXIT_THRESHOLD;
  missingDimensions: ("scenariosCompleted" | "contractsCompleted")[];
};

export type PatternFormingResolution = {
  status: "pattern_forming";
  progress: EvidenceContext;
  threshold: typeof ENTRY_THRESHOLD | typeof EXIT_THRESHOLD;
};

/**
 * Determines whether a user has sufficient behavioral evidence for archetype assignment.
 *
 * Hysteresis: users with an existing active lock use EXIT_THRESHOLD (lower) to prevent
 * oscillation. Users without a lock use ENTRY_THRESHOLD.
 *
 * In normal operation, scenariosCompleted and contractsCompleted only increase
 * (lifetime sources, no rotation/deletion), so EXIT is only reached via admin data ops.
 */
export function isEarnedNamingEligible(
  evidence: EvidenceContext,
  hasExistingLock: boolean,
): EarnedNamingResult {
  const threshold = hasExistingLock ? EXIT_THRESHOLD : ENTRY_THRESHOLD;
  const missing: ("scenariosCompleted" | "contractsCompleted")[] = [];

  if (evidence.scenariosCompleted < threshold.scenariosCompleted) {
    missing.push("scenariosCompleted");
  }
  if (evidence.contractsCompleted < threshold.contractsCompleted) {
    missing.push("contractsCompleted");
  }

  return {
    eligible: missing.length === 0,
    threshold,
    missingDimensions: missing,
  };
}

export function buildPatternFormingResolution(
  evidence: EvidenceContext,
  hasExistingLock: boolean,
): PatternFormingResolution {
  const { threshold } = isEarnedNamingEligible(evidence, hasExistingLock);
  return {
    status: "pattern_forming",
    progress: evidence,
    threshold,
  };
}
