import { getPool } from "../config/database";
import { countSentences, countMaturityMoves, detectCoachingLanguage, detectToneDrift } from "./guardrails";
import { detectEmotionProbe } from "./emotionTracking";
import { openai } from "../config/openai";
import type { PacingProfile } from "./pacingProfiles";

/**
 * Conversation Stability Score (CSS)
 * Base score: 5
 * Subtracts penalties for various violations
 */

const CSS_BASE = 5;

/**
 * Calculates sentence penalty based on sentence count
 */
function calculateSentencePenalty(text: string): number {
  const sentenceCount = countSentences(text);
  
  if (sentenceCount <= 3) {
    return 0; // No penalty
  } else if (sentenceCount === 4) {
    return 1; // -1 penalty
  } else if (sentenceCount >= 5) {
    return 2; // -2 penalty
  }
  
  return 0;
}

/**
 * Calculates question penalty based on question count
 */
function calculateQuestionPenalty(text: string): number {
  const questionCount = (text.match(/\?/g) || []).length;
  
  if (questionCount === 0) {
    return 0; // No penalty
  } else if (questionCount === 1) {
    return 0; // No penalty
  } else {
    return questionCount - 1; // -1 per extra question
  }
}

/**
 * Calculates coaching penalty
 */
function calculateCoachingPenalty(text: string): number {
  if (detectCoachingLanguage(text)) {
    return 2; // -2 penalty
  }
  return 0;
}

/**
 * Calculates escalation penalty (multiple maturity stages in one response)
 */
function calculateEscalationPenalty(maturityMoves: number): number {
  if (maturityMoves <= 1) {
    return 0; // No penalty
  } else {
    return maturityMoves - 1; // -1 per extra move
  }
}

/**
 * Calculates emotion overprocessing penalty
 */
function calculateEmotionOverprocessingPenalty(emotionOverprocessingFlag: boolean): number {
  if (emotionOverprocessingFlag) {
    return 1; // -1 penalty
  }
  return 0;
}

export type CSSResult = {
  css: number;
  base: number;
  sentence_penalty: number;
  question_penalty: number;
  coaching_penalty: number;
  tone_drift: number;
  escalation_penalty: number;
  emotion_overprocessing_penalty: number;
  pacing_profile_penalty?: number;
};

/**
 * Calculates pacing profile violation penalties
 */
function calculatePacingProfilePenalty(
  text: string,
  profile: PacingProfile | null
): number {
  if (!profile) return 0;

  let penalty = 0;

  // Penalty 1: If response violates pacingProfile.maxSentences -> -2
  const sentenceCount = countSentences(text);
  if (sentenceCount > profile.maxSentences) {
    penalty += 2;
  }

  // Penalty 2: If response has question mark when allowQuestion=false -> -3
  const hasQuestion = /[?？]|까요|나요|인가요|을까요/.test(text);
  if (!profile.allowQuestion && hasQuestion) {
    penalty += 3;
  }

  // Penalty 3: If response suggests action when allowActionSuggestion=false -> -2
  const actionPatterns = [
    /할.*수.*있는.*걸음|다음.*단계|작은.*실험|한.*가지만.*해보|시도해보/i,
    /해야|해야.*할|해볼.*수|시작해볼|바꿔볼/i,
    /next.*step|small.*action|try.*change|experiment/i,
  ];
  const suggestsAction = actionPatterns.some((pattern) => pattern.test(text));
  if (!profile.allowActionSuggestion && suggestsAction) {
    penalty += 2;
  }

  return penalty;
}

/**
 * Calculates Conversation Stability Score (CSS)
 */
