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

/** Human phrase for the LLM — the derived MEANING, never a metric. */
function completionPhrase(state: CompletionState, locale: "en" | "ko"): string {
  const en: Record<CompletionState, string> = {
    pass: "The participant stayed with the whole video, present throughout.",
    review: "The participant moved through the video in their own way, skipping and returning to parts.",
    incomplete: "The participant made an early pass and did not stay with the whole video.",
  };
  const ko: Record<CompletionState, string> = {
    pass: "참가자는 영상 전체와 함께 머물렀고, 처음부터 끝까지 함께했습니다.",
    review: "참가자는 자신만의 방식으로 영상을 지나가며, 일부를 건너뛰고 다시 돌아왔습니다.",
    incomplete: "참가자는 초반만 보았고 영상 전체와 함께 머물지는 않았습니다.",
  };
  return (locale === "ko" ? ko : en)[state];
}

function buildLlmMessages(ctx: ReflectionContext): LlmChatMessage[] {
  const isKo = ctx.locale === "ko";
  const system = [
    "You are the voice of a BTY Living Reflection — a mirror, never a judge.",
    "You do NOT decide what the participant means or felt. You only re-express, in warm natural language, the meaning you are given.",
    "Rules you must obey:",
    "- Ground everything ONLY in the two pieces of evidence provided. Invent no facts, infer no hidden traits, draw no behavioral conclusions beyond the evidence.",
    "- Never mention numbers, percentages, metrics, watching statistics, seeking, or coverage. Never grade, score, or assign homework.",
    "- This is reflection, not evaluation. Be kind, specific, and brief.",
    `- Write in ${isKo ? "Korean" : "English"}.`,
    "Return ONLY a compact JSON object with EXACTLY these four string keys:",
    '"whatEmerged" (the thinking that showed up), "whereYouStretched" (how today differed), "livingSentence" (one memorable BTY sentence), "nextInvitation" (one gentle invitation for tomorrow — not homework).',
    "No markdown, no code fences, no extra keys, no commentary.",
  ].join("\n");

  const evidenceLines = [
    `Watching (meaning, not metrics): ${completionPhrase(ctx.completionState, ctx.locale)}`,
    ctx.hasResponse
      ? `The participant's own words: "${ctx.responseExcerpt}"`
      : "The participant did not leave written words this time.",
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

/**
 * Ask the LLM to EXPRESS the meaning. Returns a validated reflection, or null on
 * any failure (unavailable, network error, unparseable, or validation reject) so
 * the caller falls back to the deterministic template.
 */
async function expressReflectionWithLlm(ctx: ReflectionContext): Promise<LivingReflection | null> {
  if (!isLlmAvailable()) return null;
  try {
    const client = getLlmClient();
    const completion = await client.chat.completions.create({
      model: getLlmModel(),
      messages: buildLlmMessages(ctx),
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 500,
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFences(raw));
    } catch {
      return null;
    }
    const validated = validateLivingReflection(parsed);
    return validated.ok ? validated.value : null;
  } catch {
    return null;
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
  if (row.reflection_generated_at && row.reflection) {
    const stored = validateLivingReflection(row.reflection);
    if (stored.ok) {
      const state = parseCompletionState(row.completion_state) ?? "pass";
      return { ok: true, reflection: stored.value, completion_state: state, generated: false };
    }
    // Stored value somehow invalid → fall through and regenerate.
  }

  const completionState: CompletionState =
    parseCompletionState(clientCompletionState) ?? parseCompletionState(row.completion_state) ?? "pass";

  const ctx = buildReflectionContext({
    completionState,
    responseText: row.response_text,
    locale,
  });

  // LLM expresses; deterministic template guarantees a result.
  const expressed = await expressReflectionWithLlm(ctx);
  const reflection = expressed ?? renderTemplateReflection(ctx);

  // Persist MEANING only (never telemetry). Only claim the slot if still empty.
  await admin
    .from("foundry_event_training_progress")
    .update({
      completion_state: completionState,
      reflection,
      reflection_version: REFLECTION_VERSION,
      reflection_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .is("reflection_generated_at", null);

  return { ok: true, reflection, completion_state: completionState, generated: true };
}
