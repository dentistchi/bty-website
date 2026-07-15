/**
 * Foundry Living Reflection — EXPRESSION layer (service).
 *
 * "Rules decide. AI expresses." The domain decides meaning; this module holds the
 * localized WORDS that express it when the LLM is unavailable or its output is
 * rejected — plus the anti-summary reflection prompts and checkpoint prompts.
 * Display copy belongs here (service/expression), never in `src/domain`.
 *
 * Pure and framework-free (no DB, no network) so it is safe to import from the
 * client bundle as well as the reflection service.
 */

import {
  type LivingReflection,
  type ReflectionContext,
  type ReflectionLocale,
  normalizeReflectionLocale,
} from "@/domain/foundry/living-reflection";

// ---------------------------------------------------------------------------
// Deterministic template renderer — the always-available, always-clean fallback.
//
// This is the safety net when the LLM is unavailable OR its output fails the
// quality gate. It must therefore satisfy the SAME contract the gate enforces:
// second person only, grounded in the employee's own words + the host's frame,
// never a verdict about viewing behavior, never praise/grade/coaching. It is
// keyed on whether the employee left words — NOT on watch-state — because
// watch-state must never become the subject of the mirror.
// ---------------------------------------------------------------------------

type FallbackCopy = {
  emerged: (excerpt: string) => string;
  stretched: string;
  sentence: string;
  invitation: string;
};

type LocaleFallback = { withResponse: FallbackCopy; withoutResponse: FallbackCopy };

const TEMPLATES: Record<ReflectionLocale, LocaleFallback> = {
  en: {
    withResponse: {
      emerged: (ex) => `What comes through most clearly in your words is this: “${ex}”.`,
      stretched: `You put language to something that isn't simple to hold in a single line.`,
      sentence: `What you notice is where your leadership begins.`,
      invitation: `Let this stay with you as you carry it toward what the question asked of you.`,
    },
    withoutResponse: {
      emerged: () => `You showed up for this, and that presence is its own kind of answer.`,
      stretched: `Some reflections take shape quietly first, before there are words for them.`,
      sentence: `Presence is the first act of leadership.`,
      invitation: `When the words come, let them meet what the question asked of you.`,
    },
  },
  ko: {
    withResponse: {
      emerged: (ex) => `당신의 말에서 가장 또렷하게 다가오는 것은 이것입니다: “${ex}”.`,
      stretched: `당신은 한 줄로 담기 어려운 무언가에 언어를 입혔습니다.`,
      sentence: `당신이 알아차리는 그곳에서 당신의 리더십이 시작됩니다.`,
      invitation: `이것을 지닌 채, 그 질문이 당신에게 물은 것을 향해 천천히 나아가 보세요.`,
    },
    withoutResponse: {
      emerged: () => `당신은 이 자리에 머물렀고, 그 머무름 자체가 하나의 응답입니다.`,
      stretched: `어떤 성찰은 말이 되기 전에 먼저 조용히 자리를 잡습니다.`,
      sentence: `현존은 리더십의 첫 번째 행동입니다.`,
      invitation: `말이 찾아올 때, 그 말이 그 질문이 당신에게 물은 것과 만나게 해 보세요.`,
    },
  },
};

/** Render the four-section mirror deterministically. Always clean, always grounded. */
export function renderTemplateReflection(ctx: ReflectionContext): LivingReflection {
  const copy = ctx.hasResponse ? TEMPLATES[ctx.locale].withResponse : TEMPLATES[ctx.locale].withoutResponse;
  return {
    whatEmerged: copy.emerged(ctx.responseExcerpt),
    whereYouStretched: copy.stretched,
    livingSentence: copy.sentence,
    nextInvitation: copy.invitation,
  };
}

// ---------------------------------------------------------------------------
// Anti-summary reflection prompts (Part 3) + checkpoint prompts (Part 5).
//
// Never "what was the main point?". Every prompt requires the PERSONAL, non-
// transferable connection between video, the participant's own experience, and
// their leadership — an answer an AI that never met them cannot fake.
// ---------------------------------------------------------------------------

export const REFLECTION_PROMPTS: Record<ReflectionLocale, string[]> = {
  en: [
    "What challenged your thinking here?",
    "What part reminded you of your team?",
    "What did you disagree with — and why?",
    "Where did you feel resistance while watching?",
    "What would be hard to apply with your people tomorrow?",
    "What did this ask of you as a leader?",
  ],
  ko: [
    "무엇이 당신의 생각에 도전이 되었나요?",
    "어느 부분에서 당신의 팀이 떠올랐나요?",
    "동의하기 어려웠던 부분은 무엇이었나요? 이유는요?",
    "보면서 어디에서 저항감을 느꼈나요?",
    "내일 당신의 사람들에게 적용하기 어려운 것은 무엇일까요?",
    "이 영상은 리더로서 당신에게 무엇을 요구했나요?",
  ],
};

export const CHECKPOINT_PROMPTS: Record<ReflectionLocale, string[]> = {
  en: [
    "What part of your team came to mind just now?",
    "Whose face appeared as you watched this?",
  ],
  ko: [
    "방금 당신의 팀 중 어떤 부분이 떠올랐나요?",
    "이걸 보며 누구의 얼굴이 떠올랐나요?",
  ],
};

/** FNV-1a — a tiny, stable, dependency-free string hash for deterministic choice. */
function stableHash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministically pick the response-stage reflection prompt for a given seed. */
export function selectReflectionPrompt(seed: string, locale: unknown): string {
  const list = REFLECTION_PROMPTS[normalizeReflectionLocale(locale)];
  return list[stableHash(seed) % list.length];
}

/** Deterministically pick a checkpoint prompt for a given seed + checkpoint index. */
export function selectCheckpointPrompt(seed: string, index: number, locale: unknown): string {
  const list = CHECKPOINT_PROMPTS[normalizeReflectionLocale(locale)];
  const safeIndex = Number.isInteger(index) && index >= 0 ? index : 0;
  return list[(stableHash(seed) + safeIndex) % list.length];
}
