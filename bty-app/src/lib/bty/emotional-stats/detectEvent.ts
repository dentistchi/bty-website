/**
 * MVP: simple keyword/pattern detection for emotional events from assistant or user text.
 * Used by chat/mentor to decide whether to call recordEmotionalEvent.
 * Single source: docs/specs/healing-coaching-spec-v3.json intents + event_detection.
 */

import type { EmotionalEventId } from "./coreStats";

/** Keyword patterns per event (KO + EN). Match assistant response for MVP. */
const EVENT_PATTERNS: { id: EmotionalEventId; patterns: RegExp[] }[] = [
  { id: "FEELING_LABELED", patterns: [/감정\s*(이름|명명|라벨|알아)/i, /느낌\s*(은|이|을)/i, /feeling\s*(is|named|labeled)/i] },
  { id: "FALSE_TO_TRUE_CONVERSION", patterns: [/가짜\s*감정|진짜\s*감정|해석\s*대신/i, /true\s*feeling|false\s*emotion/i] },
  { id: "NEED_IDENTIFIED", patterns: [/필요\s*(가|를|을)|필요해|need\s*(is|for)/i] },
  { id: "CLEAR_REQUEST", patterns: [/요청\s*(해|을|을까)|request\s*(:|is)/i, /구체적\s*요청/i] },
  { id: "O_F_N_R_COMPLETED", patterns: [/관찰.*감정.*필요.*요청|O-F-N-R|오에프엔알/i, /observation.*feeling.*need.*request/i] },
  { id: "REGULATION_ATTEMPT", patterns: [/멈춤|호흡|숨\s*쉬|regulation|breathe/i] },
  { id: "INTENSITY_REDUCTION", patterns: [/강도\s*(가|가)\s*내려|intensity\s*down/i] },
  { id: "PATTERN_LINKED", patterns: [/패턴\s*(이|을)|반복\s*패턴|pattern\s*(is|linked)/i] },
  { id: "PAST_MEMORY_REFERENCED", patterns: [/과거\s*기억|예전에|비슷한\s*경험|past\s*memory/i] },
  { id: "REPAIR_ATTEMPT", patterns: [/회복\s*대화|사과|다시\s*말하고|repair|apolog/i] },
  { id: "POST_CONFLICT_RETURN", patterns: [/갈등\s*후\s*돌아|다시\s*연결|post\s*conflict/i] },
  { id: "SELF_REFRAMING", patterns: [/스스로\s*다시\s*보기|리프레임|refram/i] },
  { id: "BOUNDARY_ASSERTION", patterns: [/경계\s*설정|boundary|선을\s*그/i] },
  { id: "OBSERVATION_FACTUAL", patterns: [/사실\s*관찰|평가\s*없이|observation\s*without/i] },
];

/**
 * Returns the first matching event ID from text, or null.
 * MVP: one event per text; order = priority.
 */
export function detectEmotionalEventFromText(text: string): EmotionalEventId | null {
  if (!text || typeof text !== "string") return null;
  const t = text.trim();
  if (!t) return null;
  for (const { id, patterns } of EVENT_PATTERNS) {
    if (patterns.some((p) => p.test(t))) return id;
  }
  return null;
}
