/**
 * Integrity Alignment Scoring
 * Tracks user progress in Integrity Mode (0-5 scale).
 * Increases with ownership, value references, long-term thinking.
 * Decreases with blame, reactive justification, value contradiction.
 */

import { getPool } from "../config/database";

const INTEGRITY_MODE_KEYWORDS = [
  /결정|decision|choice|judgment/i,
  /탓|blame|fault/i,
  /갈등|conflict|tension|escalation/i,
  /사업.*판단|business.*judgment/i,
  /금융.*위험|financial.*risk/i,
  /리더십.*압박|leadership.*pressure/i,
  /윤리|ethical|moral.*dilemma/i,
  /책임|responsibility|accountability/i,
  /가치.*정렬|values.*alignment/i,
  /통제.*영역|controllable/i,
  /정직|integrity/i,
];

/**
 * Checks if message should trigger Integrity Mode.
 */
export function isIntegrityMode(message: string): boolean {
  return INTEGRITY_MODE_KEYWORDS.some((pattern) => pattern.test(message));
}

const INTEGRITY_PATTERNS_INCREASE = {
  ownership: [
    /내\s*책임|내\s*선택|내\s*결정|내가\s*바꿀|I\s+(?:chose|decided|could|should|will)/i,
    /통제.*영역|controllable|my\s+part|my\s+responsibility/i,
    /내가\s*할\s*수\s*있는|what\s+I\s+can\s+do/i,
  ],
  values: [
    /가치|원칙|value|principle|belief|important\s+to\s+me/i,
    /되.*싶은.*사람|want\s+to\s+be|who\s+I\s+am/i,
    /정직|honest|integrity|align/i,
  ],
  longTerm: [
    /1년|미래|나중|future|long.*term|later/i,
    /되돌아보|돌아보면|looking\s+back|in\s+hindsight/i,
    /후회|regret|would\s+do\s+differently/i,
  ],
};

const INTEGRITY_PATTERNS_DECREASE = {
  blame: [
    /그들.*탓|그.*때문|their\s+fault|because\s+of\s+them/i,
    /상황.*탓|환경.*탓|circumstances|situation\s+made\s+me/i,
    /다른.*사람.*때문|other.*people.*fault/i,
  ],
  reactive: [
    /어쩔.*수.*없|할.*수.*없|had\s+no\s+choice|no\s+option/i,
    /반응.*할.*수.*밖에|couldn.*help|had\s+to\s+react/i,
    /자동.*반응|automatic|instinctive/i,
  ],
  contradiction: [
    /하지만.*그래도|but.*still|even\s+though/i,
    /알지만.*못|know.*but.*can.*t/i,
    /원칙.*하지만|principle.*but/i,
  ],
};

/**
 * Analyzes message for integrity alignment indicators.
 * Returns delta (-1, 0, or +1) based on patterns detected.
 */
function analyzeIntegrityDelta(message: string): number {
  const text = message.toLowerCase();
  let delta = 0;

  // Check for increase patterns
  const ownershipHits = INTEGRITY_PATTERNS_INCREASE.ownership.filter((p) =>
    p.test(message)
  ).length;
  const valuesHits = INTEGRITY_PATTERNS_INCREASE.values.filter((p) =>
    p.test(message)
  ).length;
  const longTermHits = INTEGRITY_PATTERNS_INCREASE.longTerm.filter((p) =>
    p.test(message)
  ).length;

  if (ownershipHits > 0 || valuesHits > 0 || longTermHits > 0) {
    delta += 1;
  }

  // Check for decrease patterns
  const blameHits = INTEGRITY_PATTERNS_DECREASE.blame.filter((p) =>
    p.test(message)
  ).length;
  const reactiveHits = INTEGRITY_PATTERNS_DECREASE.reactive.filter((p) =>
    p.test(message)
  ).length;
  const contradictionHits = INTEGRITY_PATTERNS_DECREASE.contradiction.filter(
    (p) => p.test(message)
  ).length;

  if (blameHits > 0 || reactiveHits > 0 || contradictionHits > 0) {
    delta -= 1;
  }

  // If both increase and decrease patterns found, prioritize decrease
  if (delta > 0 && (blameHits > 0 || reactiveHits > 0)) {
    delta = -1;
  }

  return delta;
}

