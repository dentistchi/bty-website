/**
 * Maturity Scoring Engine
 * Internal 0–5 scoring per category. Never exposes numeric scores to frontend.
 * Emits "Maturity Signals" as user-friendly feedback.
 * Full MaturityScore is stored internally for analytics only.
 */

export type MaturitySignalType =
  | "emotional_pause"
  | "ownership"
  | "perspective"
  | "integrity"
  | "recovery";

/** Internal score shape for analytics. Not exposed externally. */
export interface MaturityScore {
  emotional_regulation: number;
  ownership_level: number;
  perspective_taking: number;
  integrity_alignment: number;
  recovery_effort: number;
  integrity_alignment_score: number; // 0-5 from integrityScoring service (leaders only)
  seri: number; // 0-5: weighted composite index
  detected_emotion: string;
  maturity_risk_level: string;
}

/**
 * Calculates SERI (Self-Emotional-Regulation-Integrity) composite index.
 * Weighted average: emotional_regulation(0.3) + ownership_level(0.25) + 
 * perspective_taking(0.2) + integrity_alignment(0.15) + recovery_effort(0.1)
 */
export function calculateSERI(score: {
  emotional_regulation: number;
  ownership_level: number;
  perspective_taking: number;
  integrity_alignment: number;
  recovery_effort: number;
}): number {
  return (
    score.emotional_regulation * 0.3 +
    score.ownership_level * 0.25 +
    score.perspective_taking * 0.2 +
    score.integrity_alignment * 0.15 +
    score.recovery_effort * 0.1
  );
}

/** Returned to API only. No numeric scores. */
export type MaturityDeltaResult = {
  signals: string[];
  signalType?: MaturitySignalType;
};

type InternalCategoryScores = {
  emotionalRegulation: number;
  ownershipLevel: number;
  perspectiveTaking: number;
  integrityAlignment: number;
  recoveryEffort: number;
};

const MATURITY_SIGNALS: Record<MaturitySignalType, string> = {
  emotional_pause: "🌿 Emotional Pause Detected",
  ownership: "🪞 Ownership Activated",
  perspective: "🤝 Perspective Expanded",
  integrity: "🎯 Integrity Alignment",
  recovery: "🔄 Recovery Attempt Logged",
};

// Pattern keywords per category (Korean + English)
const CATEGORY_PATTERNS: RegExp[][] = [
  // Emotional Regulation: calm, pause, reflect, naming feelings
  [
    /느낌|감정|기분|마음|calm|pause|reflect|숨\s*쉬|차분|진정/i,
    /화|짜증|불안|걱정|angry|anxious|worried/i,
    /인정|받아들|accept|acknowledge/i,
  ],
  // Ownership: "I", responsibility, my part
  [
    /나\s*때문|내\s*편|내가|제가|I\s+(?:need|should|could|will)/i,
    /책임|맡|responsibility|ownership|my\s+part/i,
    /제어|통제|control|바꿀\s*수/i,
  ],
  // Perspective Taking: other's view, imagine, consider
  [
    /상대|다른\s*사람|입장|view|perspective|consider/i,
    /만약|혹시|아마|perhaps|maybe|might/i,
    /이해|공감|understand|empath/i,
  ],
  // Integrity Alignment: values, honest, consistency
  [
    /솔직|정직|honest|integrity|values?|가치/i,
    /일관|consistent|원칙|principle/i,
    /정직|진실|truth|align/i,
  ],
  // Recovery Effort: try again, learn, next step
  [
    /다시|재도전|재시도|try\s+again|recover/i,
    /배운|학습|learn|성장|grow/i,
    /다음|한\s*걸음|next\s*step|작은\s*실천/i,
  ],
];

const CATEGORY_KEYS: (keyof InternalCategoryScores)[] = [
  "emotionalRegulation",
  "ownershipLevel",
  "perspectiveTaking",
  "integrityAlignment",
  "recoveryEffort",
];

const REFLECTION_PATTERNS = [
  /인정|받아들|accept|acknowledge|reflect|숨\s*쉬|차분|진정/i,
  /감정|느낌|기분|마음|naming|느껴보/i,
];

function userReflects(conversation: string): boolean {
  return REFLECTION_PATTERNS.some((p) => p.test(conversation));
}

