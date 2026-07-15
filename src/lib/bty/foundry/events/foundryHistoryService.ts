import type { SupabaseClient } from "@supabase/supabase-js";
import { validateLivingReflection, type LivingReflection } from "@/domain/foundry/living-reflection";
import { excerptOf, type CompletionMeaning, type FoundryHistoryRecord } from "@/domain/foundry/living-thread";

/**
 * Foundry History — service layer.
 *
 * Reads the CURRENT user's own completed Foundry trainings. The progress table is
 * service-role only (RLS default-deny), so this runs through the admin client but
 * is ALWAYS scoped by `linked_user_id = <authenticated user>` — the route resolves
 * the user id from the session; the client can never supply or spoof it. Only the
 * caller's own rows (their own private response text + their own AI reflection)
 * are ever returned. No other participant's data is read. No fabricated fields:
 * checkpoint reflections are not persisted anywhere, so they are not surfaced.
 */

type ProgressRow = {
  event_id: string;
  completed_at: string;
  response_text: string | null;
  reflection: unknown;
  completion_state: string | null;
};

const HISTORY_COLS = "event_id, completed_at, response_text, reflection, completion_state";

export type FoundryHistoryItem = {
  eventId: string;
  eventTitle: string;
  completedAt: string;
  /** The user's own final reflection (owner-only) — full text for the detail view. */
  responseText: string;
  /** Short excerpt for the list surface. */
  responseExcerpt: string;
  /** The full stored AI Living Reflection, or null if none was produced. */
  aiReflection: LivingReflection | null;
  /** A short AI reflection meaning line (the living sentence), reference only. */
  aiReflectionLine: string | null;
  completionState: CompletionMeaning | null;
};

function parseCompletionMeaning(v: unknown): CompletionMeaning | null {
  return v === "pass" || v === "review" || v === "incomplete" ? v : null;
}

/**
 * The caller's completed Foundry trainings, newest first. Returns [] when the
 * admin client is unavailable or the user has none.
 */
export async function listUserFoundryHistory(
  admin: SupabaseClient,
  userId: string,
): Promise<FoundryHistoryItem[]> {
  if (!userId) return [];

  const { data: rows } = await admin
    .from("foundry_event_training_progress")
    .select(HISTORY_COLS)
    .eq("linked_user_id", userId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .returns<ProgressRow[]>();

  if (!rows || rows.length === 0) return [];

  // Re-attach event titles (owner of the event may differ; title is not private).
  const eventIds = [...new Set(rows.map((r) => r.event_id))];
  const { data: events } = await admin
    .from("foundry_events")
    .select("id, title")
    .in("id", eventIds)
    .returns<{ id: string; title: string }[]>();
  const titleById = new Map((events ?? []).map((e) => [e.id, e.title] as const));

  return rows.map((r) => {
    const stored = validateLivingReflection(r.reflection);
    const aiReflection = stored.ok ? stored.value : null;
    const responseText = (r.response_text ?? "").trim();
    return {
      eventId: r.event_id,
      eventTitle: titleById.get(r.event_id) ?? "Foundry training",
      completedAt: r.completed_at,
      responseText,
      responseExcerpt: excerptOf(responseText),
      aiReflection,
      aiReflectionLine: aiReflection?.livingSentence ?? null,
      completionState: parseCompletionMeaning(r.completion_state),
    };
  });
}

/** Project history items into the pure-domain records the thread engine consumes. */
export function toThreadRecords(items: FoundryHistoryItem[]): FoundryHistoryRecord[] {
  return items.map((it) => ({
    eventId: it.eventId,
    eventTitle: it.eventTitle,
    completedAt: it.completedAt,
    responseText: it.responseText,
    aiReflectionLine: it.aiReflectionLine,
    completionState: it.completionState,
  }));
}
