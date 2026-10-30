import { learningLevel, learningWeek, LEARNING_MILESTONES, WEEKLY_LEARNING_GOAL, xpAtLevel } from "./policy";
import { LEARNING_REWARDS_POLICY_VERSION, type LearningRewardBadge, type LearningRewardBadgeId, type LearningRewardCompletion, type LearningRewardLedgerEntry, type LearningRewardsSummary, type LearningAchievement } from "./types";

const BADGES: ReadonlyArray<Omit<LearningRewardBadge, "earnedAt" | "progress">> = [
  { id: "first", name: "First Step", icon: "sprout", frame: "circle", description: "Complete your first eligible Learn activity, including its completion response.", target: 1, available: true },
  { id: "circle", name: "Full Circle", icon: "circle-check", frame: "circle", description: "Complete Learn, Practice, an assigned Revisit, and Follow-up for the same approved module.", target: 4, available: false },
  { id: "second", name: "A Second Look", icon: "scan-eye", frame: "octagon", description: "Complete an assigned different variant at least 72 hours after the original activity.", target: 1, available: false },
  { id: "weeks", name: "Four Learning Weeks", icon: "calendar-check", frame: "circle", description: "Reach 60 Learning XP in four different BTY weeks. They do not need to be consecutive.", target: 4, available: true },
  { id: "patient", name: "Patient Conversations", icon: "messages-square", frame: "crest", description: "Complete the required steps of three distinct approved Patient Communication modules.", target: 3, available: false },
  { id: "clinical", name: "Clinical Explorer", icon: "search", frame: "octagon", description: "Submit your independent assessment and review the reference approach in five distinct Clinical Discovery cases.", target: 5, available: true },
  { id: "follow", name: "Follow-through", icon: "footprints", frame: "crest", description: "Respond to due follow-ups in three distinct assignments. Every outcome counts equally.", target: 3, available: true },
  { id: "insight", name: "Shared Insight", icon: "lightbulb", frame: "circle", description: "Choose to share an insight that a designated reviewer adopts into a Learning Brief.", target: 1, available: false },
  { id: "together", name: "Better Together", icon: "users-round", frame: "crest", description: "Participate in a team month in which 80% of eligible members reach the weekly goal in three of four weeks.", target: 3, available: false },
  { id: "return", name: "Thirty-day Return", icon: "calendar-range", frame: "circle", description: "Respond to an assigned 30-day follow-up after its due time. This records a return, not proof of sustained application.", target: 1, available: true },
  { id: "level10", name: "Level 10", icon: "sparkles", frame: "octagon", description: "Accumulate 2,100 Learning XP.", target: 2100, available: true },
  { id: "level50", name: "Level 50", icon: "gem", frame: "octagon", description: "Accumulate 14,100 Learning XP. Levels continue after this milestone.", target: 14100, available: true },
];

const chronological = <T extends { completed_at: string; id: string }>(rows: T[]) => [...rows].sort((a, b) => Date.parse(a.completed_at) - Date.parse(b.completed_at) || a.id.localeCompare(b.id));
function uniqueCompletions(rows: LearningRewardCompletion[], key: (row: LearningRewardCompletion) => string) {
  const seen = new Set<string>();
  return rows.filter(row => { const k = key(row); if (seen.has(k)) return false; seen.add(k); return true; });
}

