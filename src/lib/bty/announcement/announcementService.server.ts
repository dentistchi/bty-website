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
import { recipientNeedsHostAttention } from "@/domain/announcement/announcementThread";
import { loadThreadMeta, messageCountFrom, unreadFrom } from "./announcementThread.server";
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
  id: string;
  announcement_id: string;
  response: string | null;
  responded_at: string | null;
  recipient_last_read_at: string | null;
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
      "id, announcement_id, response, responded_at, recipient_last_read_at, bty_tracked_announcements!inner(id, host_framing, owner_user_id, bty_action_captures!inner(source_url))",
    )
    .eq("user_id", userId)
    .eq("bty_tracked_announcements.status", "active")
    .order("created_at", { ascending: false })
    .returns<RecipientRow[]>();

  if (error) {
    console.error("[announcement] list failed", { code: error.code ?? "unknown" });
    return [];
  }

  const rows = data ?? [];

  /*
    ★ ONLY THIS PERSON'S OWN THREADS ARE EVEN ASKED ABOUT.

    `rows` is already scoped by `user_id` = the caller, so the id set handed to `loadThreadMeta`
    can only ever contain their own recipient rows — there is no path here that could name another
    recipient of the same announcement. And the metadata query carries no bodies: it selects
    `recipient_id, author_role, created_at`, which is everything a badge needs and nothing a leak
    could use.
  */
  const meta = await loadThreadMeta(admin, rows.map((r) => r.id));

  /*
    THE HOST'S NAME, FROM THE PROVIDER, BECAUSE A CONVERSATION HAS TWO NAMED SIDES.

    A reply that reads only "message" is a message from nobody. The source is
    `auth.identities.identity_data` — provider-written and not editable by the account holder — and
    it is never the email. A Host whose name cannot be resolved stays null and the surface says
    "Host" rather than inventing one.
  */
  const hostNames = await resolveDisplayNames(
    admin,
    rows.map((r) => r.bty_tracked_announcements?.owner_user_id ?? "").filter(Boolean),
  );

  return rows.map((r) =>
    projectForRecipient({
      announcementId: r.announcement_id,
      recipientId: r.id,
      hostFraming: r.bty_tracked_announcements?.host_framing ?? "",
      hostDisplay: hostNames.get(r.bty_tracked_announcements?.owner_user_id ?? "") ?? null,
      sourceUrl: r.bty_tracked_announcements?.bty_action_captures?.source_url ?? null,
      response: r.response,
      respondedAt: r.responded_at,
      // Unread here means HOST messages this person has not opened. Their own never count.
      unreadCount: unreadFrom(meta, r.id, "RECIPIENT", r.recipient_last_read_at),
      messageCount: messageCountFrom(meta, r.id),
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
    acknowledged: HostResponder[];
    question: HostResponder[];
    needHelp: HostResponder[];
    noResponse: HostResponder[];
  };
};

/**
 * One named person in one bucket, plus what the Host can still do about them.
 *
 * `recipientId` is the handle the Handled control needs. It is an internal row id, not an
 * identity: it says nothing about who the person is, and ownership is re-verified in the database
 * on every write, so possessing one grants nothing.
 */
export type HostResponder = {
  recipientId: string;
  display: string | null;
  questionText: string | null;
  respondedAt: string | null;
  /** Set only when the OWNING Host settled it. ACKNOWLEDGED is already an ending and never sets it. */
  handledAt: string | null;
  /** Messages from THIS person that the Host has not opened. A Host's own replies never count. */
  unreadCount: number;
  /** Whether a conversation exists with this person at all. */
  messageCount: number;
  /**
   * ★ THE HANDLED / REOPEN ANSWER, COMPUTED IN THE DOMAIN AND NOT HERE.
   *
   * True when the original request is still open (the existing, unchanged rule) OR when this
   * person has said something new that the Host has not read. `handled_at` is never cleared to
   * achieve this — settling a request stays a permanent record, it just stops being the last word.
   * See `recipientNeedsHostAttention`.
   */
  needsAttention: boolean;
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
    .select("id, announcement_id, user_id, response, responded_at, question_text, handled_at, host_last_read_at")
    .in("announcement_id", runs.map((r) => r.id))
    .returns<
      {
        id: string;
        announcement_id: string;
        user_id: string | null;
        response: string | null;
        responded_at: string | null;
        question_text: string | null;
        handled_at: string | null;
        host_last_read_at: string | null;
      }[]
    >();

  /*
    ★ EVERY RECIPIENT ROW HERE ALREADY BELONGS TO THIS OWNER.

    `recips` was fetched with `.in("announcement_id", runs.map(...))` and `runs` is owner-scoped, so
    the id set below cannot contain a row from someone else's announcement. Bodies are still never
    loaded — this is `recipient_id, author_role, created_at` only, because a list needs counts and
    a Host reads the actual words one person at a time, in that person's own conversation.
  */
  const threadMeta = await loadThreadMeta(admin, (recips ?? []).map((r) => r.id));

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
  const toResponder = (r: {
    id: string;
    user_id: string | null;
    response: string | null;
    question_text: string | null;
    responded_at: string | null;
    handled_at: string | null;
    host_last_read_at: string | null;
  }): HostResponder => {
    const unreadCount = unreadFrom(threadMeta, r.id, "HOST", r.host_last_read_at);
    return {
      recipientId: r.id,
      display: nameOf(r.user_id),
      questionText: r.question_text,
      respondedAt: r.responded_at,
      handledAt: r.handled_at,
      unreadCount,
      messageCount: messageCountFrom(threadMeta, r.id),
      needsAttention: recipientNeedsHostAttention({
        response: r.response,
        handledAt: r.handled_at,
        unreadForHost: unreadCount,
      }),
    };
  };

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
        acknowledged: bound.filter((r) => r.response === "ACKNOWLEDGED").map(toResponder),
        question: bound.filter((r) => r.response === "QUESTION").map(toResponder),
        needHelp: bound.filter((r) => r.response === "HELP_NEEDED").map(toResponder),
        noResponse: bound.filter((r) => !isAnnouncementResponse(r.response)).map(toResponder),
      },
    };
  });
}

