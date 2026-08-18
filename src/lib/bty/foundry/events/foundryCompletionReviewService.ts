/**
 * Authenticated, read-only completion review — Slice 3.1B-3E.1.
 *
 * A learner reviews their OWN completed Foundry assignment WITHOUT rejoining the anonymous
 * Room. Ownership is enforced in-code against the immutable assignment snapshot (mirroring
 * the claim RPC): the caller must own the assignment (`user_id_snapshot === authUserId`) and
 * it must be `completed`. We then resolve the bound participant and read only that
 * participant's stored completion content from the single progress row. No schema change —
 * the existing participant binding fully supports review.
 *
 * Returns null for ANY mismatch (missing / not owned / not completed / no participant) so the
 * route answers a neutral 404 — never disclosing another learner's assignment or content.
 * Reads only; creates no participant, awards no XP, mutates no status.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { readContentType, type FoundryContentType } from "@/domain/foundry/events/content-type";

export type CompletionReflection = {
  whatEmerged: string | null;
  whereYouStretched: string | null;
  livingSentence: string | null;
  nextInvitation: string | null;
};

export type CompletionReview = {
  assignmentId: string;
  eventId: string;
  title: string;
  /** R4-R2G — all four types; null = unknown stored discriminator (never reported as YouTube). */
  contentType: FoundryContentType | null;
  completedAt: string | null;
  completionState: "pass" | "review" | "incomplete" | null;
  /** The learner's own free-text reflection (the only learner-authored content). */
  responseText: string | null;
  /** The derived four-section AI "Living Reflection", or null if never generated. */
  reflection: CompletionReflection | null;
};

type AssignmentRow = {
  id: string;
  event_id: string;
  participant_id: string | null;
  status: string;
  user_id_snapshot: string;
  completed_at: string | null;
};

function parseReflection(raw: unknown): CompletionReflection | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const pick = (k: string) => (typeof r[k] === "string" && (r[k] as string).trim() ? (r[k] as string) : null);
  const out = {
    whatEmerged: pick("whatEmerged"),
    whereYouStretched: pick("whereYouStretched"),
    livingSentence: pick("livingSentence"),
    nextInvitation: pick("nextInvitation"),
  };
  return out.whatEmerged || out.whereYouStretched || out.livingSentence || out.nextInvitation ? out : null;
}

/**
 * Load the authenticated caller's OWN completed-assignment review, or null on any mismatch.
 * `authUserId` is server-derived (never client-supplied); `assignmentId` is the path param.
 */
export async function getMyCompletionReview(
  admin: SupabaseClient,
  authUserId: string,
  assignmentId: string,
): Promise<CompletionReview | null> {
  const { data: asg } = await admin
    .from("foundry_event_assignments")
    .select("id, event_id, participant_id, status, user_id_snapshot, completed_at")
    .eq("id", assignmentId)
    .maybeSingle<AssignmentRow>();

  // Neutral gate: owner + completed + has a bound participant. Any miss → null (404 upstream).
  if (
    !asg ||
    asg.user_id_snapshot !== authUserId ||
    asg.status !== "completed" ||
    !asg.participant_id
  ) {
    return null;
  }

  const { data: ev } = await admin
    .from("foundry_events")
    .select("title, content_type")
    .eq("id", asg.event_id)
    .maybeSingle<{ title: string; content_type: string | null }>();

  const { data: prog } = await admin
    .from("foundry_event_training_progress")
    .select("response_text, reflection, completion_state, completed_at")
    .eq("event_id", asg.event_id)
    .eq("participant_id", asg.participant_id)
    .maybeSingle<{
      response_text: string | null;
      reflection: unknown;
      completion_state: string | null;
      completed_at: string | null;
    }>();

  const contentType = readContentType(ev?.content_type);
  const completionState =
    prog?.completion_state === "pass" || prog?.completion_state === "review" || prog?.completion_state === "incomplete"
      ? prog.completion_state
      : null;

  return {
    assignmentId: asg.id,
    eventId: asg.event_id,
    title: ev?.title ?? "",
    contentType,
    completedAt: asg.completed_at ?? prog?.completed_at ?? null,
    completionState,
    responseText: prog?.response_text ?? null,
    reflection: parseReflection(prog?.reflection),
  };
}
