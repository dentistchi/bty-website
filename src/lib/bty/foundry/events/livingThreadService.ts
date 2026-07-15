import type { SupabaseClient } from "@supabase/supabase-js";
import {
  evaluateThreadEligibility,
  buildEvidencePacket,
  evidenceFingerprint,
  validateLivingThread,
  LIVING_THREAD_PROMPT_VERSION,
  type FoundryHistoryRecord,
  type LivingThread,
  type EvidencePacket,
  type ThreadStatus,
} from "@/domain/foundry/living-thread";
import { renderFallbackThread, buildThreadMessages } from "./livingThreadExpression";
import { getLlmClient, getLlmModel, isLlmAvailable } from "@/lib/bty/llm/client";

/**
 * Foundry Living Thread — service layer (orchestration + persistence).
 *
 * Pipeline: history records → Eligibility (domain) → Evidence Packet (domain) →
 * Fingerprint (domain) → restore-or-generate → LLM express → Validator (domain) →
 * deterministic fallback → persist MEANING (idempotent per evidence fingerprint).
 *
 * Idempotency: the stored thread is keyed by (user_id, evidence_fingerprint). Same
 * evidence + prompt version restores the SAME thread; changed evidence → a new
 * fingerprint → a new generation. Concurrent generators converge on one canonical
 * row via the unique index (upsert-ignore then re-read). Provider failure never
 * blocks — history is always shown; the thread falls back to the deterministic
 * form. This service NEVER awards XP, mutates completion, or reads another user's
 * data (every query is scoped by the authenticated user_id).
 */

export type ThreadResult =
  | { status: Exclude<ThreadStatus, "eligible">; thread: null; sourceCount: number; spanDays: number }
  | { status: "eligible"; thread: LivingThread; generated: boolean; sourceCount: number; spanDays: number };

/** Restore-only result (fast path: no LLM). `needsGeneration` = eligible but not yet stored. */
export type ThreadRestore =
  | { status: Exclude<ThreadStatus, "eligible">; thread: null; needsGeneration: false; sourceCount: number; spanDays: number }
  | { status: "eligible"; thread: LivingThread | null; needsGeneration: boolean; sourceCount: number; spanDays: number };

const LLM_TIMEOUT_MS = 12_000;

function logThreadOutcome(outcome: string, code?: string): void {
  console.info(`[livingThread] ${outcome}${code ? ` code=${code}` : ""}`);
}

function stripJsonFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

async function expressThreadWithLlm(packet: EvidencePacket): Promise<LivingThread | null> {
  if (!isLlmAvailable()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const completion = await getLlmClient().chat.completions.create(
      { model: getLlmModel(), messages: buildThreadMessages(packet), temperature: 0.6, top_p: 0.9, max_tokens: 400 },
      { signal: controller.signal },
    );
    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      logThreadOutcome("provider_invalid", "empty_output");
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFences(raw));
    } catch {
      logThreadOutcome("provider_invalid", "malformed_shape");
      return null;
    }
    const validated = validateLivingThread(parsed, packet);
    if (!validated.ok) {
      logThreadOutcome("provider_invalid", validated.reason);
      return null;
    }
    return validated.value;
  } catch {
    logThreadOutcome(controller.signal.aborted ? "provider_timeout" : "provider_error");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getStoredThread(
  admin: SupabaseClient,
  userId: string,
  fingerprint: string,
  packet: EvidencePacket,
): Promise<LivingThread | null> {
  const { data } = await admin
    .from("foundry_living_thread")
    .select("thread")
    .eq("user_id", userId)
    .eq("evidence_fingerprint", fingerprint)
    .maybeSingle<{ thread: unknown }>();
  if (!data?.thread) return null;
  // Re-validate against the current packet (evidence is unchanged — fingerprint
  // matched). If a stored value ever fails the gate, treat it as absent.
  const v = validateLivingThread(data.thread, packet);
  return v.ok ? v.value : null;
}

/**
 * RESTORE-ONLY (fast, no provider call). Returns the stored thread for the current
 * evidence set if one exists, else marks it as needing generation. Lets History
 * render immediately without waiting on the LLM.
 */
export async function restoreLivingThread(
  admin: SupabaseClient,
  userId: string,
  records: FoundryHistoryRecord[],
): Promise<ThreadRestore> {
  const elig = evaluateThreadEligibility(records);
  const packet = buildEvidencePacket(records);
  if (!elig.eligible) {
    return { status: elig.status as Exclude<ThreadStatus, "eligible">, thread: null, needsGeneration: false, sourceCount: packet.sourceCount, spanDays: packet.spanDays };
  }
  const stored = await getStoredThread(admin, userId, evidenceFingerprint(records), packet);
  return { status: "eligible", thread: stored, needsGeneration: stored === null, sourceCount: packet.sourceCount, spanDays: packet.spanDays };
}

/**
 * Get the caller's Living Thread, generating (and persisting) it once per evidence
 * set. Returns a quiet status when the evidence is insufficient (0–2 records or a
 * span/criteria miss) — NO synthesized pattern is produced in that case.
 */
export async function getOrGenerateLivingThread(
  admin: SupabaseClient,
  userId: string,
  records: FoundryHistoryRecord[],
): Promise<ThreadResult> {
  const elig = evaluateThreadEligibility(records);
  const packet = buildEvidencePacket(records);
  if (!elig.eligible) {
    logThreadOutcome("insufficient", elig.status);
    return { status: elig.status as Exclude<ThreadStatus, "eligible">, thread: null, sourceCount: packet.sourceCount, spanDays: packet.spanDays };
  }

  const fingerprint = evidenceFingerprint(records);

  // Restore the canonical thread for this exact evidence set (idempotent).
  const stored = await getStoredThread(admin, userId, fingerprint, packet);
  if (stored) {
    logThreadOutcome("restored");
    return { status: "eligible", thread: stored, generated: false, sourceCount: packet.sourceCount, spanDays: packet.spanDays };
  }

  // Generate: LLM expresses; deterministic fallback guarantees a safe result.
  const expressed = await expressThreadWithLlm(packet);
  const thread = expressed ?? renderFallbackThread(packet);
  logThreadOutcome(expressed ? "generated_valid" : "fallback_used");

  // Persist idempotently — the unique (user_id, evidence_fingerprint) index makes
  // a concurrent generator's insert a no-op; we then re-read the canonical row so
  // concurrent callers converge on ONE thread.
  await admin
    .from("foundry_living_thread")
    .upsert(
      {
        user_id: userId,
        evidence_fingerprint: fingerprint,
        prompt_version: LIVING_THREAD_PROMPT_VERSION,
        thread,
        source_count: packet.sourceCount,
        evidence_span_start: packet.moments[0]?.date ?? null,
        evidence_span_end: packet.moments[packet.moments.length - 1]?.date ?? null,
      },
      { onConflict: "user_id,evidence_fingerprint", ignoreDuplicates: true },
    );

  const canonical = (await getStoredThread(admin, userId, fingerprint, packet)) ?? thread;
  return { status: "eligible", thread: canonical, generated: true, sourceCount: packet.sourceCount, spanDays: packet.spanDays };
}
