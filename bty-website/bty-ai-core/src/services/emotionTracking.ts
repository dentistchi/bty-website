import { getPool } from "../config/database";

// Emotion probe patterns (questions asking about feelings/emotions)
const EMOTION_PROBE_PATTERNS = [
  /어떤.*감정|어떤.*느낌|어떤.*기분|what.*feel|how.*feel/i,
  /감정.*이름|name.*feeling|느낌.*말해|기분.*표현/i,
  /지금.*느끼|지금.*감정|지금.*기분|right.*now.*feel/i,
  /어떤.*느껴|어떤.*느낌|어떤.*기분/i,
  /감정.*있|느낌.*있|기분.*있|feel.*emotion/i,
  /어떤.*마음|what.*mind|what.*heart/i,
  /상태.*어떤|state.*how|condition.*how/i,
];

/**
 * Detects if response contains emotion probing questions
 */
export function detectEmotionProbe(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  return EMOTION_PROBE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Gets previous turn's emotion_probe status from user_sessions
 */
export async function getPreviousEmotionProbe(
  userId: string
): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;

  try {
    const result = await pool.query(
      `SELECT emotion_probe FROM user_sessions WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0]?.emotion_probe ?? false;
  } catch (err) {
    console.error("[emotionTracking] Error getting previous emotion_probe:", err);
    return false;
  }
}

/**
 * Checks for consecutive emotion probes and sets emotion_overprocessing_flag
 * Returns true if emotion_overprocessing_flag should be set
 */
export async function checkEmotionOverprocessing(
  userId: string,
  currentEmotionProbe: boolean
): Promise<boolean> {
  const previousEmotionProbe = await getPreviousEmotionProbe(userId);
  
  // If both previous and current turns have emotion probes, set flag
  if (previousEmotionProbe && currentEmotionProbe) {
    return true;
  }
  
  return false;
}

/**
 * Updates user_sessions with current emotion_probe and emotion_overprocessing_flag
 */
export async function updateEmotionTracking(
  userId: string,
  emotionProbe: boolean,
  emotionOverprocessingFlag: boolean
): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  try {
    await pool.query(
      `INSERT INTO user_sessions (user_id, emotion_probe, emotion_overprocessing_flag, last_updated)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id)
       DO UPDATE SET
         emotion_probe = $2,
         emotion_overprocessing_flag = $3,
         last_updated = now()`,
      [userId, emotionProbe, emotionOverprocessingFlag]
    );
  } catch (err) {
    console.error("[emotionTracking] Error updating emotion tracking:", err);
  }
}

/**
 * Gets current emotion_overprocessing_flag status
 */
export async function getEmotionOverprocessingFlag(
  userId: string
): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;

  try {
    const result = await pool.query(
      `SELECT emotion_overprocessing_flag FROM user_sessions WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0]?.emotion_overprocessing_flag ?? false;
  } catch (err) {
    console.error("[emotionTracking] Error getting emotion_overprocessing_flag:", err);
    return false;
  }
}