export function projectLearningRewards(input: {
  completions: LearningRewardCompletion[];
  ledger: LearningRewardLedgerEntry[];
  timezone: string;
  now: Date;
  featuredBadgeId?: string | null;
  seenAchievementIds?: string[];
}): LearningRewardsSummary {
  const { timezone, now } = input;
  const completions = chronological(input.completions);
  const ledger = [...input.ledger].sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at) || a.id.localeCompare(b.id));
  const totalXp = ledger.reduce((sum, row) => sum + row.xp, 0);
  const week = learningWeek(now, timezone);
  const weeklyXp = ledger.filter(row => Date.parse(row.occurred_at) >= Date.parse(week.startsAt) && Date.parse(row.occurred_at) < Date.parse(week.endsAt)).reduce((sum, row) => sum + row.xp, 0);
  const learned = completions.filter(row => row.action === "learn");
  const revisited = completions.filter(row => row.action === "revisit");
  const clinical = uniqueCompletions(completions.filter(row => row.action === "practice" && row.source_type === "clinical_practice"), row => row.metadata.clinicalCaseId ?? row.content_key);
  const followed = uniqueCompletions(completions.filter(row => row.action === "followup"), row => row.assignment_key);
  const returned = completions.filter(row => row.action === "followup" && row.metadata.followupDays === 30);

  const moduleGroups = new Map<string, LearningRewardCompletion[]>();
  for (const row of completions) {
    if (!row.metadata.moduleKey || !["learn", "practice", "revisit", "followup"].every(step => row.metadata.requiredSteps?.includes(step as LearningRewardCompletion["action"]))) continue;
    const key = `${row.metadata.moduleKey}@${row.content_version}`;
    moduleGroups.set(key, [...(moduleGroups.get(key) ?? []), row]);
  }
  const modules = [...moduleGroups.values()].map(rows => ({ rows, steps: new Set(rows.map(row => row.action)) }));
  const completedModules = modules.filter(module => module.steps.size === 4).sort((a, b) => Date.parse(a.rows[a.rows.length - 1].completed_at) - Date.parse(b.rows[b.rows.length - 1].completed_at));
  const patientModuleKeys = new Set<string>();
  const patientModules = completedModules.filter(module => {
    if (!module.rows.some(row => row.metadata.path === "patient-communication")) return false;
    const key = module.rows[0].metadata.moduleKey!;
    if (patientModuleKeys.has(key)) return false;
    patientModuleKeys.add(key);
    return true;
  });

  const weekSums = new Map<string, { xp: number; reachedAt: string | null }>();
  for (const row of ledger) {
    const key = learningWeek(new Date(row.occurred_at), timezone).startsAt;
    const previous = weekSums.get(key) ?? { xp: 0, reachedAt: null };
    const xp = previous.xp + row.xp;
    weekSums.set(key, { xp, reachedAt: previous.reachedAt ?? (xp >= WEEKLY_LEARNING_GOAL ? row.occurred_at : null) });
  }
  const reachedWeeks = [...weekSums.values()].filter((value): value is { xp: number; reachedAt: string } => value.reachedAt != null).sort((a, b) => Date.parse(a.reachedAt) - Date.parse(b.reachedAt));
  const thresholdAt = (threshold: number): string | null => {
    let xp = 0;
    for (const row of ledger) { xp += row.xp; if (xp >= threshold) return row.occurred_at; }
    return null;
  };
  const nth = (rows: LearningRewardCompletion[], count: number) => rows[count - 1]?.completed_at ?? null;
  const state: Partial<Record<LearningRewardBadgeId, { progress: number; earnedAt: string | null; available?: boolean }>> = {
    first: { progress: learned.length, earnedAt: nth(learned, 1) },
    circle: { progress: Math.max(0, ...modules.map(module => module.steps.size)), earnedAt: completedModules[0]?.rows.at(-1)?.completed_at ?? null, available: modules.length > 0 },
    second: { progress: revisited.length, earnedAt: nth(revisited, 1), available: revisited.length > 0 },
    weeks: { progress: reachedWeeks.length, earnedAt: reachedWeeks[3]?.reachedAt ?? null },
    patient: { progress: patientModules.length, earnedAt: patientModules[2]?.rows.at(-1)?.completed_at ?? null, available: modules.some(module => module.rows.some(row => row.metadata.path === "patient-communication")) },
    clinical: { progress: clinical.length, earnedAt: nth(clinical, 5) },
    follow: { progress: followed.length, earnedAt: nth(followed, 3) },
    return: { progress: returned.length, earnedAt: nth(returned, 1) },
    level10: { progress: totalXp, earnedAt: thresholdAt(xpAtLevel(10)) },
    level50: { progress: totalXp, earnedAt: thresholdAt(xpAtLevel(50)) },
  };
  const badges = BADGES.map(badge => {
    const s = state[badge.id];
    return { ...badge, progress: Math.min(badge.target, s?.progress ?? 0), earnedAt: s?.earnedAt ?? null, available: s?.available ?? badge.available };
  });
  const recentAchievements: LearningAchievement[] = badges.filter(badge => badge.earnedAt != null).map(badge => ({ id: `badge:${badge.id}`, kind: "badge", title: badge.name, earnedAt: badge.earnedAt! }));
  for (const level of LEARNING_MILESTONES) {
    const earnedAt = thresholdAt(xpAtLevel(level));
    if (earnedAt) recentAchievements.push({ id: `level:${level}`, kind: "milestone", title: `Level ${level}`, earnedAt });
  }
  recentAchievements.sort((a, b) => Date.parse(b.earnedAt) - Date.parse(a.earnedAt) || a.id.localeCompare(b.id));
  return {
    policyVersion: LEARNING_REWARDS_POLICY_VERSION,
    totalXp, weeklyXp, weeklyGoal: WEEKLY_LEARNING_GOAL,
    weeklyGoalReached: weeklyXp >= WEEKLY_LEARNING_GOAL,
    weeklyProgressPercent: Math.min(100, Math.floor(100 * weeklyXp / WEEKLY_LEARNING_GOAL)),
    level: learningLevel(totalXp), week, badges,
    featuredBadgeId: badges.find(badge => badge.id === input.featuredBadgeId && badge.earnedAt != null)?.id ?? null,
    recentAchievements,
    pendingAchievements: recentAchievements.filter(achievement => !input.seenAchievementIds?.includes(achievement.id)),
    team: { status: "unavailable", reason: "Team goals will appear when a verified weekly roster and participation snapshots are available." },
  };
}
