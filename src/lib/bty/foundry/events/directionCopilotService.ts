import { getLlmClient, getLlmModel, isLlmAvailable, type LlmChatMessage } from "@/lib/bty/llm/client";
import {
  validateDirectionSuggestions,
  DIRECTION_COUNT,
  DIRECTION_GENERATION_VERSION,
  DIRECTION_LIMITS,
  type DirectionSuggestion,
  validateSimpleSuggestion,
  SIMPLE_SUGGESTION_LIMITS,
  SIMPLE_SUGGESTION_VERSION,
  type SimpleSuggestion,
} from "@/domain/foundry/module/direction-copilot";

/**
 * Intent-to-Module Direction Copilot — generation service (server-only, Slice 2.4A).
 *
 * The Host writes ONE real-world problem; this asks the provider for exactly three
 * meaningfully different training DIRECTIONS, each seen through a different capability
 * lens. The domain validator decides validity, fail-closed. Unlike the Arena scenario
 * generator, there is NO deterministic fallback: if the provider is unavailable, times
 * out, or returns output the validator rejects (after one bounded retry), this returns
 * a stable error code. The route surfaces a generic failure and the manual Builder path
 * stays open. Nothing here mutates the draft.
 *
 * The provider sees only the Host problem statement + locale — no names, no draft ids,
 * no PII beyond what the Host themselves typed. Raw provider output is never returned
 * to the client and never persisted.
 */

export type DirectionGenerateResult =
  | { ok: true; suggestions: DirectionSuggestion[]; version: string }
  | { ok: false; code: DirectionGenerateErrorCode };

export type DirectionGenerateErrorCode =
  | "provider_unavailable"
  | "timeout"
  | "provider_error"
  | "invalid_output";

export type DirectionGenerateInput = {
  problemStatement: string;
  locale: "en" | "ko";
};

/** Bounded provider timeout — generation must never hang the Host's flow. */
const LLM_TIMEOUT_MS = 20_000;
/** One retry only (§8G). No unbounded repair loop. */
const MAX_ATTEMPTS = 2;

function logGenOutcome(outcome: string, code?: string): void {
  // Deliberately logs only the outcome/code — never the problem statement or content.
  console.info(`[directionCopilot] ${outcome}${code ? ` code=${code}` : ""}`);
}

function stripJsonFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function systemPrompt(locale: "en" | "ko"): string {
  const isKo = locale === "ko";
  return [
    "You are a product copilot for a workplace training design tool. You help a host see legitimate ways to train around a real-world problem they describe. You are NOT a mentor, coach, or character — use plain, practical, neutral product language.",
    `Given ONE real-world problem, propose EXACTLY ${DIRECTION_COUNT} training directions.`,
    "Each direction must interpret the SAME problem through a MEANINGFULLY DIFFERENT capability lens (a different ability the training would build). The three must not be paraphrases of one another.",
    "Rules:",
    "- Every direction is plausible. None is presented as the correct answer. None sets organizational policy.",
    "- Invent NO names, roles, incidents, motives, diagnoses, metrics, legal facts, patient facts, or employee facts that are not in the host's problem. Do not assert facts the host did not state.",
    "- observable_behavior must describe a concrete action that could be seen, heard, or recorded — not an abstract goal. Avoid 'improve communication', 'be more responsible', 'increase awareness' unless converted into an observable act.",
    "- success_evidence_hint must be evidence of the ACTION (a required field is present, a confirmation phrase was used, a follow-up status was recorded, a supervisor observed the act) — NOT proof of permanent behavior change, competence, or restored trust.",
    "- important_assumption must state, plainly, any assumption the direction depends on. Omit it (or null) only when the direction truly needs none.",
    "- Distinguish a training issue from a workflow, staffing, authority, or policy issue. When training alone may be insufficient, ONE direction may note it may require a workflow or policy change in addition to training.",
    `- Write all host-facing text in ${isKo ? "Korean" : "English"}. Use clear, practical workplace language.`,
    "Output: return ONLY a compact JSON object. No markdown, no code fences, no HTML, no preamble, no comments. Shape EXACTLY:",
    '{"suggestions":[{"title":string,"capability_candidate":string,"rationale":string,"observable_behavior":string,"success_evidence_hint":string,"important_assumption":string|null}]}',
    `Length limits (characters): title<=${DIRECTION_LIMITS.title}, capability_candidate<=${DIRECTION_LIMITS.capability_candidate}, rationale<=${DIRECTION_LIMITS.rationale}, observable_behavior<=${DIRECTION_LIMITS.observable_behavior}, success_evidence_hint<=${DIRECTION_LIMITS.success_evidence_hint}, important_assumption<=${DIRECTION_LIMITS.important_assumption}.`,
    `The array must contain EXACTLY ${DIRECTION_COUNT} items with distinct capabilities, titles, and behaviors.`,
  ].join("\n");
}

