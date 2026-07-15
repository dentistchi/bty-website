import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildReflectionContext,
  validateLivingReflection,
  REFLECTION_VERSION,
  type LivingReflection,
  type ReflectionContext,
} from "@/domain/foundry/living-reflection";
import { parseCompletionState, type CompletionState } from "@/domain/foundry/watch-integrity";
import { renderTemplateReflection } from "./reflectionExpression";
import { resolveEventByToken, findParticipantBySession } from "./foundryEventService";
import { getLlmClient, getLlmModel, isLlmAvailable, type LlmChatMessage } from "@/lib/bty/llm/client";

/**
 * Foundry Living Reflection — service layer (AI Reflection V1).
 *
 * Orchestrates the pipeline: Reality → Rule Engine (domain) → Context Builder
 * (domain) → LLM expression (here) → Validator (domain) → persist MEANING.
 *
 * The DOMAIN decides meaning; this layer only asks the LLM to re-express that
 * meaning as natural language, then re-validates it. The LLM is given ONLY the
 * derived CompletionState (as a human phrase, never a number/metric) and the
 * participant's OWN words — never raw telemetry, never anything to infer from.
 * If the LLM is unavailable or its output fails the Validator, the deterministic
 * template renders the SAME meaning. Raw watch telemetry is NEVER read or stored.
 *
 * This service NEVER awards XP, NEVER mutates the completion/response flow, and
 * NEVER returns another participant's data. It only reads the caller's own
 * completed progress row and writes the four reflection columns.
 */

type ReflectionRow = {
  id: string;
  completed_at: string | null;
  response_text: string | null;
  completion_state: string | null;
  reflection: unknown;
  reflection_version: string | null;
  reflection_generated_at: string | null;
};

const REFLECTION_COLS =
  "id, completed_at, response_text, completion_state, reflection, reflection_version, reflection_generated_at";

export type ReflectionResult =
  | { ok: true; reflection: LivingReflection; completion_state: CompletionState; generated: boolean }
  | { ok: false; reason: string };

/**
 * The watch-state as a FACTUAL CONTENT BOUNDARY only — never a behavior verdict.
 * It tells the model how much content exists to ground in; it is never to be
 * mentioned or read as motivation, effort, attention, avoidance, or engagement.
 */
function completionBoundary(state: CompletionState, locale: "en" | "ko"): string {
  const en: Record<CompletionState, string> = {
    pass: "All of the video is available to ground in.",
    review: "All of the video is available to ground in.",
    incomplete: "Only the earlier portion of the video is available to ground in.",
  };
  const ko: Record<CompletionState, string> = {
    pass: "영상 전체를 근거로 삼을 수 있습니다.",
    review: "영상 전체를 근거로 삼을 수 있습니다.",
    incomplete: "영상의 앞부분만 근거로 삼을 수 있습니다.",
  };
  return (locale === "ko" ? ko : en)[state];
}

function buildLlmMessages(ctx: ReflectionContext): LlmChatMessage[] {
  const isKo = ctx.locale === "ko";
  const system = [
    "You are the voice of a BTY Living Reflection — a mirror held up to the person, never a judge, grader, or coach.",
    "Speak to them directly in second person (\"you\", \"your response\"). NEVER refer to them in the third person — never \"the participant\", \"the user\", or \"the employee\".",
    "EVIDENCE PRIORITY: the employee's own written response is the PRIMARY evidence. The host's question supplies the intended frame. Watch-state data ONLY bounds what content may be referenced — it must NEVER be read as motivation, effort, attention, avoidance, engagement, or character.",
    "Ground everything in that evidence. Invent no people, teams, deadlines, circumstances, or consequences that are not in the response.",
    "Do not praise, grade, diagnose, label personality, or say an answer is correct or incorrect. Do not give generic advice that would fit anyone.",
    "Never mention numbers, percentages, watching statistics, or the act of watching itself unless the employee explicitly wrote about it.",
    `Write in ${isKo ? "Korean" : "English"}.`,
    "Return ONLY a compact JSON object with EXACTLY these four string keys, each doing a DISTINCT job:",
    '"whatEmerged": mirror the single clearest idea actually present in their response, in second person. Not their submission and not their viewing behavior.',
    '"whereYouStretched": name one tension, tradeoff, or hesitation visible in their response. If none is genuinely there, offer a restrained line rather than inventing one. No praise, no accusation.',
    '"livingSentence": either one exact, meaningful, COMPLETE phrase quoted from their response, OR one short grounded sentence. Never a bare two- or three-word fragment.',
    '"nextInvitation": one grounded perspective that connects their response to what the host asked. Offer it — do not command it. No generic communication or leadership advice.',
    "Let the host's question shape at least one section, but never repeat its wording in more than one section.",
    "No markdown, no code fences, no extra keys, no commentary.",
  ].join("\n");

  const evidenceLines = [
    ctx.hasResponse
      ? `The employee's own words (PRIMARY evidence): "${ctx.responseFull}"`
      : "The employee did not leave written words this time.",
    ctx.hasQuestion
      ? `The host's question (the intended frame): "${ctx.questionExcerpt}"`
      : "The host left no specific reflection question.",
    `Content boundary (do NOT mention or interpret): ${completionBoundary(ctx.completionState, ctx.locale)}`,
  ];

  return [
    { role: "system", content: system },
    { role: "user", content: evidenceLines.join("\n") },
  ];
}

function stripJsonFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/** Bounded provider timeout — the reflection may never block the earned XP. */
const LLM_TIMEOUT_MS = 12_000;

/**
 * Bounded observability for the reflection outcome. Records ONLY the deterministic
 * outcome and (on rejection) the rule CODE — never the employee response, the host
 * question, the generated text, participant identity, or any provider payload.
 */
