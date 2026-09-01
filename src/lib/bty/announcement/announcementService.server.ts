import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isAnnouncementResponse,
  normalizeQuestionText,
  projectForRecipient,
  summariseAnnouncement,
  type AnnouncementFunnel,
  type AnnouncementResponse,
  type RecipientProjection,
} from "@/domain/announcement/trackedAnnouncement";

/**
 * Tracked Announcement read + respond. Slice A1. SERVER ONLY.
 *
 * ★ THE PRIVACY BOUNDARY IS ENFORCED BY THE SELECT LIST, NOT BY A LATER FILTER.
 *
 * The participant projection never SELECTS `preview_text`, `source_metadata`, `external_key`,
 * `tenant_id`, `conversation_id` or the capture's channel/chat ids — so there is no code path on
 * which they could be forgotten and leak. A recipient sees the Host's own framing, which the Host
 * wrote knowing who would read it, plus a link that TEAMS still gates.
 *
 * That matters concretely: the source may be a private-channel post, and being selected into a BTY
 * audience proves nothing about whether Teams would let you read the original.
 */

type RecipientRow = {
  announcement_id: string;
  response: string | null;
  responded_at: string | null;
  bty_tracked_announcements: {
    id: string;
    host_framing: string;
    owner_user_id: string;
    bty_action_captures: { source_url: string | null } | null;
  } | null;
};

/**
 * What still needs this person's response, plus what they already answered.
 *
 * Scoped by `user_id` — the caller's own authenticated id, never a client-supplied one — so a
 * person can only ever see rows bound to them.
 */
export async function listMyAnnouncements(
  admin: SupabaseClient,
  userId: string,
): Promise<RecipientProjection[]> {
  const { data, error } = await admin
    .from("bty_tracked_announcement_recipients")
    // The whitelist IS the privacy rule. Note what is absent: no preview, no metadata, no ids.
    .select(
      "announcement_id, response, responded_at, bty_tracked_announcements!inner(id, host_framing, owner_user_id, bty_action_captures!inner(source_url))",
    )
    .eq("user_id", userId)
    .eq("bty_tracked_announcements.status", "active")
    .order("created_at", { ascending: false })
    .returns<RecipientRow[]>();

  if (error) {
    console.error("[announcement] list failed", { code: error.code ?? "unknown" });
    return [];
  }

  return (data ?? []).map((r) =>
    projectForRecipient({
      announcementId: r.announcement_id,
      hostFraming: r.bty_tracked_announcements?.host_framing ?? "",
      // A Host display name is resolved separately when one exists; never an email.
      hostDisplay: null,
      sourceUrl: r.bty_tracked_announcements?.bty_action_captures?.source_url ?? null,
      response: r.response,
      respondedAt: r.responded_at,
    }),
  );
}

export type RespondResult =
  | { ok: true; response: AnnouncementResponse; alreadyResponded: boolean }
  | { ok: false; reason: "invalid_response" | "not_a_recipient" | "question_too_long" | "failed" };

/**
 * Record one response. WRITE-ONCE.
 *
 * Ownership is the pairing of announcement and the CALLER'S OWN id inside the RPC, so there is no
 * recipient id to guess and no user id to supply. A second submission returns the settled answer
 * and never overwrites the first — a person's recorded response is theirs, and a later tap must
 * not silently rewrite what they said.
 */
export async function respondToAnnouncement(
  admin: SupabaseClient,
  params: { announcementId: string; userId: string; response: unknown; questionText: unknown },
): Promise<RespondResult> {
  if (!isAnnouncementResponse(params.response)) return { ok: false, reason: "invalid_response" };
  const questionText = normalizeQuestionText(params.questionText, params.response);

  const { data, error } = await admin.rpc("bty_respond_to_announcement", {
    p_announcement_id: params.announcementId,
    p_user_id: params.userId,
    p_response: params.response,
    p_question_text: questionText,
  });
  if (error) {
    console.error("[announcement] respond failed", { code: error.code ?? "unknown" });
    return { ok: false, reason: "failed" };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { result?: string; response?: string }
    | null;
  const result = row?.result;
  if (result === "responded" || result === "already_responded") {
    const settled = isAnnouncementResponse(row?.response) ? row!.response! : params.response;
    return { ok: true, response: settled as AnnouncementResponse, alreadyResponded: result === "already_responded" };
  }
  if (result === "not_a_recipient") return { ok: false, reason: "not_a_recipient" };
  if (result === "question_too_long") return { ok: false, reason: "question_too_long" };
  return { ok: false, reason: "invalid_response" };
}

export type HostAnnouncement = {
  id: string;
  hostFraming: string;
  createdAt: string;
  funnel: AnnouncementFunnel;
  /** Only for the two buckets a Host can act on. Never anyone's private data. */
  questions: { display: string | null; questionText: string | null; respondedAt: string | null }[];
  needHelp: { display: string | null; respondedAt: string | null }[];
};

/**
 * The Host's own runs and their outcomes.
 *
 * Owner-scoped by `owner_user_id`. There is deliberately no aggregate, no percentage and no
 * "engagement" figure — five counts, and the two lists a Host can actually do something about.
 */
export async function listHostAnnouncements(
  admin: SupabaseClient,
  ownerUserId: string,
): Promise<HostAnnouncement[]> {
  const { data: runs, error } = await admin
    .from("bty_tracked_announcements")
    .select("id, host_framing, resolved_count, created_at")
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: false })
    .returns<{ id: string; host_framing: string; resolved_count: number; created_at: string }[]>();

  if (error || !runs?.length) {
    if (error) console.error("[announcement] host list failed", { code: error.code ?? "unknown" });
    return [];
  }

  const { data: recips } = await admin
    .from("bty_tracked_announcement_recipients")
    .select("announcement_id, user_id, response, responded_at, question_text")
    .in("announcement_id", runs.map((r) => r.id))
    .returns<
      {
        announcement_id: string;
        user_id: string | null;
        response: string | null;
        responded_at: string | null;
        question_text: string | null;
      }[]
    >();

  const byRun = new Map<string, typeof recips extends (infer T)[] | null ? T[] : never>();
  for (const r of recips ?? []) {
    const list = byRun.get(r.announcement_id);
    if (list) list.push(r);
    else byRun.set(r.announcement_id, [r]);
  }

  return runs.map((run) => {
    const rows = byRun.get(run.id) ?? [];
    const funnel = summariseAnnouncement(
      run.resolved_count,
      rows.map((r) => ({ boundUserId: r.user_id, response: isAnnouncementResponse(r.response) ? r.response : null })),
    );
    return {
      id: run.id,
      hostFraming: run.host_framing,
      createdAt: run.created_at,
      funnel,
      questions: rows
        .filter((r) => r.response === "QUESTION")
        .map((r) => ({ display: null, questionText: r.question_text, respondedAt: r.responded_at })),
      needHelp: rows
        .filter((r) => r.response === "HELP_NEEDED")
        .map((r) => ({ display: null, respondedAt: r.responded_at })),
    };
  });
}
