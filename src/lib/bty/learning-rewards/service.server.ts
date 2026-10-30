import type { SupabaseClient } from "@supabase/supabase-js";
import { readUserTzContext, isValidIanaTz } from "@/lib/bty/daily/userDay";
import { isValidLearningEvidence } from "@/domain/learning-rewards/policy";
import { projectLearningRewards } from "@/domain/learning-rewards/summary";
import { type LearningRewardBadgeId, type LearningRewardCompletion, type LearningRewardLedgerEntry, type LearningRewardAward, type LearningRewardsSummary, type LearningRewardsSyncResult } from "@/domain/learning-rewards/types";
import { collectLearningRewardEvidence } from "./sources.server";
import { isConsentCurrent } from "@/lib/legal/activeConsent";

export const learningRewardsEnabled = () => process.env.LEARNING_REWARDS_ENABLED === "1";
type RewardState = {
  started_at: string;
  timezone: string | null;
  featured_badge_id: string | null;
  seen_achievement_ids: string[];
  completions: LearningRewardCompletion[];
  ledger: LearningRewardLedgerEntry[];
};

function stateFrom(value: unknown): RewardState {
  const state = value as Partial<RewardState> | null;
  if (!state || !Number.isFinite(Date.parse(state.started_at ?? "")) || !Array.isArray(state.completions) || !Array.isArray(state.ledger)
    || !Array.isArray(state.seen_achievement_ids) || state.seen_achievement_ids.some(id => typeof id !== "string")) throw Error("LEARNING_REWARDS_UNAVAILABLE");
  if (state.ledger.some(row => !row || !Number.isSafeInteger(row.xp) || row.xp < 0 || !Number.isFinite(Date.parse(row.occurred_at)))) throw Error("LEARNING_REWARDS_UNAVAILABLE");
  if (state.completions.some(row => !row || !row.metadata || !Number.isFinite(Date.parse(row.completed_at)))) throw Error("LEARNING_REWARDS_UNAVAILABLE");
  return state as RewardState;
}

/** One SQL read snapshot, including the empty state. GET never enrolls, awards, or captures timezone. */
async function readState(db: SupabaseClient, userId: string): Promise<RewardState> {
  const { data, error } = await db.rpc("bty_get_learning_reward_state", { p_user_id: userId });
  if (error) throw Error("LEARNING_REWARDS_UNAVAILABLE");
  return stateFrom(data);
}
async function projectState(db: SupabaseClient, userId: string, state: RewardState, now: Date) {
  const timezone = isValidIanaTz(state.timezone) ? state.timezone : (await readUserTzContext(db, userId, null)).timezone;
  return projectLearningRewards({ completions: state.completions, ledger: state.ledger, timezone, now, featuredBadgeId: state.featured_badge_id, seenAchievementIds: state.seen_achievement_ids });
}

export async function getLearningRewards(db: SupabaseClient, userId: string, now = new Date()): Promise<LearningRewardsSummary> {
  return projectState(db, userId, await readState(db, userId), now);
}

