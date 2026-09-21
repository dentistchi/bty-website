import { getLlmClient, getLlmModel, isLlmAvailable } from "@/lib/bty/llm/client";
import {
  QUIZ_MAX_CHOICES,
  QUIZ_MIN_CHOICES,
  validateQuiz,
  type Quiz,
  type QuizQuestion,
} from "@/domain/foundry/events/quickTrainingQuiz";

/**
 * Quick Training Quiz — generation from STUDY CONTENT.
 *
 * WHAT THE MANAGER PASTES IS SOURCE MATERIAL, NOT A QUESTION. The box this feeds is the text the
 * employee is meant to study, and the only text the questions may be built from. A generated
 * draft is never persisted: it lands in the same editor CSV and Manual land in, the manager
 * corrects it, and only what they submit is stored — with `source_kind = "generated"`, which is
 * a statement about where the questions came from and stays true however much they edited.
 *
 * FOUR THINGS THIS FAILS CLOSED ON, each with its own code so the manager is told what to do:
 *   - `source_too_short`      — there is not enough material to ask this many questions about.
 *   - `structured_output_unavailable` / `provider_unavailable` / `timeout` / `provider_error`
 *                             — the provider could not be used. Nothing is inferred.
 *   - `invalid_output`        — the reply was not a quiz of the requested shape and size.
 *   - `source_ungrounded`     — a question was not traceable to a verbatim span of the source.
 */

export type QuizGenerationCode =
  | "invalid_input"
  | "source_too_short"
  | "provider_unavailable"
  | "structured_output_unavailable"
  | "timeout"
  | "provider_error"
  | "invalid_output"
  | "source_ungrounded";

/**
 * The floor on usable source material: an absolute minimum, plus a per-question allowance. Below
 * it a provider has nothing to ground on and will invent — which is the one failure mode this
 * feature cannot have. The numbers are a product judgement, not a measurement, and are stated
 * here rather than buried in a condition so they can be changed deliberately.
 */
const MIN_SOURCE_CHARS = 200;
const SOURCE_CHARS_PER_QUESTION = 60;
/** Evidence shorter than this is not evidence — any source contains "the". */
const MIN_EVIDENCE_CHARS = 12;

const PROVIDER_SCHEMA_NAME = "quick_training_quiz_v1";

const QUIZ_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "choices", "correctChoiceId", "explanation", "sourceEvidence"],
        properties: {
          text: { type: "string" },
          choices: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "label"],
              properties: {
                id: { type: "string", enum: ["a", "b", "c", "d"] },
                label: { type: "string" },
              },
            },
          },
          correctChoiceId: { type: "string", enum: ["a", "b", "c", "d"] },
          explanation: { type: "string" },
          sourceEvidence: { type: "string" },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = [
  "You write objective, single-answer multiple-choice quiz questions for workplace training.",
  "Use ONLY the supplied source material. Never use outside knowledge and never invent facts.",
  `Each question has between ${QUIZ_MIN_CHOICES} and ${QUIZ_MAX_CHOICES} choices with ids taken in order from a, b, c, d.`,
  "Exactly one choice is correct; the others must be plausible and clearly wrong according to the source.",
  "All choices for a question must be distinct.",
  "`sourceEvidence` MUST be copied VERBATIM from the source material — a contiguous span that supports the correct answer.",
  "Return JSON only. No markdown, no code fences, no commentary.",
].join("\n");

/** Providers wrap JSON in ```json fences even when told not to. Remove them before parsing. */
function stripJsonFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/** Does this transport error mean the endpoint/model cannot honour a strict JSON Schema? */
function isStructuredOutputUnsupported(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  if (!/\b(400|404|422)\b/.test(msg)) return false;
  return /response_format|json_schema|structured output|schema/i.test(msg);
}

/** Case- and whitespace-insensitive containment — a provider re-wrapping lines is not ungrounded. */
const flatten = (value: string) => value.replace(/\s+/g, " ").trim().toLocaleLowerCase();

type RawQuestion = {
  text?: unknown;
  choices?: unknown;
  correctChoiceId?: unknown;
  explanation?: unknown;
  sourceEvidence?: unknown;
};

/**
 * Turn the provider's reply into a quiz draft, or null. STRICT: the ids and the positions are
 * OURS, not the model's, so a model that repeats an id or numbers its questions from zero cannot
 * produce a quiz that validates by accident.
 */