/**
 * Gets current integrity alignment score for user.
 */
export async function getIntegrityScore(userId: string): Promise<number> {
  const pool = getPool();
  if (!pool) return 3; // Default neutral score

  try {
    const result = await pool.query<{ integrity_alignment_score: number }>(
      `SELECT integrity_alignment_score FROM user_sessions WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0]?.integrity_alignment_score ?? 3;
  } catch (err) {
    console.error("[integrityScoring] Error reading score:", err);
    return 3;
  }
}

/**
 * Updates integrity alignment score based on message analysis.
 * Returns new score (clamped 0-5).
 */
export async function updateIntegrityScore(
  userId: string,
  message: string
): Promise<number> {
  const pool = getPool();
  if (!pool) return 3;

  const delta = analyzeIntegrityDelta(message);
  const currentScore = await getIntegrityScore(userId);

  const newScore = Math.max(0, Math.min(5, currentScore + delta));

  try {
    await pool.query(
      `INSERT INTO user_sessions (user_id, integrity_alignment_score, last_updated)
       VALUES ($1, $2, now())
       ON CONFLICT (user_id)
       DO UPDATE SET
         integrity_alignment_score = $2,
         last_updated = now()`,
      [userId, newScore]
    );
    return newScore;
  } catch (err) {
    console.error("[integrityScoring] Error updating score:", err);
    return currentScore;
  }
}

/**
 * Checks if response contains integrity-related content
 */
export function detectIntegrityContent(text: string): boolean {
  return INTEGRITY_MODE_KEYWORDS.some((pattern) => pattern.test(text));
}

/**
 * Gets integrity turn count from user_sessions
 */
export async function getIntegrityTurnCount(userId: string): Promise<number> {
  const pool = getPool();
  if (!pool) return 0;

  try {
    const result = await pool.query(
      `SELECT integrity_turn_count FROM user_sessions WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0]?.integrity_turn_count ?? 0;
  } catch (err) {
    console.error("[integrityScoring] Error getting integrity_turn_count:", err);
    return 0;
  }
}

/**
 * Checks for integrity density and sets integrity_density_flag
 * Sets flag to true if integrity content detected in consecutive turns (>= 2)
 */
export async function checkIntegrityDensity(
  userId: string,
  hasIntegrityContent: boolean
): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;

  try {
    // Get current integrity turn count
    const currentCount = await getIntegrityTurnCount(userId);
    
    let newCount = 0;
    let integrity_density_flag = false;
    
    if (hasIntegrityContent) {
      // Increment count if integrity content detected
      newCount = currentCount + 1;
      // Set flag if >= 2 consecutive integrity turns
      integrity_density_flag = newCount >= 2;
    } else {
      // Reset count if no integrity content
      newCount = 0;
      integrity_density_flag = false;
    }
    
    // Update database
    await pool.query(
      `INSERT INTO user_sessions (user_id, integrity_turn_count, integrity_density_flag, last_updated)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id)
       DO UPDATE SET
         integrity_turn_count = $2,
         integrity_density_flag = $3,
         last_updated = now()`,
      [userId, newCount, integrity_density_flag]
    );
    
    return integrity_density_flag;
  } catch (err) {
    console.error("[integrityScoring] Error checking integrity density:", err);
    return false;
  }
}

/**
 * Gets current integrity_density_flag status
 */
export async function getIntegrityDensityFlag(userId: string): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;

  try {
    const result = await pool.query(
      `SELECT integrity_density_flag FROM user_sessions WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0]?.integrity_density_flag ?? false;
  } catch (err) {
    console.error("[integrityScoring] Error getting integrity_density_flag:", err);
    return false;
  }
}
