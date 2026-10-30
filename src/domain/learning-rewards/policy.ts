import { userDayKey } from "@/domain/daily/userDayKey";
import type { LearningRewardAction, LearningRewardEvidence } from "./types";
export { LEARNING_REWARDS_POLICY_VERSION } from "./types";

export const LEARNING_REWARD_XP: Readonly<Record<LearningRewardAction, number>> = {
  learn: 10, practice: 20, revisit: 20, followup: 10,
};
export const WEEKLY_LEARNING_GOAL = 60;
export const LEARNING_MILESTONES = [5, 10, 20, 50] as const;

export function xpAtLevel(level: number): number {
  if (!Number.isSafeInteger(level) || level < 1) throw Error("INVALID_LEVEL");
  return level <= 6 ? 30 * level * (level - 1) : 900 + 300 * (level - 6);
}

export function learningLevel(totalXp: number) {
  if (!Number.isSafeInteger(totalXp) || totalXp < 0) throw Error("INVALID_XP");
  let current = totalXp >= 900 ? 6 + Math.floor((totalXp - 900) / 300) : 1;
  while (totalXp < 900 && xpAtLevel(current + 1) <= totalXp) current += 1;
  const nextMilestone = LEARNING_MILESTONES.find(level => level > current) ?? null;
  return {
    current,
    next: current + 1,
    xpIntoLevel: totalXp - xpAtLevel(current),
    xpForNextLevel: Math.min(60 * current, 300),
    nextLevelTotalXp: xpAtLevel(current + 1),
    xpToNextLevel: xpAtLevel(current + 1) - totalXp,
    progressPercent: Math.floor(100 * (totalXp - xpAtLevel(current)) / Math.min(60 * current, 300)),
    nextMilestone,
    nextMilestoneXp: nextMilestone == null ? null : xpAtLevel(nextMilestone),
  };
}

function localParts(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(instant);
  const get = (key: string) => Number(parts.find(p => p.type === key)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** Convert each LOCAL calendar boundary independently. Never subtract 168 UTC hours across DST. */
function localFive(dayKey: string, timezone: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const wall = Date.UTC(year, month - 1, day, 5);
  let candidate = wall;
  for (let i = 0; i < 6; i += 1) {
    const p = localParts(new Date(candidate), timezone);
    const represented = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const correction = wall - represented;
    candidate += correction;
    if (correction === 0) return new Date(candidate).toISOString();
  }
  throw Error("INVALID_WEEK_BOUNDARY");
}

export function learningWeek(instant: Date, timezone: string) {
  if (!Number.isFinite(instant.getTime())) throw Error("INVALID_INSTANT");
  const day = userDayKey(instant, timezone, 5);
  const calendar = new Date(`${day}T00:00:00.000Z`);
  const daysSinceMonday = (calendar.getUTCDay() + 6) % 7;
  const monday = new Date(calendar.getTime() - daysSinceMonday * 86_400_000);
  const next = new Date(monday.getTime() + 7 * 86_400_000);
  return { startsAt: localFive(monday.toISOString().slice(0, 10), timezone), endsAt: localFive(next.toISOString().slice(0, 10), timezone), timezone };
}

/** Extra defensive validation after source verification. This never accepts browser input. */
export function isValidLearningEvidence(e: LearningRewardEvidence, startedAt: string, now: Date): boolean {
  const at = Date.parse(e.completed_at);
  const since = Date.parse(startedAt);
  if (!Number.isFinite(at) || !Number.isFinite(since) || at < since || at > now.getTime()) return false;
  if (!e.source_id || !e.assignment_key || !e.content_key || !e.content_version) return false;
  const expected: Record<LearningRewardAction, LearningRewardEvidence["source_type"]> = {
    learn: "foundry_learn", practice: "clinical_practice", revisit: "assigned_revisit", followup: "foundry_followup",
  };
  if (e.policy_version !== "learning-rewards/v1" || expected[e.action] !== e.source_type) return false;
  if (e.action === "revisit") {
    const baseline = Date.parse(e.metadata.revisitBaselineAt ?? "");
    if (!Number.isFinite(baseline) || at - baseline < 72 * 60 * 60 * 1000
      || !e.metadata.revisitVariant || !e.metadata.baselineVariant || e.metadata.revisitVariant === e.metadata.baselineVariant) return false;
  }
  try { new Intl.DateTimeFormat("en-US", { timeZone: e.timezone }).format(now); } catch { return false; }
  return true;
}