export async function calculateCSS(
  text: string,
  userId: string,
  emotionOverprocessingFlag: boolean,
  pacingProfile?: PacingProfile | null,
  silenceMode?: boolean
): Promise<CSSResult> {
  // HARD RULE: If silence mode is active, set CSS score to 5 (stable) and skip all penalties
  if (silenceMode) {
    return {
      css: CSS_BASE, // 5 (stable)
      base: CSS_BASE,
      sentence_penalty: 0,
      question_penalty: 0,
      coaching_penalty: 0,
      tone_drift: 0,
      escalation_penalty: 0,
      emotion_overprocessing_penalty: 0,
      pacing_profile_penalty: 0,
    };
  }

  const sentence_penalty = calculateSentencePenalty(text);
  const question_penalty = calculateQuestionPenalty(text);
  const coaching_penalty = calculateCoachingPenalty(text);
  
  // Get tone_drift from database
  const pool = getPool();
  let tone_drift = 0;
  if (pool) {
    try {
      const result = await pool.query(
        `SELECT tone_drift FROM user_sessions WHERE user_id = $1`,
        [userId]
      );
      tone_drift = result.rows[0]?.tone_drift ?? 0;
    } catch (err) {
      console.error("[conversationStability] Error getting tone_drift:", err);
    }
  }
  
  // Count maturity moves for escalation penalty
  const maturityMoves = countMaturityMoves(text);
  const escalation_penalty = calculateEscalationPenalty(maturityMoves);
  
  const emotion_overprocessing_penalty = calculateEmotionOverprocessingPenalty(
    emotionOverprocessingFlag
  );

  // Calculate pacing profile violation penalty
  const pacing_profile_penalty = calculatePacingProfilePenalty(text, pacingProfile || null);
  
  const css = Math.max(
    0,
    CSS_BASE -
      sentence_penalty -
      question_penalty -
      coaching_penalty -
      tone_drift -
      escalation_penalty -
      emotion_overprocessing_penalty -
      pacing_profile_penalty
  );
  
  return {
    css,
    base: CSS_BASE,
    sentence_penalty,
    question_penalty,
    coaching_penalty,
    tone_drift,
    escalation_penalty,
    emotion_overprocessing_penalty,
    pacing_profile_penalty,
  };
}

/**
 * Updates CSS score in organization_emotional_metrics
 * Note: This should be called after insertEmotionalMetric to update the same row
 */
export async function updateCSSInMetrics(
  userId: string,
  cssScore: number
): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  try {
    // Update the most recent row for this user
    await pool.query(
      `UPDATE organization_emotional_metrics 
       SET css_score = $1 
       WHERE user_id = $2 
       AND timestamp = (SELECT MAX(timestamp) FROM organization_emotional_metrics WHERE user_id = $2)`,
      [cssScore, userId]
    );
  } catch (err) {
    console.error("[conversationStability] Error updating CSS in metrics:", err);
  }
}

export type PreviousTurn = {
  emotion_probe?: boolean;
  emotion_overprocessing_flag?: boolean;
};

export type ResponseAnalysis = {
  css_score: number;
  sentence_count: number;
  question_count: number;
  coaching_flag: boolean;
  emotion_overprocessing_flag: boolean;
  escalation_flag: boolean;
  tone_drift_flag: boolean;
  pacing_profile_violation: boolean;
  needs_rewrite: boolean;
};

/**
 * Analyzes response and returns flags and CSS score
 */
