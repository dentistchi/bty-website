/**
 * Consumes pending `memory_pattern_threshold` triggers after scenario selection:
 * inserts {@link user_memory_recall_log}, marks trigger processed.
 * Requires {@link getSupabaseAdmin} — no recall when admin is unavailable.
 */

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { ArenaRecallPrompt } from "@/lib/bty/arena/memoryRecallPrompt.types";

type TriggerPayload = {
  flag_type?: string;
  milestones?: string[];
  total_count?: number;
  consecutive_count?: number;
  /** Scenario where the pattern threshold was crossed (from enqueue). */
  recalled_from_scenario_id?: string;
};

export function buildRecallNarrative(payload: TriggerPayload, locale: "en" | "ko"): string {
  const milestones = payload.milestones ?? [];

  if (locale === "ko") {
    if (milestones.includes("consecutive_3")) {
      return "최근 비슷한 선택이 이어졌어요. 다음 장면은 그 흐름과 닿아 있어요.";
    }
    if (milestones.includes("total_5")) {
      return "비슷한 순간을 여러 번 지나왔어요. 지금 장면도 그 길 위에 있어요.";
    }
    return "지금까지의 경험이 다음 장면과 조용히 이어져요.";
  }

  if (milestones.includes("consecutive_3")) {
    return "A similar thread has been showing up lately—this next moment sits in that same space.";
  }
  if (milestones.includes("total_5")) {
    return "You've crossed paths with this kind of moment a few times—here's another scene along that thread.";
  }
  return "Your recent runs echo into this next moment—context, not a verdict.";
}

/** Matches {@link user_behavior_pattern_state} keys (memory-pattern-aggregation.service). */
export function derivePatternKeyForRecall(payload: TriggerPayload): string {
  const flag = (payload.flag_type ?? "unknown").trim() || "unknown";
  const ms = payload.milestones ?? [];
  if (ms.includes("consecutive_3")) return `flag_consecutive:${flag}`;
  if (ms.includes("total_5")) return `flag_total:${flag}`;
  return `flag_consecutive:${flag}`;
}

/**
 * After final scenario selection: claim oldest pending pattern-threshold trigger,
 * write recall log, mark trigger processed. Returns payload for API/UI or null.
 */
export async function consumePendingPatternThresholdRecall(input: {
  userId: string;
  locale: "en" | "ko";
  scenarioId: string;
}): Promise<ArenaRecallPrompt | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const { data: rows, error: listErr } = await admin
    .from("user_memory_trigger_queue")
    .select("id, payload")
    .eq("user_id", input.userId)
    .eq("trigger_type", "memory_pattern_threshold")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);

  if (listErr) {
    console.warn("[consumePendingPatternThresholdRecall] list", listErr.message);
    return null;
  }
  const row = rows?.[0] as { id: string; payload?: unknown } | undefined;
  if (!row?.id) return null;

  const triggerId = row.id;
  const payload = (row.payload ?? {}) as TriggerPayload;

  const { data: claimed, error: claimErr } = await admin
    .from("user_memory_trigger_queue")
    .update({ status: "processing" })
    .eq("id", triggerId)
    .eq("user_id", input.userId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (claimErr || !claimed) {
    return null;
  }

  const message = buildRecallNarrative(payload, input.locale);
  const rawNext = String(input.scenarioId ?? "").trim();
  /** Next scenario where recall UI is shown (session router). */
  const triggerScenarioId = rawNext !== "" ? rawNext : "unknown";

  const rawFrom = typeof payload.recalled_from_scenario_id === "string" ? payload.recalled_from_scenario_id.trim() : "";
  /** Scenario where the threshold was crossed; enqueue must set this. Legacy rows → placeholder. */
  const recalledFromScenarioId = rawFrom !== "" ? rawFrom : "unknown";

  const patternKey = derivePatternKeyForRecall(payload);
  const triggeredAt = new Date().toISOString();

  const context = {
    trigger_id: triggerId,
    trigger_scenario_id: triggerScenarioId,
    recalled_from_scenario_id: recalledFromScenarioId,
    pattern_key: patternKey,
    flag_type: payload.flag_type ?? null,
    milestones: payload.milestones ?? [],
    locale: input.locale,
  };

  const { error: logErr } = await admin.from("user_memory_recall_log").insert({
    user_id: input.userId,
    recall_kind: "memory_pattern_threshold",
    recall_type: "memory_pattern_threshold",
    recall_message: message,
    trigger_scenario_id: triggerScenarioId,
    recalled_from_scenario_id: recalledFromScenarioId,
    pattern_key: patternKey,
    triggered_at: triggeredAt,
    context: context as unknown,
    related_event_ids: [],
  });

  if (logErr) {
    console.warn("[consumePendingPatternThresholdRecall] recall_log", logErr.message);
    await admin
      .from("user_memory_trigger_queue")
      .update({ status: "pending" })
      .eq("id", triggerId)
      .eq("user_id", input.userId);
    return null;
  }

  const { error: doneErr } = await admin
    .from("user_memory_trigger_queue")
    .update({
      status: "processed",
      processed_at: new Date().toISOString(),
    })
    .eq("id", triggerId)
    .eq("user_id", input.userId);

  if (doneErr) {
    console.warn("[consumePendingPatternThresholdRecall] finalize", doneErr.message);
  }

  return {
    message,
    triggerId,
    triggerType: "memory_pattern_threshold",
  };
}