function userPrompt(problemStatement: string): string {
  return `Real-world problem the host described:\n${problemStatement}`;
}

async function attempt(
  messages: LlmChatMessage[],
): Promise<{ ok: true; suggestions: DirectionSuggestion[] } | { ok: false; code: DirectionGenerateErrorCode; reason: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const client = getLlmClient();
    const completion = await client.chat.completions.create(
      {
        model: getLlmModel(),
        messages,
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 1100,
        response_format: { type: "json_object" },
      },
      { signal: controller.signal },
    );
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return { ok: false, code: "invalid_output", reason: "empty_output" };
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFences(raw));
    } catch {
      return { ok: false, code: "invalid_output", reason: "malformed_json" };
    }
    const validated = validateDirectionSuggestions(parsed);
    if (!validated.ok) return { ok: false, code: "invalid_output", reason: validated.code };
    return { ok: true, suggestions: validated.suggestions };
  } catch {
    return controller.signal.aborted
      ? { ok: false, code: "timeout", reason: "aborted" }
      : { ok: false, code: "provider_error", reason: "provider_error" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Generate three validated directions, or fail closed. One bounded retry: if the
 * first attempt is present-but-invalid, retry once with terse validation feedback.
 * Timeouts and provider errors do NOT retry (the Host's flow must not hang).
 */
export async function generateDirections(input: DirectionGenerateInput): Promise<DirectionGenerateResult> {
  if (!isLlmAvailable()) {
    logGenOutcome("provider_unavailable");
    return { ok: false, code: "provider_unavailable" };
  }

  const base: LlmChatMessage[] = [
    { role: "system", content: systemPrompt(input.locale) },
    { role: "user", content: userPrompt(input.problemStatement) },
  ];

  let lastCode: DirectionGenerateErrorCode = "invalid_output";
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const messages =
      i === 0
        ? base
        : [
            ...base,
            {
              role: "user" as const,
              content:
                "The previous response was not valid. Return ONLY the JSON object with EXACTLY three distinct directions, each with a concrete observable_behavior and honest success_evidence_hint. No markdown, no extra text.",
            },
          ];
    const r = await attempt(messages);
    if (r.ok) {
      logGenOutcome(i === 0 ? "generated_valid" : "generated_valid_on_retry");
      return { ok: true, suggestions: r.suggestions, version: DIRECTION_GENERATION_VERSION };
    }
    lastCode = r.code;
    logGenOutcome("attempt_failed", r.reason);
    // Only "invalid_output" is worth a retry; timeouts/provider errors bail immediately.
    if (r.code !== "invalid_output") break;
  }
  return { ok: false, code: lastCode };
}

// ===========================================================================
// SIMPLE MODE — ONE suggestion (Foundry Simple Mode, Slice 1).
//
// Same client, model, timeout and single bounded retry as `generateDirections`; no second AI
// architecture. The input is the manager's one sentence and the locale — nothing else reaches the
// provider. Timing is RETURNED (and logged as numbers only) so the caller can measure latency
// without any behaviour change; the sentence and the suggestion are never logged.
// ===========================================================================

export type SimpleSuggestionErrorCode = "empty_input" | "input_too_long" | "provider_unavailable" | "timeout" | "provider_error" | "invalid_output";

export type SimpleSuggestionResult =
  | { ok: true; suggestion: SimpleSuggestion; version: string; timing: { totalMs: number; attempts: number } }
  | { ok: false; code: SimpleSuggestionErrorCode; timing: { totalMs: number; attempts: number } };

/** The manager's sentence: one line of intent, not a document. */
export const SIMPLE_GOAL_MAX_CHARS = 500;

function simpleSystemPrompt(locale: "en" | "ko"): string {
  const isKo = locale === "ko";
  return [
    "A manager tells you, in one sentence, what they want their team to do better at work.",
    "Turn it into ONE concrete behaviour the team can practise, and WHEN it happens.",
    "Rules:",
    "- behavior: one plain sentence describing a specific action a colleague could see or hear someone do (for example: says, checks, writes down, asks, confirms, fixes). Not a goal, not a feeling, not a question.",
    "- when: the repeatable moment it happens (for example: before the first patient of the day; at every morning huddle). Never a date or a one-time event.",
    "- Everyday workplace words only. Do not use these words: training, module, evidence, observable, capability, competency, rubric, verification, learning objective, learner, curriculum, assessment, BTY, Arena, Foundry.",
    "- Invent NO names, roles, incidents, numbers, clinical, legal or patient facts that the manager did not state.",
    `- Length: behavior at most ${SIMPLE_SUGGESTION_LIMITS.behavior} characters; when at most ${SIMPLE_SUGGESTION_LIMITS.when} characters.`,
    isKo ? "- Write both fields in natural Korean." : "- Write both fields in natural English.",
    'Return ONLY this JSON object and nothing else: {"behavior": string, "when": string}',
  ].join("\n");
}

async function simpleAttempt(
  messages: LlmChatMessage[],
): Promise<{ ok: true; suggestion: SimpleSuggestion } | { ok: false; code: SimpleSuggestionErrorCode; reason: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const completion = await getLlmClient().chat.completions.create(
      {
        model: getLlmModel(),
        messages,
        temperature: 0.4,
        max_tokens: 220,
        response_format: { type: "json_object" },
      },
      { signal: controller.signal },
    );
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return { ok: false, code: "invalid_output", reason: "empty_output" };
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFences(raw));
    } catch {
      return { ok: false, code: "invalid_output", reason: "malformed_json" };
    }
    const v = validateSimpleSuggestion(parsed);
    return v.ok ? { ok: true, suggestion: v.suggestion } : { ok: false, code: "invalid_output", reason: v.code };
  } catch {
    return controller.signal.aborted
      ? { ok: false, code: "timeout", reason: "aborted" }
      : { ok: false, code: "provider_error", reason: "provider_error" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * ONE suggested behaviour + its moment from ONE manager sentence, or a truthful failure code.
 * Empty / too-long input fails BEFORE any provider call. One bounded retry, only for invalid
 * output (timeouts and provider errors return at once, like `generateDirections`).
 */
export async function generateSimpleSuggestion(
  input: { goal: string; locale: "en" | "ko" },
  clock: () => number = () => Date.now(),
): Promise<SimpleSuggestionResult> {
  const started = clock();
  const done = (attempts: number) => ({ totalMs: Math.max(0, clock() - started), attempts });
  const goal = typeof input.goal === "string" ? input.goal.replace(/\s+/g, " ").trim() : "";
  if (!goal) return { ok: false, code: "empty_input", timing: done(0) };
  if (goal.length > SIMPLE_GOAL_MAX_CHARS) return { ok: false, code: "input_too_long", timing: done(0) };
  if (!isLlmAvailable()) {
    logSimpleOutcome("provider_unavailable", done(0));
    return { ok: false, code: "provider_unavailable", timing: done(0) };
  }
  const base: LlmChatMessage[] = [
    { role: "system", content: simpleSystemPrompt(input.locale) },
    { role: "user", content: `What the manager wants their team to do better:\n${goal}` },
  ];
  let lastCode: SimpleSuggestionErrorCode = "invalid_output";
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const messages = i === 0 ? base : [...base, {
      role: "user" as const,
      content: 'That was not valid. Return ONLY {"behavior": string, "when": string}: one short observable action in plain everyday words, and a repeatable moment (never a date).',
    }];
    const r = await simpleAttempt(messages);
    if (r.ok) {
      const timing = done(i + 1);
      logSimpleOutcome(i === 0 ? "generated_valid" : "generated_valid_on_retry", timing);
      return { ok: true, suggestion: r.suggestion, version: SIMPLE_SUGGESTION_VERSION, timing };
    }
    lastCode = r.code;
    logSimpleOutcome("attempt_failed", done(i + 1), r.reason);
    if (r.code !== "invalid_output") return { ok: false, code: lastCode, timing: done(i + 1) };
  }
  return { ok: false, code: lastCode, timing: done(MAX_ATTEMPTS) };
}

function logSimpleOutcome(outcome: string, timing: { totalMs: number; attempts: number }, code?: string): void {
  // Numbers and codes only — never the manager's sentence or the generated text.
  console.info(`[simpleSuggestion] ${outcome} ms=${timing.totalMs} attempts=${timing.attempts}${code ? ` code=${code}` : ""}`);
}
