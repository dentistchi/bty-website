/**
 * Arena / Lab XP formulas per docs/spec/ARENA_LAB_XP_SPEC.md.
 * Pure functions only; no DB or side effects.
 */

export type DifficultyKey = "easy" | "mid" | "hard" | "extreme";

const DIFFICULTY_BASE: Record<DifficultyKey, number> = {
  easy: 10,
  mid: 20,
  hard: 35,
  extreme: 50,
};

/** Base XP for difficulty. MVP may lock extreme. */
export function getDifficultyBase(difficulty: DifficultyKey): number {
  return DIFFICULTY_BASE[difficulty] ?? DIFFICULTY_BASE.mid;
}

/** Lab: Core XP only. round(base × 0.6). Weekly XP = 0. */
export function computeLabCoreXp(difficulty: DifficultyKey): number {
  const base = getDifficultyBase(difficulty);
  return Math.max(0, Math.round(base * 0.6));
}

export type ArenaXpInput = {
  difficulty: DifficultyKey;
  /** Primary choice bonus (A/B). MVP: use xp_base as primary. */
  xpPrimary: number;
  /** Reinforce choice bonus (X/Y). round(xp_base * 0.5). MVP: 0 if no reinforce. */
  xpReinforce?: number;
  /** 0..0.25. Arena only; from time_remaining. */
  timeFactor?: number;
  /** 0..0.20. Streak days. */
  streakFactor?: number;
};

/** Arena Core XP = primary + reinforce + time_bonus + streak_bonus. */
export function computeArenaCoreXp(input: ArenaXpInput): number {
  const base = getDifficultyBase(input.difficulty);
  const primary = input.xpPrimary;
  const reinforce = input.xpReinforce ?? 0;
  const timeBonus = input.timeFactor != null
    ? Math.round(base * Math.max(0, Math.min(0.25, input.timeFactor)))
    : 0;
  const streakBonus = input.streakFactor != null
    ? Math.round(base * Math.max(0, Math.min(0.2, input.streakFactor)))
    : 0;
  return Math.max(0, primary + reinforce + timeBonus + streakBonus);
}

/** Arena Weekly XP. MVP: same as core (base + reinforce + time). No streak in weekly if spec says so. */
export function computeArenaWeeklyXp(input: ArenaXpInput): number {
  return computeArenaCoreXp(input);
}

/** Daily Lab attempt limit per spec. */
export const LAB_DAILY_ATTEMPT_LIMIT = 3;

/** Streak factor from consecutive play days. Arena only; per spec §3.5. */
export function streakFactorFromDays(days: number): number {
  const d = Math.max(0, Math.floor(days));
  if (d <= 1) return 0;
  if (d === 2) return 0.05;
  if (d === 3) return 0.1;
  return Math.min(0.2, 0.15);
}

/** Infer difficulty key from run total event XP (for Arena run/complete when difficulty not stored). */
export function inferDifficultyFromEventSum(eventSum: number): DifficultyKey {
  const s = Math.max(0, Math.round(eventSum));
  if (s <= 15) return "easy";
  if (s <= 27) return "mid";
  if (s <= 42) return "hard";
  return "extreme";
}

const DIFFICULTY_KEYS: DifficultyKey[] = ["easy", "mid", "hard", "extreme"];

/** Parse stored difficulty string; returns null if invalid. */
export function parseStoredDifficulty(v: unknown): DifficultyKey | null {
  if (typeof v !== "string") return null;
  if (DIFFICULTY_KEYS.includes(v as DifficultyKey)) return v as DifficultyKey;
  return null;
}

/**
 * Derive difficulty key from scenario choices (average of choice.difficulty multiplier).
 * Used when creating a run so server can use stored difficulty in run/complete.
 */
export function difficultyFromScenarioChoices(choices: { difficulty: number }[]): DifficultyKey {
  if (!choices.length) return "mid";
  const sum = choices.reduce((s, c) => s + (Number(c.difficulty) || 1), 0);
  const avg = sum / choices.length;
  if (avg < 0.7) return "easy";
  if (avg < 1.1) return "mid";
  if (avg < 1.4) return "hard";
  return "extreme";
}

/**
 * Time factor from remaining time. Per spec §3.4:
 * time_factor = clamp((time_remaining / time_limit - 0.5) × 0.5, 0, 0.25)
 * Returns 0 if time_limit <= 0 or missing.
 */
export function timeFactorFromRemaining(
  timeRemaining: number,
  timeLimit: number
): number {
  if (timeLimit <= 0 || !Number.isFinite(timeLimit)) return 0;
  const ratio = Number.isFinite(timeRemaining) ? timeRemaining / timeLimit : 0;
  const raw = (ratio - 0.5) * 0.5;
  return Math.max(0, Math.min(0.25, raw));
}