export async function analyzeResponse(
  text: string,
  previousTurn: PreviousTurn,
  userId: string,
  pacingProfile?: PacingProfile | null,
  silenceMode?: boolean
): Promise<ResponseAnalysis> {
  // HARD RULE: If silence mode is active, set CSS score to 5 (stable) and skip rewrite check
  if (silenceMode) {
    return {
      css_score: CSS_BASE, // 5 (stable)
      sentence_count: countSentences(text),
      question_count: (text.match(/\?/g) || []).length,
      coaching_flag: false,
      emotion_overprocessing_flag: false,
      escalation_flag: false,
      tone_drift_flag: false,
      pacing_profile_violation: false,
      needs_rewrite: false, // Skip rewrite check
    };
  }

  const sentence_count = countSentences(text);
  const question_count = (text.match(/\?/g) || []).length;
  const coaching_flag = detectCoachingLanguage(text);
  const tone_drift_flag = detectToneDrift(text);
  
  // Check for emotion overprocessing (consecutive emotion probes)
  const currentEmotionProbe = detectEmotionProbe(text);
  const emotion_overprocessing_flag =
    (previousTurn.emotion_probe ?? false) && currentEmotionProbe;
  
  // Check for escalation (multiple maturity moves)
  const maturityMoves = countMaturityMoves(text);
  const escalation_flag = maturityMoves >= 2;
  
  // Check for pacing profile violations
  const pacing_profile_penalty = calculatePacingProfilePenalty(text, pacingProfile || null);
  const pacing_profile_violation = pacing_profile_penalty > 0;
  
  // Calculate CSS score
  const sentence_penalty = calculateSentencePenalty(text);
  const question_penalty = calculateQuestionPenalty(text);
  const coaching_penalty = coaching_flag ? 2 : 0;
  
  // Get tone_drift from database
  const pool = getPool();
  let tone_drift = 0;
  if (pool) {
    try {
      const result = await pool.query(
        `SELECT tone_drift FROM user_sessions WHERE user_id = $1`,
        [userId]
      );
      tone_drift = result.rows[0]?.tone_drift ?? 0;
    } catch (err) {
      console.error("[conversationStability] Error getting tone_drift:", err);
    }
  }
  
  const escalation_penalty = escalation_flag ? maturityMoves - 1 : 0;
  const emotion_overprocessing_penalty = emotion_overprocessing_flag ? 1 : 0;
  
  const css_score = Math.max(
    0,
    CSS_BASE -
      sentence_penalty -
      question_penalty -
      coaching_penalty -
      tone_drift -
      escalation_penalty -
      emotion_overprocessing_penalty -
      pacing_profile_penalty
  );
  
  const needs_rewrite = css_score <= 2;
  
  return {
    css_score,
    sentence_count,
    question_count,
    coaching_flag,
    emotion_overprocessing_flag,
    escalation_flag,
    tone_drift_flag,
    pacing_profile_violation,
    needs_rewrite,
  };
}

/**
 * Rewrites response using GPT-4o when CSS score is low
 * Uses constraints from pacing profile if provided
 */
export async function rewriteLowCSSResponse(
  text: string,
  pacingProfile?: PacingProfile | null
): Promise<string> {
  try {
    // Build rewrite instructions based on pacing profile
    let rewriteInstructions = "Rewrite into warm mentor tone, Korean. ";
    
    if (pacingProfile) {
      rewriteInstructions += `${pacingProfile.maxSentences} sentences max. `;
      
      if (!pacingProfile.allowQuestion) {
        rewriteInstructions += "No question marks. ";
      } else if (pacingProfile.questionStyle === "one_short") {
        rewriteInstructions += "Maximum one short question. ";
      } else if (pacingProfile.questionStyle === "offer_two_choices") {
        rewriteInstructions += "End with exactly 2 options, no extra question. ";
      }
      
      if (!pacingProfile.allowActionSuggestion) {
        rewriteInstructions += "No action suggestions. ";
      } else {
        rewriteInstructions += "Suggest only ONE tiny action if appropriate. ";
      }
      
      rewriteInstructions += "No coaching phrases. No analysis tone. ";
    } else {
      // Default constraints if no profile provided
      rewriteInstructions += "2 sentences max, one question max, no coaching phrases, no analysis tone. ";
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: rewriteInstructions,
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0.5,
      max_tokens: 200,
    });

    const rewritten = completion.choices[0]?.message?.content?.trim() ?? text;
    return rewritten;
  } catch (err: any) {
    console.error("[conversationStability] Error rewriting low CSS response:", {
      message: err?.message,
      code: err?.code,
    });
    // Fallback: return original text
    return text;
  }
}
