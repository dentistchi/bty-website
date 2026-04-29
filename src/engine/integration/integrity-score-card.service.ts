/**
 * Center / dashboard integration entry for the integrity score card.
 * Composes {@link getResilienceScore}, {@link getLRI}, {@link getAIRTrend},
 * {@link getBehaviorPatterns}, {@link getCertifiedStatus} (implementation in
 * `engine/integrity/integrity-score-card.service.ts`), computes weighted
 * composite (AIR 40% + LRI 30% + resilience 30%), letter grade A–D, and
 * upserts `integrity_score_cards` when `auth.admin.getUserById` finds the user
 * (otherwise skips DB write; see {@link persistIntegrityScoreCard}).
 */

export {
  getIntegrityScoreCard,
  gradeFromComposite,
  persistIntegrityScoreCard,
  type IntegrityGrade,
  type IntegrityScoreCard,
  type IntegrityScoreCardComponentPayload,
  type IntegrityScoreCardReuse,
} from "@/engine/integrity/integrity-score-card.service";
