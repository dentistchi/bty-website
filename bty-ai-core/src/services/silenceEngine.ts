/**
 * Silence Engine
 * Determines when to use silence and what style to use
 * to allow user reflection without immediate AI response
 */

import { getPool } from "../config/database";
import { getPreviousWasSilence } from "./previousTurnTracker";

/**
 * Silence Sentence Library categorized by emotion/context
 */
const SILENCE_LIBRARY = {
  // 안정 문장 (for fear/shame)
  stability: [
    "지금 마음이 먼저 다친 것 같아요.",
    "지금은 서두르지 않아도 됩니다.",
    "지금은 판단보다 이해가 먼저 같아요.",
    "그 상황에서 버틴 것만으로도 충분히 큰 일이에요.",
  ],
  // 중심 문장 (for anger)
  center: [
    "지금은 결론보다 숨을 고르는 게 먼저예요.",
    "지금은 정답보다 중심이 중요해 보여요.",
    "그 말 속에 이미 핵심이 있어요.",
  ],
  // 멈춤 문장 (for frustration)
  pause: [
    "여기서 한 번 멈추는 게 더 성숙할 수 있어요.",
    "그건 가볍게 넘길 일이 아니죠.",
  ],
  // 성장 문장 (for responsibility tone)
  growth: [
    "그건 책임감이 있는 사람만 느끼는 무게예요.",
    "이건 당신이 대충 살고 있지 않다는 증거네요.",
    "그 말을 꺼낸 것 자체가 이미 한 걸음이에요.",
  ],
};

/** Flattened list for fallback when critic+rewrite fails */
const ALL_SILENCE_SENTENCES = [
  ...SILENCE_LIBRARY.stability,
  ...SILENCE_LIBRARY.center,
  ...SILENCE_LIBRARY.pause,
  ...SILENCE_LIBRARY.growth,
];

/**
 * Returns a random silence sentence for fallback (e.g. when critic+rewrite still fails).
 */
export function getFallbackSilenceSentence(): string {
  const idx = Math.floor(Math.random() * ALL_SILENCE_SENTENCES.length);
  return ALL_SILENCE_SENTENCES[idx] ?? "지금은 결론보다 숨을 고르는 게 먼저예요.";
}

export type SilenceDecision = {
  use_silence: boolean;
  style: "reflect_only" | "reflect_and_pause" | "one_line_anchor";
  reason: string;
  selectedSentence?: string; // Added to store selected sentence
};

export type SilenceModeParams = {
  userText: string;
  detectedEmotion: string;
  riskLevel: "low" | "medium" | "high";
  cssScore: number;
  previousWasQuestion: boolean;
  userTurnLength: "short" | "medium" | "long";
  userId?: string; // Added for session tracking
};

export type SilenceSentenceContext = {
  detectedEmotion: string;
  userText: string;
  userId?: string;
};

/**
 * Detects if user text shows responsibility tone
 */
function detectResponsibilityTone(text: string): boolean {
  const responsibilityPatterns = [
    /내가.*할.*수.*있는|what.*I.*can.*do|내가.*먼저|I.*first/i,
    /내가.*바꾸면|if.*I.*change|내가.*변화|I.*can.*change/i,
    /내.*책임|my.*responsibility|내.*선택|my.*choice/i,
    /내가.*결정|I.*decide|내가.*통제|I.*control/i,
    /내가.*해야|I.*should|내가.*해야.*할|I.*need.*to/i,
    /책임|responsibility|accountability/i,
    /통제.*영역|controllable|my\s+part/i,
  ];
  return responsibilityPatterns.some((pattern) => pattern.test(text));
}

/**
 * Gets last 3 used silence sentence indices from database
 */
async function getLastSilenceIndices(userId: string): Promise<number[]> {
  const pool = getPool();
  if (!pool || !userId) return [];

  try {
    const result = await pool.query(
      `SELECT last_silence_indices FROM user_sessions WHERE user_id = $1`,
      [userId]
    );
    const indices = result.rows[0]?.last_silence_indices;
    if (Array.isArray(indices)) {
      return indices.slice(-3); // Return last 3
    }
    return [];
  } catch (err) {
    console.error("[silenceEngine] Error getting last_silence_indices:", err);
    return [];
  }
}

/**
 * Updates last_silence_indices in database
 */
async function updateLastSilenceIndex(
  userId: string,
  sentenceIndex: number
): Promise<void> {
  const pool = getPool();
  if (!pool || !userId) return;

  try {
    // Get current indices
    const currentIndices = await getLastSilenceIndices(userId);
    // Add new index and keep only last 3
    const newIndices = [...currentIndices, sentenceIndex].slice(-3);

    await pool.query(
      `INSERT INTO user_sessions (user_id, last_silence_indices, last_updated)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (user_id)
       DO UPDATE SET
         last_silence_indices = $2::jsonb,
         last_updated = now()`,
      [userId, JSON.stringify(newIndices)]
    );
  } catch (err) {
    console.error("[silenceEngine] Error updating last_silence_indices:", err);
  }
}

/**
 * Selects a silence sentence based on context
 * Returns sentence index and text
 */
