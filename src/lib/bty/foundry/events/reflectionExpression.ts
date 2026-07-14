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
import type { CompletionState } from "@/domain/foundry/watch-integrity";

// ---------------------------------------------------------------------------
// Deterministic template renderer — the always-available fallback expression.
// Same MEANING as the LLM path; only the wording is fixed.
// ---------------------------------------------------------------------------

type StateCopy = {
  emerged: (excerpt: string, hasResponse: boolean) => string;
  stretched: string;
  sentence: string;
  invitation: string;
};

const TEMPLATES: Record<ReflectionLocale, Record<CompletionState, StateCopy>> = {
  en: {
    pass: {
      emerged: (ex, has) =>
        has
          ? `You stayed with the whole of it, and what surfaced for you was clear: “${ex}”.`
          : `You stayed with the whole of it, present from beginning to end.`,
      stretched: `Today you didn't look away when it would have been easier to. That is its own kind of practice.`,
      sentence: `Presence is the first act of leadership.`,
      invitation: `Tomorrow, bring this same attention to one conversation you'd normally rush.`,
    },
    review: {
      emerged: (ex, has) =>
        has
          ? `You moved through it in your own way, returning to what mattered: “${ex}”.`
          : `You moved through it in your own way, circling back to the parts that held you.`,
      stretched: `You let yourself skip ahead and come back — following your own attention rather than the timeline.`,
      sentence: `What you return to is what you're really learning.`,
      invitation: `Tomorrow, revisit the one moment here you skipped past — it was asking for you.`,
    },
    incomplete: {
      emerged: (ex, has) =>
        has
          ? `Even a first pass left something with you: “${ex}”.`
          : `You began here, and beginnings count.`,
      stretched: `You made contact with the material — the door is open, not closed.`,
      sentence: `Every return is a new beginning.`,
      invitation: `Tomorrow, give this the quiet ten minutes it deserves.`,
    },
  },
  ko: {
    pass: {
      emerged: (ex, has) =>
        has
          ? `처음부터 끝까지 함께 머물렀고, 당신에게 또렷하게 떠오른 것은 이것이었습니다: “${ex}”.`
          : `처음부터 끝까지, 온전히 함께 머물렀습니다.`,
      stretched: `오늘 당신은 눈을 돌리는 게 더 쉬웠을 순간에도 그러지 않았습니다. 그것 자체가 하나의 훈련입니다.`,
      sentence: `머무름은 리더십의 첫 번째 행동입니다.`,
      invitation: `내일, 평소라면 서둘렀을 대화 하나에 오늘의 이 집중을 가져가 보세요.`,
    },
    review: {
      emerged: (ex, has) =>
        has
          ? `당신만의 방식으로 지나가며, 중요한 곳으로 다시 돌아왔습니다: “${ex}”.`
          : `당신만의 방식으로 지나가며, 마음을 붙든 부분으로 다시 돌아왔습니다.`,
      stretched: `타임라인이 아니라 당신의 주의를 따라, 건너뛰고 다시 돌아오기를 스스로 허락했습니다.`,
      sentence: `당신이 다시 돌아가는 곳이, 당신이 진짜 배우는 것입니다.`,
      invitation: `내일, 여기서 건너뛴 그 한 순간을 다시 보세요. 그 순간이 당신을 부르고 있었습니다.`,
    },
    incomplete: {
      emerged: (ex, has) =>
        has
          ? `첫걸음만으로도 당신에게 무언가가 남았습니다: “${ex}”.`
          : `당신은 여기서 시작했고, 시작은 그 자체로 의미가 있습니다.`,
      stretched: `당신은 이 내용과 접촉했습니다 — 문은 닫힌 게 아니라 열려 있습니다.`,
      sentence: `모든 돌아옴은 새로운 시작입니다.`,
      invitation: `내일, 이 영상에 조용한 10분을 온전히 내어주세요.`,
    },
  },
};

/** Render the four-section mirror deterministically from the context. */
export function renderTemplateReflection(ctx: ReflectionContext): LivingReflection {
  const copy = TEMPLATES[ctx.locale][ctx.completionState];
  return {
    whatEmerged: copy.emerged(ctx.responseExcerpt, ctx.hasResponse),
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