export type HandleResult =
  | { ok: true; handled: boolean }
  | { ok: false; reason: "not_found" | "not_handleable" | "failed" };

/**
 * Mark one person's follow-up handled, or re-open it.
 *
 * ★ OWNERSHIP IS NOT CHECKED HERE. It is checked inside
 * `bty_handle_announcement_recipient`, which joins the recipient to its announcement and requires
 * the actor to be `owner_user_id`. Doing it in SQL is what makes a direct client call, another
 * Host, and the recipient themselves all fail identically — and `not_found` is returned for a
 * wrong owner deliberately, so nobody can probe for a run they do not own.
 *
 * The actor id is the caller's own session user. There is no recipient owner to supply and no
 * announcement id to pass, so a crafted body has nothing to aim at.
 */
export async function handleRecipientFollowUp(
  admin: SupabaseClient,
  params: { recipientId: string; actorUserId: string; handled: boolean },
): Promise<HandleResult> {
  const { data, error } = await admin.rpc("bty_handle_announcement_recipient", {
    p_recipient_id: params.recipientId,
    p_actor_user_id: params.actorUserId,
    p_handled: params.handled,
  });
  if (error) {
    console.error("[announcement] handle failed", { code: error.code ?? "unknown" });
    return { ok: false, reason: "failed" };
  }
  const row = (Array.isArray(data) ? data[0] : data) as { result?: string } | null;
  if (row?.result === "handled") return { ok: true, handled: true };
  if (row?.result === "reopened") return { ok: true, handled: false };
  if (row?.result === "not_handleable") return { ok: false, reason: "not_handleable" };
  return { ok: false, reason: "not_found" };
}
