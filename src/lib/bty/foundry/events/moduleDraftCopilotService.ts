import { getLlmClient, getLlmModel, isLlmAvailable, type LlmChatMessage } from "@/lib/bty/llm/client";
import {
  validateModuleDraft,
  MODULE_DRAFT_GENERATION_VERSION,
  type ModuleDraftContext,
  type ModuleDraftValidated,
} from "@/domain/foundry/module/module-draft-copilot";
import { LEARNING_NEEDS, MATERIAL_INTENTS, FOLLOW_UP_DAY_OPTIONS, COMPLETION_PROMPT_MAX } from "@/domain/foundry/module/module-builder";

/**
 * Direction-to-Module Draft Copilot — generation service (server-only, Slice 2.4B).
 *
 * The Host has an approved direction (Capability + observable behavior + success
 * evidence) and an audience. This asks the provider for ONE structured "rest of the
 * module" draft — learning approach, a behavior-specific completion question, an Arena
 * recommendation with a reason, follow-up timing, and advisory material guidance —
 * using ONLY values the live Builder can represent. The domain validator decides
 * validity, fail-closed: on unavailable/timeout/provider-error, or output the validator
 * rejects (after one bounded retry), this returns a stable code. NO deterministic
 * fallback, NO draft mutation. The provider never sees a draft id or PII beyond the
 * Host's own canonical text; raw output is never returned or persisted.
 *
 * This is a Builder Copilot, not a mentor conversation — neutral product voice only.
 */

export type ModuleDraftGenerateResult =
  | { ok: true; value: ModuleDraftValidated; version: string }
  | { ok: false; code: ModuleDraftGenerateErrorCode };

export type ModuleDraftGenerateErrorCode = "provider_unavailable" | "timeout" | "provider_error" | "invalid_output";

const LLM_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 2; // one bounded retry only (§11I)

function logGenOutcome(outcome: string, code?: string): void {
  // Outcome/code only — never the Host problem statement or generated content.
  console.info(`[moduleDraftCopilot] ${outcome}${code ? ` code=${code}` : ""}`);
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
    "You are a product copilot for a workplace training design tool. Neutral, practical product language — NOT a mentor, coach, or character.",
    "The host has already chosen the training's Capability, observable behavior, and success evidence. Treat those as APPROVED and final — do NOT reconsider, replace, or restate the direction. Draft the REMAINING sections of the module, grounded in the supplied context.",
    "Produce EXACTLY ONE module draft. Rules:",
    `- learning_approach: a non-empty subset of ${JSON.stringify(LEARNING_NEEDS)}, proportionate to the behavior (do not select all four reflexively).`,
    "- completion_question: ONE question a participant answers after the material. It MUST be specific to the approved observable behavior, require a concrete decision/sentence/action/application, and NOT be a generic template, a yes/no question, a feelings prompt, or a summary request. Never claim the behavior is already competent, permanent, or that trust/understanding was achieved.",
    `  (Hard cap ${COMPLETION_PROMPT_MAX} characters.)`,
    "- arena_recommended: true ONLY when repeated practice under pressure is materially useful (judgment, communication, conflict, handoff, leadership, time pressure). For simple reference information, set false unless clearly justified. Always give a short arena_rationale.",
    `- follow_up_days: one of ${JSON.stringify(FOLLOW_UP_DAY_OPTIONS)}. follow_up_guidance is advisory and must NOT claim the behavior was verified or permanently changed.`,
    `- material_guidance.recommended_types: a non-empty subset of ${JSON.stringify(MATERIAL_INTENTS)}. material_guidance.suggestion identifies a useful FORMAT or STRUCTURE only. It must NOT claim that any file, video, checklist, policy, or document already exists or is attached/approved — the host provides the actual material.`,
    "- assumptions: list any assumption the draft depends on. warnings: when training alone may not fix the problem, include a note that it may also require a workflow, access, staffing, or policy change.",
    "Do not diagnose employees, infer intent, name people, invent metrics/policy, or make legal/clinical/patient claims not present in the context.",
    `Write all host-facing text in ${isKo ? "Korean" : "English"}.`,
    "Output ONLY a compact JSON object — no markdown, no code fences, no HTML, no comments, no preamble. EXACT shape:",
    '{"module_draft":{"learning_approach":string[],"learning_approach_rationale":string,"completion_question":string,"arena_recommended":boolean,"arena_rationale":string,"follow_up_days":number,"follow_up_guidance":string,"material_guidance":{"recommended_types":string[],"suggestion":string}},"assumptions":string[],"warnings":string[]}',
  ].join("\n");
}

function userPrompt(ctx: ModuleDraftContext): string {
  const lines = [
    `Real-world problem: ${ctx.problemStatement}`,
    `Audience: ${ctx.audienceType}${ctx.audienceDetail ? ` — ${ctx.audienceDetail}` : ""}`,
    ctx.capabilityCandidate ? `Capability: ${ctx.capabilityCandidate}` : null,
    `Approved observable behavior: ${ctx.observableBehavior}`,
    `Approved success evidence: ${ctx.successEvidence}`,
  ].filter(Boolean);
  return lines.join("\n");
}

async function attempt(
  messages: LlmChatMessage[],
): Promise<{ ok: true; value: ModuleDraftValidated } | { ok: false; code: ModuleDraftGenerateErrorCode; reason: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const client = getLlmClient();
    const completion = await client.chat.completions.create(
      {
        model: getLlmModel(),
        messages,
        temperature: 0.6,
        top_p: 0.9,
        max_tokens: 1200,
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
    const validated = validateModuleDraft(parsed);
    if (!validated.ok) return { ok: false, code: "invalid_output", reason: validated.code };
    return { ok: true, value: validated.value };
  } catch {
    return controller.signal.aborted
      ? { ok: false, code: "timeout", reason: "aborted" }
      : { ok: false, code: "provider_error", reason: "provider_error" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Generate one validated module draft, or fail closed. One bounded retry only for a
 * present-but-invalid response; timeouts and provider errors do not retry.
 */
export async function generateModuleDraft(
  ctx: ModuleDraftContext,
  locale: "en" | "ko",
): Promise<ModuleDraftGenerateResult> {
  if (!isLlmAvailable()) {
    logGenOutcome("provider_unavailable");
    return { ok: false, code: "provider_unavailable" };
  }
  const base: LlmChatMessage[] = [
    { role: "system", content: systemPrompt(locale) },
    { role: "user", content: userPrompt(ctx) },
  ];
  let lastCode: ModuleDraftGenerateErrorCode = "invalid_output";
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const messages =
      i === 0
        ? base
        : [
            ...base,
            {
              role: "user" as const,
              content:
                "The previous response was not valid. Return ONLY the JSON object with a behavior-specific completion_question (not generic/yes-no), supported enum values, and no claim that any material already exists. No markdown.",
            },
          ];
    const r = await attempt(messages);
    if (r.ok) {
      logGenOutcome(i === 0 ? "generated_valid" : "generated_valid_on_retry");
      return { ok: true, value: r.value, version: MODULE_DRAFT_GENERATION_VERSION };
    }
    lastCode = r.code;
    logGenOutcome("attempt_failed", r.reason);
    if (r.code !== "invalid_output") break; // only invalid output is worth a retry
  }
  return { ok: false, code: lastCode };
}
