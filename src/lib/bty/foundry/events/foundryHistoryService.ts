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
  id: string;
  event_id: string;
  completed_at: string;
  response_text: string | null;
  learner_reflection_text: string | null;
  shared_understanding_response: string | null;
  decision_response_text: string | null;
  reflection: unknown;
  completion_state: string | null;
};

/*
  OWNER-ONLY ALLOW-LIST. Every column here reaches the caller, and the query below is scoped
  `linked_user_id = userId` — that scope is what makes it safe to carry private text at all.

  `learner_reflection_text` joins it in Slice 3.2R-R8D-R1. It was written by R8B and read by
  nothing, so the learner could write a reflection and never see it again; Center is the surface
  that exists to show a learner their own private writing. The HOST projections are separate
  queries with their own allow-lists and are deliberately untouched — widening this one cannot
  widen those.

  `decision_response_text` joins in Slice 3.2R-R1.1. R1 gave the learner a DECIDED chip and no way
  to see WHAT they decided — the same shape of gap R8D-R1 closed for `learner_reflection_text`,
  which R8B wrote and nothing read. A rung the learner cannot open is a claim, not a record.

  It is already Host-visible by settled 3.2M-1 design, so carrying it on this OWNER-SCOPED read
  widens nothing: this query is `linked_user_id = <session user>`, and the Host projection is a
  separate query with its own allow-list that this cannot reach.
*/
const HISTORY_COLS =
  "id, event_id, completed_at, response_text, learner_reflection_text, shared_understanding_response, decision_response_text, reflection, completion_state";

export type FoundryHistoryItem = {
  /** Stable owner-scoped record id (the progress row id) — the Center deep-link entry (Slice 3.1B-3I). */
  entryId: string;
  eventId: string;
  eventTitle: string;
  /** Source content type for the learner's My Learning surface (Slice 3.1B-3H). */
  contentType: "youtube" | "document";
  /** The learner's OWN Shared Understanding answer (Foundry surface). null when the module had none. */
  sharedUnderstanding: string | null;
  completedAt: string;
  /**
   * The learner's answer to the COMPLETION CHECK — what they said they will do (owner-only).
   *
   * Named `responseText` since long before the split and kept that way on purpose: renaming it
   * would touch the thread engine, My Learning and Center at once for no behavioural gain. What
   * it MEANS is `response_text`, which post-R8B is the BEFORE YOU FINISH answer.
   */
  responseText: string;
  /**
   * The learner's answer to the journey's REFLECT question — what already happens (owner-only,
   * Slice 3.2R-R8D-R1). null on every entry whose event never asked one, which is every entry
   * completed before R8B. NEVER the AI `aiReflection`, and never Host-visible.
   */
  learnerReflection: string | null;
  /**
   * What the learner decided to DO, in their own words (Slice 3.2R-R1.1). null when the
   * published journey asked for no decision — which is every entry on staging today, and must
   * render as absence rather than as an empty box. Never BTY's proposed sentence.
   */
  decisionResponse: string | null;
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
    .select("id, title, content_type")
    .in("id", eventIds)
    .returns<{ id: string; title: string; content_type: string | null }[]>();
  const metaById = new Map((events ?? []).map((e) => [e.id, e] as const));

  return rows.map((r) => {
    const stored = validateLivingReflection(r.reflection);
    const aiReflection = stored.ok ? stored.value : null;
    const responseText = (r.response_text ?? "").trim();
    const learnerReflection = (r.learner_reflection_text ?? "").trim();
    const ev = metaById.get(r.event_id);
    const sharedUnderstanding = (r.shared_understanding_response ?? "").trim();
    const decisionResponse = (r.decision_response_text ?? "").trim();
    return {
      entryId: r.id,
      eventId: r.event_id,
      eventTitle: ev?.title ?? "Foundry training",
      contentType: ev?.content_type === "document" ? "document" : "youtube",
      sharedUnderstanding: sharedUnderstanding.length > 0 ? sharedUnderstanding : null,
      completedAt: r.completed_at,
      responseText,
      responseExcerpt: excerptOf(responseText),
      learnerReflection: learnerReflection.length > 0 ? learnerReflection : null,
      decisionResponse: decisionResponse.length > 0 ? decisionResponse : null,
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