export async function selectSilenceSentence(
  context: SilenceSentenceContext
): Promise<{ index: number; sentence: string }> {
  const { detectedEmotion, userText, userId } = context;

  // Determine category based on emotion or responsibility tone
  let category: keyof typeof SILENCE_LIBRARY;
  let allSentences: string[] = [];

  if (detectResponsibilityTone(userText)) {
    category = "growth";
    allSentences = SILENCE_LIBRARY.growth;
  } else if (detectedEmotion === "fear" || detectedEmotion === "shame") {
    category = "stability";
    allSentences = SILENCE_LIBRARY.stability;
  } else if (detectedEmotion === "anger") {
    category = "center";
    allSentences = SILENCE_LIBRARY.center;
  } else if (detectedEmotion === "frustration") {
    category = "pause";
    allSentences = SILENCE_LIBRARY.pause;
  } else {
    // Default: use all categories combined
    allSentences = [
      ...SILENCE_LIBRARY.stability,
      ...SILENCE_LIBRARY.center,
      ...SILENCE_LIBRARY.pause,
      ...SILENCE_LIBRARY.growth,
    ];
  }

  // Build global index map (sentence -> index)
  const allLibrarySentences = [
    ...SILENCE_LIBRARY.stability,
    ...SILENCE_LIBRARY.center,
    ...SILENCE_LIBRARY.pause,
    ...SILENCE_LIBRARY.growth,
  ];

  // Get last used indices to avoid repetition
  const lastIndices = userId ? await getLastSilenceIndices(userId) : [];

  // Find available sentences from category that haven't been used recently
  const availableSentences = allSentences.filter((sentence) => {
    const globalIndex = allLibrarySentences.indexOf(sentence);
    return globalIndex !== -1 && !lastIndices.includes(globalIndex);
  });

  // Select sentence and index
  let selectedIndex: number;
  let selectedSentence: string;

  if (availableSentences.length > 0) {
    // Randomly select from available sentences
    const randomIndex = Math.floor(Math.random() * availableSentences.length);
    selectedSentence = availableSentences[randomIndex];
    selectedIndex = allLibrarySentences.indexOf(selectedSentence);
  } else {
    // All sentences were used, select randomly from category (reset cycle)
    const randomCategoryIndex = Math.floor(Math.random() * allSentences.length);
    selectedSentence = allSentences[randomCategoryIndex];
    selectedIndex = allLibrarySentences.indexOf(selectedSentence);
  }

  // Update database if userId provided
  if (userId && selectedIndex !== undefined) {
    await updateLastSilenceIndex(userId, selectedIndex);
  }

  return {
    index: selectedIndex,
    sentence: selectedSentence,
  };
}

/**
 * Decides whether to use silence mode and what style to use
 */
export async function decideSilenceMode(
  params: SilenceModeParams
): Promise<SilenceDecision> {
  const {
    detectedEmotion,
    riskLevel,
    cssScore,
    previousWasQuestion,
    userTurnLength,
    userText,
    userId,
  } = params;

  // HARD RULE: If previous turn was silence mode, disable silence mode for this turn
  if (userId) {
    const previousTurnWasSilence = await getPreviousWasSilence(userId);
    if (previousTurnWasSilence) {
      return {
        use_silence: false,
        style: "reflect_only",
        reason: "Previous turn was silence mode - disable silence to allow normal response",
      };
    }
  }

  // Rule 1: If riskLevel == "high" -> use_silence true, style="one_line_anchor"
  if (riskLevel === "high") {
    const selected = await selectSilenceSentence({
      detectedEmotion,
      userText,
      userId,
    });
    return {
      use_silence: true,
      style: "one_line_anchor",
      reason: "High risk level detected - user needs grounding anchor",
      selectedSentence: selected.sentence,
    };
  }

  // Rule 2: If userTurnLength == "short" AND detectedEmotion in ["fear","shame","anger","frustration"]
  // -> use_silence true, style="reflect_and_pause"
  const highIntensityEmotions = ["fear", "shame", "anger", "frustration"];
  if (
    userTurnLength === "short" &&
    highIntensityEmotions.includes(detectedEmotion)
  ) {
    const selected = await selectSilenceSentence({
      detectedEmotion,
      userText,
      userId,
    });
    return {
      use_silence: true,
      style: "reflect_and_pause",
      reason: `Short message with high-intensity emotion (${detectedEmotion}) - needs reflection space`,
      selectedSentence: selected.sentence,
    };
  }

  // Rule 3: If cssScore <= 2 -> use_silence true, style="reflect_only"
  if (cssScore <= 2) {
    const selected = await selectSilenceSentence({
      detectedEmotion,
      userText,
      userId,
    });
    return {
      use_silence: true,
      style: "reflect_only",
      reason: "Low CSS score - response quality needs improvement, use silence",
      selectedSentence: selected.sentence,
    };
  }

  // Rule 4: If previousWasQuestion == true -> prefer silence (do not ask again)
  if (previousWasQuestion) {
    const selected = await selectSilenceSentence({
      detectedEmotion,
      userText,
      userId,
    });
    return {
      use_silence: true,
      style: "reflect_only",
      reason: "Previous turn was a question - avoid asking again, allow reflection",
      selectedSentence: selected.sentence,
    };
  }

  // Default: no silence
  return {
    use_silence: false,
    style: "reflect_only",
    reason: "No silence conditions met",
  };
}
