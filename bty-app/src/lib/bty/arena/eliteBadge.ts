/**
 * Elite badge grant rules (PHASE_4_ELITE_5_PERCENT_SPEC §10, PROJECT_BACKLOG §4·§5).
 * Pure domain: which badges the user has based on elite status. No DB; derived from isElite.
 */

export const ELITE_BADGE_KINDS = ["weekly_elite"] as const;
export type EliteBadgeKind = (typeof ELITE_BADGE_KINDS)[number];

export interface EliteBadgeGrant {
  kind: EliteBadgeKind;
  /** i18n key for label (e.g. "상위 5%", "Weekly Elite") */
  labelKey: string;
}

/**
 * Returns badge grants for the user given weekly elite status.
 * 주간 5% 달성 시 배지 수여 — weekly_elite badge when isEliteWeekly is true.
 */
export function getEliteBadgeGrants(isEliteWeekly: boolean): EliteBadgeGrant[] {
  if (!isEliteWeekly) return [];
  return [{ kind: "weekly_elite", labelKey: "weekly_elite" }];
}