function readGeneratedQuiz(parsed: unknown, expectedCount: number): Quiz | null {
  if (!parsed || typeof parsed !== "object") return null;
  const rawQuestions = (parsed as { questions?: unknown }).questions;
  if (!Array.isArray(rawQuestions) || rawQuestions.length !== expectedCount) return null;
  const questions: QuizQuestion[] = [];
  for (const [index, raw] of rawQuestions.entries()) {
    if (!raw || typeof raw !== "object") return null;
    const q = raw as RawQuestion;
    if (typeof q.text !== "string" || !q.text.trim()) return null;
    if (typeof q.correctChoiceId !== "string") return null;
    if (!Array.isArray(q.choices)) return null;
    const choices: { id: string; label: string }[] = [];
    for (const rawChoice of q.choices) {
      if (!rawChoice || typeof rawChoice !== "object") return null;
      const c = rawChoice as { id?: unknown; label?: unknown };
      if (typeof c.id !== "string" || typeof c.label !== "string") return null;
      choices.push({ id: c.id, label: c.label.trim() });
    }
    const explanation = typeof q.explanation === "string" ? q.explanation.trim() : "";
    const sourceEvidence = typeof q.sourceEvidence === "string" ? q.sourceEvidence.trim() : "";
    questions.push({
      id: `q${index + 1}`,
      text: q.text.trim(),
      position: index + 1,
      choices,
      correctChoiceId: q.correctChoiceId,
      ...(explanation ? { explanation } : {}),
      ...(sourceEvidence ? { sourceEvidence } : {}),
    });
  }
  const quiz: Quiz = { schemaVersion: 1, questions };
  return validateQuiz(quiz) ? null : quiz;
}

/** Every question must point at a real, substantial, verbatim span of the supplied source. */
function isGrounded(quiz: Quiz, source: string): boolean {
  const haystack = flatten(source);
  return quiz.questions.every((q) => {
    const evidence = flatten(q.sourceEvidence ?? "");
    return evidence.length >= MIN_EVIDENCE_CHARS && haystack.includes(evidence);
  });
}

/**
 * Generate an UNPERSISTED draft from intentionally supplied source text. The caller shows it to
 * the manager for review; nothing here writes anything.
 */
export async function generateQuizDraft(sourceText: unknown, questionCount: unknown, locale: unknown) {
  const source = typeof sourceText === "string" ? sourceText.trim() : "";
  const count = questionCount === 5 || questionCount === 10 ? questionCount : 0;
  if (!source || !count) return { ok: false as const, code: "invalid_input" as QuizGenerationCode };
  const required = Math.max(MIN_SOURCE_CHARS, count * SOURCE_CHARS_PER_QUESTION);
  if (source.length < required) {
    return {
      ok: false as const,
      code: "source_too_short" as QuizGenerationCode,
      requiredChars: required,
      suppliedChars: source.length,
    };
  }
  if (!isLlmAvailable()) return { ok: false as const, code: "provider_unavailable" as QuizGenerationCode };

  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: `Language: ${locale === "ko" ? "Korean" : "English"}\nNumber of questions: ${count}\n\nSOURCE MATERIAL:\n${source}`,
    },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    let raw: string | null = null;
    try {
      const reply = await getLlmClient().chat.completions.create(
        {
          model: getLlmModel(),
          temperature: 0,
          max_tokens: 5000,
          messages,
          response_format: {
            type: "json_schema",
            json_schema: { name: PROVIDER_SCHEMA_NAME, strict: true, schema: QUIZ_JSON_SCHEMA },
          },
        },
        { signal: controller.signal },
      );
      raw = reply.choices?.[0]?.message?.content ?? null;
    } catch (e) {
      /*
        ONE FALLBACK, AND ONLY FOR THE ONE CAUSE THAT WARRANTS IT. A provider that cannot honour a
        strict schema is a capability gap, not a bad request, and plain JSON mode plus the strict
        reader below still refuses anything malformed. Any other error is re-thrown and classified
        by the outer catch — a timeout must never be retried as a schema problem.
      */
      if (!isStructuredOutputUnsupported(e)) throw e;
      const reply = await getLlmClient().chat.completions.create(
        {
          model: getLlmModel(),
          temperature: 0,
          max_tokens: 5000,
          messages,
          response_format: { type: "json_object" },
        },
        { signal: controller.signal },
      );
      raw = reply.choices?.[0]?.message?.content ?? null;
    }

    if (!raw) return { ok: false as const, code: "invalid_output" as QuizGenerationCode };
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFences(raw));
    } catch {
      return { ok: false as const, code: "invalid_output" as QuizGenerationCode };
    }
    const quiz = readGeneratedQuiz(parsed, count);
    if (!quiz) return { ok: false as const, code: "invalid_output" as QuizGenerationCode };
    if (!isGrounded(quiz, source)) return { ok: false as const, code: "source_ungrounded" as QuizGenerationCode };
    return { ok: true as const, quiz };
  } catch (e) {
    if (controller.signal.aborted) return { ok: false as const, code: "timeout" as QuizGenerationCode };
    if (isStructuredOutputUnsupported(e)) {
      return { ok: false as const, code: "structured_output_unavailable" as QuizGenerationCode };
    }
    return { ok: false as const, code: "provider_error" as QuizGenerationCode };
  } finally {
    clearTimeout(timer);
  }
}