/** Only independently verified server evidence reaches the service-only atomic award RPC. */
export async function syncLearningRewards(db: SupabaseClient, userId: string, now = new Date()): Promise<LearningRewardsSyncResult> {
  const state = await readState(db, userId);
  const before = await projectState(db, userId, state, now);
  const evidence = await collectLearningRewardEvidence(db, userId, state.started_at, now);
  const awards: LearningRewardAward[] = [];
  const sourceKey = (item: { source_type: string; source_id: string }) => JSON.stringify([item.source_type, item.source_id]);
  const rewardKey = (item: { assignment_key: string; action: string; content_key: string; content_version: string }) => JSON.stringify([item.assignment_key, item.action, item.content_key, item.content_version]);
  const knownSources = new Set(state.completions.map(sourceKey));
  const knownRewards = new Set(state.completions.map(rewardKey));
  for (const item of [...evidence].sort((a, b) => Date.parse(a.completed_at) - Date.parse(b.completed_at) || a.source_id.localeCompare(b.source_id))) {
    if (!isValidLearningEvidence(item, state.started_at, now)) throw Error("INVALID_LEARNING_EVIDENCE");
    // Old recorded completions (including cap-denied ones) are already settled. Keep the SQL
    // duplicate guard for races, without replaying a lifetime of sequential write RPCs on entry.
    if (knownSources.has(sourceKey(item)) || knownRewards.has(rewardKey(item))) continue;
    const { data, error } = await db.rpc("bty_record_learning_reward", { p_user_id: userId, p_evidence: item });
    if (error) throw Error("LEARNING_REWARDS_UNAVAILABLE");
    const row = (Array.isArray(data) ? data[0] : data) as { completion_id?: string; disposition?: string; xp?: number } | null;
    if (!row?.completion_id || !["awarded", "daily_cap", "duplicate"].includes(row.disposition ?? "") || !Number.isSafeInteger(row.xp) || (row.xp ?? -1) < 0) throw Error("LEARNING_REWARDS_UNAVAILABLE");
    awards.push({ completionId: row.completion_id, action: item.action, xp: row.xp!, disposition: row.disposition as LearningRewardAward["disposition"] });
    knownSources.add(sourceKey(item)); knownRewards.add(rewardKey(item));
  }
  const summary = await getLearningRewards(db, userId, now);
  const previousIds = new Set(before.recentAchievements.map(achievement => achievement.id));
  // A concurrent duplicate/retry may observe a badge appear, but did not earn it a second time.
  const newlyRecorded = awards.some(award => award.disposition !== "duplicate");
  return {
    summary, awards,
    xpAwarded: awards.reduce((sum, award) => sum + award.xp, 0),
    newAchievements: newlyRecorded ? summary.recentAchievements.filter(achievement => !previousIds.has(achievement.id)) : [],
  };
}

/** Completion remains saved even if rewards temporarily fail. Me can explicitly reconcile later. */
export async function syncLearningRewardsIfEnabled(db: SupabaseClient, userId: string): Promise<({ status: "synced" } & LearningRewardsSyncResult) | { status: "pending" } | undefined> {
  if (!learningRewardsEnabled()) return undefined;
  try {
    if (!(await isConsentCurrent(db, userId))) return { status: "pending" };
    return { status: "synced", ...await syncLearningRewards(db, userId) };
  }
  catch { return { status: "pending" }; }
}

export async function featureLearningBadge(db: SupabaseClient, userId: string, badgeId: LearningRewardBadgeId, now = new Date()): Promise<LearningRewardsSummary> {
  const summary = await getLearningRewards(db, userId, now);
  if (!summary.badges.some(badge => badge.id === badgeId && badge.earnedAt != null)) throw Error("BADGE_NOT_EARNED");
  const { data, error } = await db.from("learning_reward_profiles").update({ featured_badge_id: badgeId })
    .eq("user_id", userId).select("user_id").maybeSingle();
  if (error || !data) throw Error("LEARNING_REWARDS_UNAVAILABLE");
  return { ...summary, featuredBadgeId: badgeId };
}

/** Persist only a learner's acknowledgement of achievements the server can establish. */
export async function acknowledgeLearningAchievements(db: SupabaseClient, userId: string, ids: string[], now = new Date()): Promise<LearningRewardsSummary> {
  const summary = await getLearningRewards(db, userId, now);
  const earned = new Set(summary.recentAchievements.map(achievement => achievement.id));
  const unique = [...new Set(ids)];
  if (unique.length < 1 || unique.length > 16 || unique.some(id => !earned.has(id))) throw Error("ACHIEVEMENT_NOT_EARNED");
  const { error } = await db.rpc("bty_acknowledge_learning_achievements", { p_user_id: userId, p_ids: unique });
  if (error) throw Error("LEARNING_REWARDS_UNAVAILABLE");
  return getLearningRewards(db, userId, now);
}
