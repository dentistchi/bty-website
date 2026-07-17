import { getLlmClient, getLlmModel, isLlmAvailable, type LlmChatMessage } from "@/lib/bty/llm/client";
import {
  validateDirectionSuggestions,
  DIRECTION_COUNT,
  DIRECTION_GENERATION_VERSION,
  DIRECTION_LIMITS,
  type DirectionSuggestion,
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
