import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type ConsumedDelayedOutcomeTrigger = {
  triggerId: string;
  dueAt: string | null;
  payload: Record<string, unknown>;
};

export type DelayedOutcomeConsumeResult = {
  consumedCount: number;
  firstTriggerId: string | null;
  triggers: ConsumedDelayedOutcomeTrigger[];
};

function resolveMemoryQueueClient(supabase?: SupabaseClient): SupabaseClient | null {
  return supabase ?? getSupabaseAdmin();
}

/**
 * Consumes due delayed-outcome triggers for one user.
 * Only touches `trigger_type = delayed_outcome` to avoid collisions with recall consumers.
 */
export async function consumeDueDelayedOutcomeTriggersForUser(input: {
  userId: string;
  now?: Date;
  limit?: number;
  supabase?: SupabaseClient;
}): Promise<DelayedOutcomeConsumeResult> {
  const client = resolveMemoryQueueClient(input.supabase);
  if (!client) {
    return { consumedCount: 0, firstTriggerId: null, triggers: [] };
  }
  const nowIso = (input.now ?? new Date()).toISOString();
  const limit = Math.max(1, Math.min(input.limit ?? 10, 100));

  const { data: rows, error: listErr } = await client
    .from("user_memory_trigger_queue")
    .select("id, due_at, payload")
    .eq("user_id", input.userId)
    .eq("trigger_type", "delayed_outcome")
    .eq("status", "pending")
    .lte("due_at", nowIso)
    .order("due_at", { ascending: true })
    .limit(limit);

  if (listErr || !rows?.length) {
    return { consumedCount: 0, firstTriggerId: null, triggers: [] };
  }

  const consumed: ConsumedDelayedOutcomeTrigger[] = [];
  for (const raw of rows) {
    const row = raw as { id?: string; due_at?: string | null; payload?: unknown };
    const triggerId = typeof row.id === "string" ? row.id : "";
    if (!triggerId) continue;

    const { data: claimed, error: claimErr } = await client
      .from("user_memory_trigger_queue")
      .update({ status: "processing" })
      .eq("id", triggerId)
      .eq("user_id", input.userId)
      .eq("trigger_type", "delayed_outcome")
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (claimErr || !claimed) continue;

    const payload =
      row.payload != null && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {};

    const { error: doneErr } = await client
      .from("user_memory_trigger_queue")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("id", triggerId)
      .eq("user_id", input.userId)
      .eq("trigger_type", "delayed_outcome")
      .eq("status", "processing");
    if (doneErr) {
      await client
        .from("user_memory_trigger_queue")
        .update({ status: "pending" })
        .eq("id", triggerId)
        .eq("user_id", input.userId)
        .eq("trigger_type", "delayed_outcome");
      continue;
    }

    consumed.push({
      triggerId,
      dueAt: typeof row.due_at === "string" ? row.due_at : null,
      payload,
    });
  }

  return {
    consumedCount: consumed.length,
    firstTriggerId: consumed[0]?.triggerId ?? null,
    triggers: consumed,
  };
}
