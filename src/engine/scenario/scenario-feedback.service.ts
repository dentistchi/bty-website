/**
 * After {@link SessionSummaryOverlay} dismiss — enqueue reflection prompts for HERO_TRAP / INTEGRITY_SLIP;
 * shell polls {@link getFeedbackPrompt}, user submits via {@link submitFeedback} → `scenario_feedback_responses`.
 * Responses feed {@link syncBehaviorPatterns} as {@link feedback_signal}.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionFlagBadgeVariant } from "@/domain/arena/sessionSummary";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

export type FeedbackFlagType = "HERO_TRAP" | "INTEGRITY_SLIP";

export type FeedbackPrompt = {
  queueId: string;
  scenarioId: string;
  flagType: FeedbackFlagType;
  promptKo: string;
  promptEn: string;
  createdAt: string;
};

/** Two flags × KO/EN — “why did you make that choice?” style prompts. */
export const FEEDBACK_PROMPT_MAP: Record<FeedbackFlagType, { prompt_ko: string; prompt_en: string }> = {
  HERO_TRAP: {
    prompt_ko:
      "히어로 트랩 선택을 했을 때, 그 순간 가장 끌렸던 생각이나 감정은 무엇이었나요? (한두 문장으로 적어 주세요)",
    prompt_en:
      "When you chose the hero-trap path, what thought or feeling pulled you most in that moment? (One or two sentences.)",
  },
  INTEGRITY_SLIP: {
    prompt_ko:
      "무결성 이탈 옵션을 고른 이유를 솔직하게 짚어 주세요. 당시 상황에서 무엇이 가장 부담으로 느껴졌나요?",
    prompt_en:
      "Briefly, why did you take the integrity-slip option? What felt most pressing or uncomfortable in that moment?",
  },
};

function badgeToFlagType(badge: SessionFlagBadgeVariant): FeedbackFlagType | null {
  if (badge === "hero_trap") return "HERO_TRAP";
  if (badge === "integrity_slip") return "INTEGRITY_SLIP";
  return null;
}

/**
 * Enqueue a feedback prompt after summary dismiss when the session flag is HERO_TRAP or INTEGRITY_SLIP.
 */
export async function enqueueFeedbackPrompt(
  userId: string,
  scenarioId: string,
  sessionFlagBadge: SessionFlagBadgeVariant,
  supabase?: SupabaseClient,
): Promise<void> {
  const flagType = badgeToFlagType(sessionFlagBadge);
  if (!flagType) return;

  const prompts = FEEDBACK_PROMPT_MAP[flagType];
  const client = supabase ?? (await getSupabaseServerClient());

  const { error } = await client.from("scenario_feedback_queue").insert({
    user_id: userId,
    scenario_id: scenarioId,
    flag_type: flagType,
    prompt_ko: prompts.prompt_ko,
    prompt_en: prompts.prompt_en,
  });

  if (error) throw new Error(error.message);
}

/**
 * Oldest pending queue row (no response yet) for the user, or null.
 */
export async function getFeedbackPrompt(
  userId: string,
  supabase?: SupabaseClient,
): Promise<FeedbackPrompt | null> {
  const client = supabase ?? (await getSupabaseServerClient());

  const { data: rows, error } = await client
    .from("scenario_feedback_queue")
    .select("id, scenario_id, flag_type, prompt_ko, prompt_en, created_at, deferred_until")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  const list = rows ?? [];
  if (list.length === 0) return null;

  const { data: responded, error: rErr } = await client
    .from("scenario_feedback_responses")
    .select("queue_id")
    .eq("user_id", userId);

  if (rErr) throw new Error(rErr.message);
  const respondedSet = new Set(
    (responded ?? []).map((r) => (r as { queue_id?: string }).queue_id).filter(Boolean) as string[],
  );

  const now = Date.now();
  for (const raw of list) {
    const r = raw as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : null;
    if (!id || respondedSet.has(id)) continue;
    const def = r.deferred_until;
    if (typeof def === "string") {
      const t = new Date(def).getTime();
      if (!Number.isNaN(t) && t > now) continue;
    }
    const ft = r.flag_type === "HERO_TRAP" || r.flag_type === "INTEGRITY_SLIP" ? r.flag_type : null;
    if (!ft) continue;
    return {
      queueId: id,
      scenarioId: typeof r.scenario_id === "string" ? r.scenario_id : "",
      flagType: ft,
      promptKo: typeof r.prompt_ko === "string" ? r.prompt_ko : "",
      promptEn: typeof r.prompt_en === "string" ? r.prompt_en : "",
      createdAt:
        typeof r.created_at === "string" ? r.created_at : new Date().toISOString(),
    };
  }

  return null;
}

async function resolvePendingQueueIdForScenario(
  client: SupabaseClient,
  userId: string,
  scenarioId: string,
): Promise<string | null> {
  const { data: queues, error } = await client
    .from("scenario_feedback_queue")
    .select("id")
    .eq("user_id", userId)
    .eq("scenario_id", scenarioId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  const ids = (queues ?? []).map((q) => (q as { id: string }).id).filter(Boolean);
  if (ids.length === 0) return null;

  const { data: responded, error: rErr } = await client
    .from("scenario_feedback_responses")
    .select("queue_id")
    .in("queue_id", ids);

  if (rErr) throw new Error(rErr.message);
  const done = new Set(
    (responded ?? []).map((r) => (r as { queue_id: string }).queue_id),
  );
  return ids.find((id) => !done.has(id)) ?? null;
}

/**
 * Persist user reflection for the oldest still-pending queue row for this `scenarioId`.
 */
export async function submitFeedback(
  userId: string,
  scenarioId: string,
  responseText: string,
  supabase?: SupabaseClient,
): Promise<void> {
  const trimmed = typeof responseText === "string" ? responseText.trim() : "";
  if (trimmed.length === 0) throw new Error("empty_response");
  if (trimmed.length < 50) throw new Error("response_too_short");

  const client = supabase ?? (await getSupabaseServerClient());

  const queueId = await resolvePendingQueueIdForScenario(client, userId, scenarioId);
  if (!queueId) throw new Error("no_pending_feedback_for_scenario");

  const { error } = await client.from("scenario_feedback_responses").insert({
    user_id: userId,
    scenario_id: scenarioId,
    queue_id: queueId,
    response_text: trimmed,
  });

  if (error) throw new Error(error.message);
}

const DEFER_MS = 24 * 60 * 60 * 1000;

/**
 * Snooze the pending queue row (24h) so {@link getFeedbackPrompt} skips it until then.
 */
export async function deferFeedbackPrompt(
  userId: string,
  queueId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  const client = supabase ?? (await getSupabaseServerClient());
  const until = new Date(Date.now() + DEFER_MS).toISOString();
  const { error } = await client
    .from("scenario_feedback_queue")
    .update({ deferred_until: until })
    .eq("id", queueId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}