function analyzeConversation(
  conversation: string,
  emotionTag: string,
  riskLevel: string
): InternalCategoryScores {
  const text = conversation.toLowerCase().trim();
  const scores: InternalCategoryScores = {
    emotionalRegulation: 0,
    ownershipLevel: 0,
    perspectiveTaking: 0,
    integrityAlignment: 0,
    recoveryEffort: 0,
  };

  CATEGORY_KEYS.forEach((key, idx) => {
    const patterns = CATEGORY_PATTERNS[idx]!;
    let hits = 0;
    for (const p of patterns) {
      if (p.test(conversation)) hits++;
    }
    let raw = Math.min(
      5,
      Math.floor((hits / patterns.length) * 5) + (text.length > 50 ? 1 : 0)
    );
    scores[key] = raw;
  });

  // riskLevel == "high": emotional_regulation max = 2
  if (riskLevel === "high") {
    scores.emotionalRegulation = Math.min(2, scores.emotionalRegulation);
  }

  // emotionTag == "shame": reduce ownership scoring weight slightly
  if (emotionTag === "shame") {
    scores.ownershipLevel = Math.max(
      0,
      Math.floor(scores.ownershipLevel * 0.85)
    );
  }

  // emotionTag == "anger" and user reflects: increase emotional_regulation bonus
  if (emotionTag === "anger" && userReflects(conversation)) {
    scores.emotionalRegulation = Math.min(
      5,
      scores.emotionalRegulation + 1
    );
  }

  return scores;
}

import { getPool } from "../config/database";

/** Internal analytics store. Scores are never exposed. */
const analyticsStore: MaturityScore[] = [];

async function storeMaturityScoreForAnalytics(
  score: MaturityScore,
  userId: string,
  role: string
): Promise<void> {
  analyticsStore.push(score);
  if (analyticsStore.length > 1000) analyticsStore.shift();

  // Also store in database for admin metrics
  const pool = getPool();
  if (!pool) return;

  try {
    await pool.query(
      `INSERT INTO maturity_scores (
        user_id, role, emotional_regulation, ownership_level, perspective_taking,
        integrity_alignment, recovery_effort, integrity_alignment_score, seri,
        detected_emotion, maturity_risk_level
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        userId,
        role,
        score.emotional_regulation,
        score.ownership_level,
        score.perspective_taking,
        score.integrity_alignment,
        score.recovery_effort,
        score.integrity_alignment_score,
        score.seri,
        score.detected_emotion,
        score.maturity_risk_level,
      ]
    );
  } catch (err) {
    console.error("[maturityScoring] Error storing score:", err);
  }
}

/** Map internal category to signal type */
function categoryToSignalType(
  category: keyof InternalCategoryScores
): MaturitySignalType {
  const map: Record<keyof InternalCategoryScores, MaturitySignalType> = {
    emotionalRegulation: "emotional_pause",
    ownershipLevel: "ownership",
    perspectiveTaking: "perspective",
    integrityAlignment: "integrity",
    recoveryEffort: "recovery",
  };
  return map[category];
}

/**
 * Probabilistically emit a signal. Higher score = higher chance.
 * Never expose numeric scores.
 */
function maybeEmitSignal(
  score: number,
  category: keyof InternalCategoryScores
): { signal: string; type: MaturitySignalType } | null {
  if (score < 2) return null;
  const threshold = 0.3 + score * 0.1;
  if (Math.random() > threshold) return null;

  const signalType = categoryToSignalType(category);
  return {
    signal: MATURITY_SIGNALS[signalType],
    type: signalType,
  };
}

function toMaturityScore(
  internal: InternalCategoryScores,
  emotionTag: string,
  riskLevel: string,
  integrityAlignmentScore: number = 0
): MaturityScore {
  const baseScore = {
    emotional_regulation: internal.emotionalRegulation,
    ownership_level: internal.ownershipLevel,
    perspective_taking: internal.perspectiveTaking,
    integrity_alignment: internal.integrityAlignment,
    recovery_effort: internal.recoveryEffort,
  };
  return {
    ...baseScore,
    integrity_alignment_score: integrityAlignmentScore,
    seri: calculateSERI(baseScore),
    detected_emotion: emotionTag,
    maturity_risk_level: riskLevel,
  };
}

/**
 * Calculate maturity delta from conversation.
 * Returns user-facing signals only. Numeric scores stored internally for analytics.
 * Also returns internal score (including SERI) for conditional logic (not exposed to users).
 */
export async function calculateMaturityDelta(
  conversation: string,
  emotionTag: string,
  riskLevel: string,
  integrityAlignmentScore: number = 0,
  userId?: string,
  role?: string
): Promise<MaturityDeltaResult & { _internalScore?: MaturityScore }> {
  const internal = analyzeConversation(conversation, emotionTag, riskLevel);
  const score = toMaturityScore(
    internal,
    emotionTag,
    riskLevel,
    integrityAlignmentScore
  );
  if (userId && role) {
    await storeMaturityScoreForAnalytics(score, userId, role);
  } else {
    analyticsStore.push(score);
    if (analyticsStore.length > 1000) analyticsStore.shift();
  }

  const emitted: { signal: string; type: MaturitySignalType }[] = [];

  (Object.entries(internal) as [keyof InternalCategoryScores, number][]).forEach(
    ([category, s]) => {
      const result = maybeEmitSignal(s, category);
      if (result && !emitted.some((e) => e.signal === result.signal)) {
        emitted.push(result);
      }
    }
  );

  const signals = emitted.map((e) => e.signal);
  const signalType = emitted.length > 0 ? emitted[0].type : undefined;

  return {
    signals,
    signalType,
    _internalScore: score, // Internal only, not exposed in API
  };
}
