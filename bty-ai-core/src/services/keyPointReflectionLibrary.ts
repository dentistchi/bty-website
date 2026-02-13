/**
 * KeyPointReflectionLibrary
 * Stores reflection templates by emotion + intent category.
 * First sentence must be reflection. No question mark. Do not modify template wording heavily.
 */

import type { DetectedEmotion } from "./emotionAnalyzer";
import type { Intent } from "./intentExtractor";

export type ReflectionCategory =
  | "anxiety"
  | "anger"
  | "joy"
  | "mission"
  | "conflict"
  | "finance";

/** Template: returns full reflection string. */
type TemplateFn = (keyPoint: string) => string;

function hasJongseong(char: string): boolean {
  const code = char.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

function particleGaYi(text: string): string {
  const last = (text || "").replace(/\s/g, "").slice(-1);
  return last && hasJongseong(last) ? "이" : "가";
}

/** ~라는/다는/이라는 말이네요. (statement) */
function tStatement(suffix: string): TemplateFn {
  return (kp: string) => {
    const k = (kp || "").trim();
    if (!k) return "지금 마음에 와 닿는 말씀이 있으시군요.";
    const cleaned = k.replace(/\s*\.?\s*$/, "");
    const lastChar = cleaned.replace(/\s/g, "").slice(-1);
    let ending: string;
    if (/다\s*$/.test(cleaned)) {
      ending = "는"; // "힘들다" -> "힘들다는"
    } else if (lastChar && hasJongseong(lastChar)) {
      ending = "이라는"; // "갈등" -> "갈등이라는"
    } else {
      ending = "라는"; // "스트레스" -> "스트레스라는"
    }
    return cleaned + ending + suffix;
  };
}

/** ~가/이 핵심인 것 같아요. */
function tNounPhrase(suffix: string): TemplateFn {
  return (kp: string) => {
    const k = (kp || "").trim();
    if (!k) return "지금 마음에 와 닿는 말씀이 있으시군요.";
    return k + particleGaYi(k) + suffix;
  };
}

/**
 * Reflection templates by category. No question marks. First sentence only.
 */
const TEMPLATES: Record<ReflectionCategory, TemplateFn[]> = {
  anxiety: [
    tStatement(" 말이네요."),
    tNounPhrase(" 핵심인 것 같아요."),
    (kp) => `${(kp || "").trim()} 마음이 흔들리는 느낌이군요.`,
    (kp) => `${(kp || "").trim()} 때문에 불안해지시는군요.`,
    (kp) => `${(kp || "").trim()}${particleGaYi((kp || "").trim())} 마음에 걸리는 것 같아요.`,
  ],
  anger: [
    tStatement(" 말이네요."),
    tNounPhrase(" 핵심인 것 같아요."),
    (kp) => `${(kp || "").trim()} 때문에 화가 나시는군요.`,
    (kp) => `${(kp || "").trim()}${particleGaYi((kp || "").trim())} 신경에 걸리시는 것 같아요.`,
  ],
  joy: [
    tStatement(" 말이네요."),
    tNounPhrase(" 핵심인 것 같아요."),
    (kp) => `${(kp || "").trim()}${particleGaYi((kp || "").trim())} 기쁘신 것 같아요.`,
    (kp) => {
      const k = (kp || "").trim();
      const last = k.replace(/\s/g, "").slice(-1);
      const end = last && hasJongseong(last) ? "이라는" : "라는";
      return k + end + " 느낌이 드시는군요.";
    },
  ],
  mission: [
    tStatement(" 말이네요."),
    tNounPhrase(" 핵심인 것 같아요."),
    (kp) => `${(kp || "").trim()}${particleGaYi((kp || "").trim())} 중요하신 것 같아요.`,
    (kp) => `${(kp || "").trim()}에 대한 의미가 있으시군요.`,
  ],
  conflict: [
    tStatement(" 말이네요."),
    tNounPhrase(" 핵심인 것 같아요."),
    (kp) => `${(kp || "").trim()} 때문에 마음이 혼란스러우신 것 같아요.`,
    (kp) => `${(kp || "").trim()}${particleGaYi((kp || "").trim())} 걸리시는군요.`,
  ],
  finance: [
    tStatement(" 말이네요."),
    tNounPhrase(" 핵심인 것 같아요."),
    (kp) => `${(kp || "").trim()}${particleGaYi((kp || "").trim())} 걱정되시는군요.`,
    (kp) => `${(kp || "").trim()}에 대한 부담이 있으신 것 같아요.`,
  ],
};

/** Default fallback when category has no match */
const DEFAULT_TEMPLATES: TemplateFn[] = [
  tStatement(" 말이네요."),
  tNounPhrase(" 핵심인 것 같아요."),
  (kp) => `${(kp || "").trim()} 마음이 흔들리는 느낌이군요.`,
];

/**
 * Maps emotion + intent to reflection category.
 */
export function getReflectionCategory(
  emotion: DetectedEmotion | string,
  intent: Intent | string
): ReflectionCategory {
  if (intent === "money") return "finance";
  if (intent === "conflict" || intent === "venting") return "conflict";

  switch (emotion) {
    case "anger":
      return "anger";
    case "fear":
    case "frustration":
    case "confusion":
    case "shame":
    case "isolation_signal":
      return "anxiety";
    case "elevation":
    case "creative_fulfillment":
      return "joy";
    case "mission_drive":
      return "mission";
    case "relational_dependency":
      return "conflict";
    default:
      if (intent === "relationship") return "conflict";
      if (intent === "leadership_reflection") return "mission";
      return "anxiety"; // safe default
  }
}

/**
 * Selects one template randomly, avoiding last 5 used.
 * Returns the full reflection string. No question mark. First sentence only.
 */
export function selectReflection(
  keyPoint: string,
  category: ReflectionCategory,
  lastUsedTemplates: string[] = []
): string {
  const kp = (keyPoint || "사용자의 말씀").trim();
  const templates = TEMPLATES[category] ?? DEFAULT_TEMPLATES;

  const excludeSet = new Set(
    lastUsedTemplates.slice(-5).map((s) => s.trim())
  );

  const candidates = templates.filter((fn) => {
    const result = fn(kp);
    return !excludeSet.has(result.trim()) && !result.includes("?");
  });

  const pool = candidates.length > 0 ? candidates : templates;
  const fn = pool[Math.floor(Math.random() * pool.length)];
  const reflection = fn(kp);

  // Ensure no question mark (hard rule)
  return reflection.replace(/[?？]\s*$/, ".").trim();
}

/**
 * Builds reflection from library. Use this as the main entry point.
 * First sentence only. No question mark. Does not modify template wording heavily.
 */
export function buildReflectionFromLibrary(
  keyPoint: string,
  emotion: DetectedEmotion | string,
  intent: Intent | string,
  lastUsedTemplates: string[] = []
): string {
  const category = getReflectionCategory(emotion, intent);
  return selectReflection(keyPoint, category, lastUsedTemplates);
}
