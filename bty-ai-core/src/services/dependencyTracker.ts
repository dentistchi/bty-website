/**
 * Tracks emotional dependency patterns in user conversations.
 * Flags repeated dependency behaviors to adjust AI response tone.
 */

import { getPool } from "../config/database";

const DEPENDENCY_THRESHOLD = 3;
const DEPENDENCY_PATTERNS = [
  /only\s+(you|ai|bot|this|here)/i,
  /can\s+only\s+talk\s+to\s+(you|ai|bot)/i,
  /no\s+one\s+else\s+(understands|listens|gets)/i,
  /you['']re\s+the\s+only\s+one/i,
  /혼자|나만|너만|당신만|여기만/i,
  /다른.*없어|아무도.*없어/i,
  /오직.*당신|오직.*너/i,
];

const VENTING_WITHOUT_ACTION_PATTERNS = [
  /(계속|또|다시|또다시).*(화|짜증|슬프|힘들)/i,
  /(always|keep|still).*(angry|sad|frustrated|upset)/i,
];

export type DependencyLevel = "low" | "medium" | "high";

export type DependencyCheckResult = {
  dependencyLevel: DependencyLevel;
  dependencyFlag: number;
  shouldReduceWarmth: boolean;
  shouldIncreaseRedirection: boolean;
};

/**
 * Checks if message shows dependency patterns.
 */
function detectDependencyPattern(message: string): boolean {
  const text = message.toLowerCase();
  return (
    DEPENDENCY_PATTERNS.some((pattern) => pattern.test(message)) ||
    VENTING_WITHOUT_ACTION_PATTERNS.some((pattern) => pattern.test(message))
  );
}

/**
 * Gets current dependency flag for user from database.
 */
async function getUserDependencyFlag(userId: string): Promise<number> {
  const pool = getPool();
  if (!pool) return 0;

  try {
    const result = await pool.query<{ dependency_flag: number }>(
      `SELECT dependency_flag FROM user_sessions WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0]?.dependency_flag ?? 0;
  } catch (err) {
    console.error("[dependencyTracker] Error reading flag:", err);
    return 0;
  }
}

/**
 * Increments dependency flag for user.
 */
async function incrementDependencyFlag(userId: string): Promise<number> {
  const pool = getPool();
  if (!pool) return 0;

  try {
    const result = await pool.query<{ dependency_flag: number }>(
      `INSERT INTO user_sessions (user_id, dependency_flag, last_updated)
       VALUES ($1, 1, now())
       ON CONFLICT (user_id)
       DO UPDATE SET
         dependency_flag = LEAST(user_sessions.dependency_flag + 1, 10),
         last_updated = now()
       RETURNING dependency_flag`,
      [userId]
    );
    return result.rows[0]?.dependency_flag ?? await getUserDependencyFlag(userId);
  } catch (err) {
    console.error("[dependencyTracker] Error incrementing flag:", err);
    return 0;
  }
}

/**
 * Resets dependency flag (e.g., when user takes real-world action).
 */
export async function resetDependencyFlag(userId: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  try {
    await pool.query(
      `UPDATE user_sessions SET dependency_flag = 0 WHERE user_id = $1`,
      [userId]
    );
  } catch (err) {
    console.error("[dependencyTracker] Error resetting flag:", err);
  }
}

/**
 * Checks message for dependency patterns and updates flag.
 * Returns dependency level and response adjustments.
 */
export async function checkDependency(
  userId: string,
  message: string
): Promise<DependencyCheckResult> {
  const hasPattern = detectDependencyPattern(message);
  let flag = await getUserDependencyFlag(userId);

  if (hasPattern) {
    flag = await incrementDependencyFlag(userId);
  }

  const dependencyLevel: DependencyLevel =
    flag >= DEPENDENCY_THRESHOLD ? "high" : flag >= 2 ? "medium" : "low";

  return {
    dependencyLevel,
    dependencyFlag: flag,
    shouldReduceWarmth: flag >= DEPENDENCY_THRESHOLD,
    shouldIncreaseRedirection: flag >= DEPENDENCY_THRESHOLD,
  };
}