function logReflectionOutcome(outcome: string, code?: string): void {
  console.info(`[livingReflection] ${outcome}${code ? ` code=${code}` : ""}`);
}

/**
 * Ask the LLM to EXPRESS the meaning. Returns a validated reflection, or null on
 * any failure (unavailable, timeout, network error, unparseable, or validation
 * reject) so the caller falls back to the deterministic template. Each failure is
 * logged with a text-free code so over-rejection is observable without leaking data.
 */
async function expressReflectionWithLlm(ctx: ReflectionContext): Promise<LivingReflection | null> {
  if (!isLlmAvailable()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const client = getLlmClient();
    const completion = await client.chat.completions.create(
      {
        model: getLlmModel(),
        messages: buildLlmMessages(ctx),
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 500,
      },
      { signal: controller.signal },
    );
    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      logReflectionOutcome("provider_invalid", "empty_output");
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFences(raw));
    } catch {
      logReflectionOutcome("provider_invalid", "malformed_shape");
      return null;
    }
    const validated = validateLivingReflection(parsed, {
      questionExcerpt: ctx.questionExcerpt,
      responseExcerpt: ctx.responseExcerpt,
    });
    if (!validated.ok) {
      logReflectionOutcome("provider_invalid", validated.reason);
      return null;
    }
    return validated.value;
  } catch {
    logReflectionOutcome(controller.signal.aborted ? "provider_timeout" : "provider_error");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getReflectionRow(
  admin: SupabaseClient,
  eventId: string,
  participantId: string,
): Promise<ReflectionRow | null> {
  const { data } = await admin
    .from("foundry_event_training_progress")
    .select(REFLECTION_COLS)
    .eq("event_id", eventId)
    .eq("participant_id", participantId)
    .maybeSingle<ReflectionRow>();
  return data ?? null;
}

/**
 * The host's completion question for this event (grounding evidence only). Read on
 * the generation path only — the idempotent restore never needs it. Returns null
 * when the event has no content row; the reflection then grounds without it.
 */
async function getCompletionPrompt(admin: SupabaseClient, eventId: string): Promise<string | null> {
  const { data } = await admin
    .from("foundry_event_training_content")
    .select("completion_prompt")
    .eq("event_id", eventId)
    .maybeSingle<{ completion_prompt: string | null }>();
  return data?.completion_prompt ?? null;
}

/**
 * Generate (or return the already-persisted) Living Reflection for the caller's
 * own completed training. Idempotent: once a reflection is stored it is the
 * user's history and is returned verbatim on re-entry (no regeneration, no drift).
 *
 * `clientCompletionState` is the client-computed watch meaning (ephemeral
 * telemetry, already reduced to a state). It is trusted only as one of the three
 * enum values; if absent/invalid we prefer any persisted state, else default to
 * "pass" (the server already gated completion on the ENDED flag — the engine is
 * never more punitive than that gate).
 */
export async function generateLivingReflection(
  admin: SupabaseClient,
  token: string,
  sessionToken: string | null | undefined,
  clientCompletionState: unknown,
  locale: unknown,
): Promise<ReflectionResult> {
  const resolved = await resolveEventByToken(admin, token);
  if (!resolved.ok) return { ok: false, reason: "inactive" };

  const participant = await findParticipantBySession(admin, resolved.event.id, sessionToken);
  if (!participant) return { ok: false, reason: "no_session" };
  if (participant.status === "removed") return { ok: false, reason: "removed" };

  const row = await getReflectionRow(admin, resolved.event.id, participant.id);
  if (!row || !row.completed_at) return { ok: false, reason: "not_completed" };

  // Already produced → return the stored history unchanged (idempotent).
  const alreadyGenerated = Boolean(row.reflection_generated_at && row.reflection);
  if (alreadyGenerated) {
    const stored = validateLivingReflection(row.reflection);
    if (stored.ok) {
      const state = parseCompletionState(row.completion_state) ?? "pass";
      return { ok: true, reflection: stored.value, completion_state: state, generated: false };
    }
    // Stored value fails the (possibly stricter) quality gate → self-heal below:
    // regenerate AND overwrite the persisted value so the next read is stable.
  }

  const completionState: CompletionState =
    parseCompletionState(clientCompletionState) ?? parseCompletionState(row.completion_state) ?? "pass";

  // The host's completion question — an approved grounding input, read only here
  // (never on the idempotent restore). Best-effort: a missing question just drops
  // one line of evidence; it never blocks generation.
  const completionPrompt = await getCompletionPrompt(admin, resolved.event.id);

  const ctx = buildReflectionContext({
    completionState,
    responseText: row.response_text,
    questionText: completionPrompt,
    locale,
  });

  // LLM expresses; deterministic template guarantees a result.
  const expressed = await expressReflectionWithLlm(ctx);
  const reflection = expressed ?? renderTemplateReflection(ctx);
  const producedBy = expressed ? "generated_valid" : "fallback_used";
  logReflectionOutcome(alreadyGenerated ? "self_healed" : producedBy, alreadyGenerated ? producedBy : undefined);

  // Persist MEANING only (never telemetry).
  //  - First generation: claim the slot only if still empty (exactly-once guard).
  //  - Self-heal (stored value failed the quality gate): overwrite by id so the
  //    corrected reflection is stable on the next read.
  const patch = {
    completion_state: completionState,
    reflection,
    reflection_version: REFLECTION_VERSION,
    reflection_generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const write = admin.from("foundry_event_training_progress").update(patch).eq("id", row.id);
  if (alreadyGenerated) {
    await write; // overwrite the invalid stored value
  } else {
    await write.is("reflection_generated_at", null); // first-generation claim
  }

  return { ok: true, reflection, completion_state: completionState, generated: true };
}
