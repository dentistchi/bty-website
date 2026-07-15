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

// --- Deterministic clause selection (no character-cut truncation, no ellipsis) ---

const CLAUSE_MIN_WORDS = 4;
const CLAUSE_MAX_WORDS = 24;
const LIVING_MIN_WORDS = 6;
const LIVING_MAX_WORDS = 18;

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

/**
 * Split the response into whole, self-standing clauses (sentence boundaries and
 * line breaks). Edges are trimmed of quotes/punctuation; NOTHING is cut mid-word
 * and no ellipsis is ever produced. Keeps only clauses of a usable length.
 */
function extractClauses(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/^["'“”\s,;:.!?–—-]+/, "").replace(/["'“”\s,;:.!?]+$/, "").trim())
    .filter((s) => {
      const w = wordCount(s);
      return w >= CLAUSE_MIN_WORDS && w <= CLAUSE_MAX_WORDS;
    });
}

/** The best complete clause for the LIVING LINE (6–18 words), else a usable one, else null. */
function pickLivingClause(clauses: string[]): string | null {
  const ideal = clauses.find((c) => wordCount(c) >= LIVING_MIN_WORDS && wordCount(c) <= LIVING_MAX_WORDS);
  if (ideal) return ideal;
  return clauses.find((c) => wordCount(c) <= LIVING_MAX_WORDS) ?? null;
}

type Grounded = {
  /** true when we could quote two distinct clauses (what + living). */
  twoQuotes: boolean;
  whatClause: string; // quoted in WHAT EMERGED (distinct from `living` when twoQuotes)
  living: string | null; // exact clause for the LIVING LINE, or null → grounded line
  snippet: string; // short-response no-clause path
  mode: "grounded" | "short" | "none";
};

/**
 * Localized connectives. The fallback derives ONLY from the employee's own clauses
 * + the fact that a host question was posed. It quotes real, complete clauses (never
 * a truncated paste), keeps the four sections in distinct roles, and contains none
 * of the banned generic filler ("you put language to…", "…where your leadership
 * begins", "what the question asked of you", visible ellipsis).
 */
type Copy = (g: Grounded) => LivingReflection;

const COPY: Record<ReflectionLocale, Copy> = {
  en: (g) => {
    if (g.mode === "none") {
      return {
        whatEmerged: `You stayed with this even without leaving written words, and that itself is a kind of answer.`,
        whereYouStretched: `Some recognitions take shape before the language for them arrives.`,
        livingSentence: `What goes unspoken still shapes the room you lead in.`,
        nextInvitation: `When the words come, let them meet the question you sat with.`,
      };
    }
    if (g.mode === "short") {
      return {
        whatEmerged: `You left only a little, and even that points somewhere: “${g.snippet}”.`,
        whereYouStretched: `A short note still carries the shape of what you were weighing.`,
        livingSentence: `Even a few words can mark where your attention turned.`,
        nextInvitation: `When there is more to say, the fuller thought will have somewhere to land.`,
      };
    }
    return {
      whatEmerged: g.twoQuotes
        ? `You keep returning to one thing you wrote: “${g.whatClause}”.`
        : `You put one clear thing into words, and it holds more than its size.`,
      whereYouStretched: g.twoQuotes
        ? `You are holding two things at once here, and they pull in different directions.`
        : `You are letting this stay open rather than closing it too quickly.`,
      livingSentence: g.living ?? `The words you chose are still doing their quiet work.`,
      nextInvitation: `What you named here is still yours to carry, in your own time.`,
    };
  },
  ko: (g) => {
    if (g.mode === "none") {
      return {
        whatEmerged: `당신은 말을 남기지 않고도 이 자리에 머물렀고, 그 머무름 자체가 하나의 응답입니다.`,
        whereYouStretched: `어떤 알아차림은 그것을 담을 말이 도착하기 전에 먼저 모양을 갖춥니다.`,
        livingSentence: `말해지지 않은 것도 당신이 이끄는 자리를 여전히 빚어냅니다.`,
        nextInvitation: `말이 찾아올 때, 그 말이 당신이 마주했던 질문과 만나게 해 보세요.`,
      };
    }
    if (g.mode === "short") {
      return {
        whatEmerged: `당신은 아주 조금만 남겼지만, 그것조차 어딘가를 가리킵니다: “${g.snippet}”.`,
        whereYouStretched: `짧은 메모도 당신이 무엇을 저울질했는지 그 모양을 담고 있습니다.`,
        livingSentence: `단 몇 마디도 당신의 주의가 어디로 향했는지 남길 수 있습니다.`,
        nextInvitation: `더 할 말이 생길 때, 그 온전한 생각이 내려앉을 자리가 있을 것입니다.`,
      };
    }
    return {
      whatEmerged: g.twoQuotes
        ? `당신이 쓴 말 중 자꾸 되돌아오는 한 가지가 있습니다: “${g.whatClause}”.`
        : `당신은 한 가지를 또렷이 말로 옮겼고, 그것은 크기보다 더 많은 것을 담고 있습니다.`,
      whereYouStretched: g.twoQuotes
        ? `당신은 지금 두 가지를 동시에 붙들고 있고, 그 둘은 서로 다른 방향으로 당깁니다.`
        : `당신은 이것을 서둘러 닫기보다 열어 둔 채로 두고 있습니다.`,
      livingSentence: g.living ?? `당신이 고른 말들은 여전히 조용히 자기 일을 하고 있습니다.`,
      nextInvitation: `당신이 여기서 이름 붙인 것은, 당신의 시간 속에서 당신이 안고 갈 몫으로 남아 있습니다.`,
    };
  },
};

/**
 * Render the four-section mirror deterministically — the always-clean safety net.
 * It is evidence-grounded (real clauses from the employee's own response), never
 * pastes the whole response, never truncates with an ellipsis, and keeps each
 * section in a distinct role. The LLM path is where richer specificity comes from;
 * this guarantees a grounded, safe result when the provider is unavailable/rejected.
 */
export function renderTemplateReflection(ctx: ReflectionContext): LivingReflection {
  let g: Grounded;
  if (!ctx.hasResponse) {
    g = { mode: "none", twoQuotes: false, whatClause: "", living: null, snippet: "" };
  } else {
    const clauses = extractClauses(ctx.responseFull);
    if (clauses.length === 0) {
      const snippet = ctx.responseExcerpt.replace(/…+$/, "").trim();
      g = { mode: "short", twoQuotes: false, whatClause: "", living: null, snippet };
    } else {
      const living = pickLivingClause(clauses);
      // WHAT EMERGED quotes a DIFFERENT clause than the living line when we have two.
      const whatClause = clauses.find((c) => c !== living) ?? living ?? clauses[0];
      g = { mode: "grounded", twoQuotes: clauses.length >= 2, whatClause, living, snippet: "" };
    }
  }
  return COPY[ctx.locale](g);
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
