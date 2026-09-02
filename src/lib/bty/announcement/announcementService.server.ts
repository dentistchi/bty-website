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
import { resolveDisplayNames } from "./recipientDisplayName.server";

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
  /**
   * The captured message, shown back to the person who captured it.
   *
   * Safe HERE and nowhere else: this projection is owner-scoped, so the only reader is the Host
   * who selected this message in Teams in the first place. The RECIPIENT projection above still
   * refuses it — a person selected into an audience has not been granted the source.
   */
  previewText: string | null;
  sourceUrl: string | null;
  status: "active" | "closed";
  funnel: AnnouncementFunnel;
  /**
   * WHO is in each bucket — the thing that turns a count into a follow-up.
   *
   * BOUND RECIPIENTS ONLY. A person who has never opened BTY has no canonical user and therefore
   * no name BTY is entitled to invent; they are represented solely by `funnel.notYetActivated`.
   * The People Picker submits object ids and nothing else (measured: `parsePickedRecipients` drops
   * every non-GUID), so there is no name to fall back on and none is guessed.
   *
   * `display` is null when a bound person's provider name could not be read. They still appear —
   * a nameless recipient is still someone the Host has to follow up with.
   */
  responders: {
    acknowledged: { display: string | null }[];
    question: { display: string | null; questionText: string | null; respondedAt: string | null }[];
    needHelp: { display: string | null; respondedAt: string | null }[];
    noResponse: { display: string | null }[];
  };
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
    // Note what is still absent even for the owner: tenant_id and conversation_id. A Host does not
    // need the wire identifiers to read their own run, and not selecting them is why no future
    // change can leak an unbound recipient's directory identity through this surface.
    .select("id, host_framing, resolved_count, created_at, status, bty_action_captures!inner(preview_text, source_url)")
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: false })
    .returns<
      {
        id: string;
        host_framing: string;
        resolved_count: number;
        created_at: string;
        status: string;
        bty_action_captures: { preview_text: string | null; source_url: string | null } | null;
      }[]
    >();

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

  const byRun = new Map<string, NonNullable<typeof recips>>();
  for (const r of recips ?? []) {
    const list = byRun.get(r.announcement_id);
    if (list) list.push(r);
    else byRun.set(r.announcement_id, [r]);
  }

  // One lookup per distinct BOUND person across every run. Unbound rows have no user id and are
  // never asked about, so an unactivated recipient cannot be resolved to anything by accident.
  const names = await resolveDisplayNames(
    admin,
    (recips ?? []).map((r) => r.user_id).filter((id): id is string => typeof id === "string" && id.length > 0),
  );
  const nameOf = (id: string | null) => (id ? (names.get(id) ?? null) : null);

  return runs.map((run) => {
    const rows = byRun.get(run.id) ?? [];
    const funnel = summariseAnnouncement(
      run.resolved_count,
      rows.map((r) => ({ boundUserId: r.user_id, response: isAnnouncementResponse(r.response) ? r.response : null })),
    );
    // Every named bucket is filtered on `user_id` FIRST: an unbound row can never reach one.
    const bound = rows.filter((r) => typeof r.user_id === "string" && r.user_id.length > 0);
    return {
      id: run.id,
      hostFraming: run.host_framing,
      createdAt: run.created_at,
      previewText: run.bty_action_captures?.preview_text ?? null,
      sourceUrl: run.bty_action_captures?.source_url ?? null,
      status: run.status === "closed" ? ("closed" as const) : ("active" as const),
      funnel,
      responders: {
        acknowledged: bound
          .filter((r) => r.response === "ACKNOWLEDGED")
          .map((r) => ({ display: nameOf(r.user_id) })),
        question: bound
          .filter((r) => r.response === "QUESTION")
          .map((r) => ({ display: nameOf(r.user_id), questionText: r.question_text, respondedAt: r.responded_at })),
        needHelp: bound
          .filter((r) => r.response === "HELP_NEEDED")
          .map((r) => ({ display: nameOf(r.user_id), respondedAt: r.responded_at })),
        noResponse: bound
          .filter((r) => !isAnnouncementResponse(r.response))
          .map((r) => ({ display: nameOf(r.user_id) })),
      },
    };
  });
}
