/** Public reward projection. XP and progression are computed on the server, never in the UI. */
export const LEARNING_REWARDS_POLICY_VERSION = "learning-rewards/v1" as const;
export type LearningRewardAction = "learn" | "practice" | "revisit" | "followup";
export type LearningRewardEvidence = {
  policy_version: typeof LEARNING_REWARDS_POLICY_VERSION;
  source_type: "foundry_learn" | "clinical_practice" | "assigned_revisit" | "foundry_followup";
  source_id: string;
  assignment_key: string;
  content_key: string;
  content_version: string;
  action: LearningRewardAction;
  completed_at: string;
  timezone: string;
  /** Evidence identifiers only. Never include a reflection, patient answer, or other free text. */
  metadata: {
    moduleKey?: string;
    requiredSteps?: LearningRewardAction[];
    path?: string;
    clinicalCaseId?: string;
    followupDays?: 7 | 30;
    revisitBaselineAt?: string;
    revisitVariant?: string;
    baselineVariant?: string;
  };
};
export type LearningRewardCompletion = LearningRewardEvidence & {
  id: string;
  bty_day: string;
  xp: number;
  disposition: "awarded" | "daily_cap";
};
export type LearningRewardLedgerEntry = {
  id: string;
  completion_id: string;
  xp: number;
  occurred_at: string;
  bty_day: string;
  timezone: string;
};
export type LearningRewardBadgeId = "first" | "circle" | "second" | "weeks" | "patient" | "clinical" | "follow" | "insight" | "together" | "return" | "level10" | "level50";
export type LearningRewardBadge = {
  id: LearningRewardBadgeId;
  name: string;
  description: string;
  icon: string;
  frame: "circle" | "octagon" | "crest";
  earnedAt: string | null;
  progress: number;
  target: number;
  available: boolean;
};
export type LearningAchievement = {
  id: string;
  kind: "badge" | "milestone";
  title: string;
  earnedAt: string;
};
export type LearningRewardsSummary = {
  policyVersion: typeof LEARNING_REWARDS_POLICY_VERSION;
  totalXp: number;
  weeklyXp: number;
  weeklyGoal: number;
  weeklyGoalReached: boolean;
  weeklyProgressPercent: number;
  level: {
    current: number;
    next: number;
    xpIntoLevel: number;
    xpForNextLevel: number;
    nextLevelTotalXp: number;
    xpToNextLevel: number;
    progressPercent: number;
    nextMilestone: number | null;
    nextMilestoneXp: number | null;
  };
  week: { startsAt: string; endsAt: string; timezone: string };
  badges: LearningRewardBadge[];
  featuredBadgeId: LearningRewardBadgeId | null;
  recentAchievements: LearningAchievement[];
  pendingAchievements: LearningAchievement[];
  team: { status: "unavailable"; reason: string };
};
export type LearningRewardAward = {
  completionId: string;
  action: LearningRewardAction;
  xp: number;
  disposition: "awarded" | "daily_cap" | "duplicate";
};
export type LearningRewardsSyncResult = {
  summary: LearningRewardsSummary;
  awards: LearningRewardAward[];
  xpAwarded: number;
  newAchievements: LearningAchievement[];
};
