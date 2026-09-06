import type { SupabaseClient } from "@supabase/supabase-js";
import {
  countUnreadFor,
  isThreadRole,
  normalizeClientMessageKey,
  normalizeThreadMessage,
  type ThreadMessage,
  type ThreadRole,
} from "@/domain/announcement/announcementThread";
import { resolveDisplayNames } from "./recipientDisplayName.server";

/**
 * Track — the continuing Host ↔ Recipient conversation. SERVER ONLY.
 *
 * ★ AUTHORITY IS ASKED OF THE DATABASE, ONCE, AND NOTHING HERE RE-DERIVES IT.
 *
 * Every function below establishes who the caller is by calling
 * `bty_resolve_announcement_thread_role`, which joins the recipient row to its announcement owner.
 * There is no ownership comparison in this file, no `owner_user_id` read into TypeScript, and no
 * branch that decides a role from anything a request carried. A non-party is answered `none` — the
 * same answer as a recipient id that names nothing — so a uuid cannot be used to discover that a
 * conversation exists.
 *
 * ★ ISOLATION IS THE FOREIGN KEY, NOT A FILTER.
 *
 * Messages are selected by `recipient_id` alone, and that column IS the private two-party thread.
 * There is no query in this file that reads more than one recipient's bodies, and no announcement
 * id anywhere in the message table to accidentally widen one.
 */

type MessageRow = {
  id: string;
  /** NULL once that account is deleted -- the message and its role survive. */
  author_user_id: string | null;
  author_role: string;
  body: string;
  created_at: string;
};

/** Message METADATA only — never a body. Used to count unread across a whole list surface. */
export type ThreadMeta = {
  messageId: string;
  recipientId: string;
  authorRole: ThreadRole;
  /** Needed by the Today dismissal rule to ask "has anything happened since this was removed?". */
  createdAt: string;
};

export type ThreadRoleResult = ThreadRole | null;

/** HOST, RECIPIENT, or null for everyone else. Null is also what a missing row returns. */
export async function resolveThreadRole(
  admin: SupabaseClient,
  recipientId: string,
  actorUserId: string,
): Promise<ThreadRoleResult> {
  const { data, error } = await admin.rpc("bty_resolve_announcement_thread_role", {
    p_recipient_id: recipientId,
    p_actor_user_id: actorUserId,
  });
  if (error) {
    console.error("[announcement-thread] role resolve failed", { code: error.code ?? "unknown" });
    return null;
  }
  const row = (Array.isArray(data) ? data[0] : data) as { role?: string } | null;
  return isThreadRole(row?.role) ? (row!.role as ThreadRole) : null;
}

export type ReadThreadResult =
  | { ok: true; role: ThreadRole; messages: ThreadMessage[] }
  | { ok: false; reason: "not_found" | "failed" };

/**
 * Read one private conversation, oldest first, and mark the CALLER'S OWN side read.
 *
 * ★ MARKING READ IS PART OF OPENING IT, NOT A SECOND FEATURE. The person has the messages in
 * front of them by the time this returns; leaving the cursor where it was would report them as
 * unseen on the next screen.
 *
 * ★ WHICH SIDE MOVES IS NOT THIS FUNCTION'S DECISION. `bty_mark_announcement_thread_read` takes no
 * side parameter and resolves the role for itself, so a Host cannot mark a recipient read and a
 * recipient cannot mark a Host read — not through this path and not through any other.
 *
 * A read-cursor write that fails does NOT fail the read. The conversation is the thing the person
 * asked for; the worst outcome of an unmoved cursor is a count that is one high until they open it
 * again, and refusing to show them the messages would be a far larger fault than that.
 */
export async function readThread(
  admin: SupabaseClient,
  params: { recipientId: string; actorUserId: string },
): Promise<ReadThreadResult> {
  const role = await resolveThreadRole(admin, params.recipientId, params.actorUserId);
  if (!role) return { ok: false, reason: "not_found" };

  const { data, error } = await admin
    .from("bty_announcement_thread_messages")
    .select("id, author_user_id, author_role, body, created_at")
    .eq("recipient_id", params.recipientId)
    // (created_at, id) is a TOTAL order. `created_at` alone is not: the first-response bridge
    // deliberately stamps the disposition and its first message with one instant, so ties are
    // ordinary here and a partial order can come back arranged differently on two reads.
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .returns<MessageRow[]>();

  if (error) {
    console.error("[announcement-thread] read failed", { code: error.code ?? "unknown" });
    return { ok: false, reason: "failed" };
  }

  const rows = data ?? [];
  const names = await resolveDisplayNames(
    admin,
    // A deleted account contributes no id to look up, and renders with no name.
    rows.map((m) => m.author_user_id).filter((id): id is string => typeof id === "string" && id.length > 0),
  );

  const messages: ThreadMessage[] = rows
    // A row whose role is not one of the two known values is not rendered rather than guessed at.
    // The CHECK constraint makes this unreachable; a renderer that had to invent an author would be
    // worse than a message that is briefly absent.
    .filter((m) => isThreadRole(m.author_role))
    .map((m) => ({
      id: m.id,
      authorRole: m.author_role as ThreadRole,
      authorDisplay: m.author_user_id ? (names.get(m.author_user_id) ?? null) : null,
      body: m.body,
      createdAt: m.created_at,
    }));

  const { error: readErr } = await admin.rpc("bty_mark_announcement_thread_read", {
    p_recipient_id: params.recipientId,
    p_actor_user_id: params.actorUserId,
  });
  if (readErr) {
    console.error("[announcement-thread] mark read failed", { code: readErr.code ?? "unknown" });
  }

  return { ok: true, role, messages };
}

export type PostMessageResult =
  | { ok: true; role: ThreadRole; messageId: string; duplicate: boolean; reopened: boolean }
  | { ok: false; reason: "not_found" | "empty_message" | "message_too_long" | "failed" };

/**
 * Append one message.
 *
 * The body is normalized here so an over-long or blank submission is refused before a round trip,
 * and normalized AGAIN inside the RPC — the client is not the boundary, and neither is this file.
 * `author_role` is never sent: the function derives it, and there is no parameter for it.
 */
export async function postThreadMessage(
  admin: SupabaseClient,
  params: { recipientId: string; actorUserId: string; body: unknown; clientMessageId?: unknown },
): Promise<PostMessageResult> {
  const raw = typeof params.body === "string" ? params.body : "";
  const body = normalizeThreadMessage(raw);
  if (!body) {
    return { ok: false, reason: raw.trim().length === 0 ? "empty_message" : "message_too_long" };
  }

  const { data, error } = await admin.rpc("bty_post_announcement_thread_message", {
    p_recipient_id: params.recipientId,
    p_actor_user_id: params.actorUserId,
    p_body: body,
    p_client_message_id: normalizeClientMessageKey(params.clientMessageId),
  });
  if (error) {
    console.error("[announcement-thread] post failed", { code: error.code ?? "unknown" });
    return { ok: false, reason: "failed" };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { result?: string; message_id?: string; author_role?: string; reopened?: boolean }
    | null;
  const result = row?.result;

  if (result === "posted" || result === "duplicate") {
    if (!isThreadRole(row?.author_role) || !row?.message_id) return { ok: false, reason: "failed" };
    return {
      ok: true,
      role: row.author_role as ThreadRole,
      messageId: row.message_id,
      duplicate: result === "duplicate",
      // The DATABASE reports whether this message reopened a settled item. The clearing happens in
      // the same transaction as the insert, so this is an OUTCOME, never a second decision here.
      reopened: row.reopened === true,
    };
  }
  if (result === "not_found") return { ok: false, reason: "not_found" };
  if (result === "empty_message") return { ok: false, reason: "empty_message" };
  if (result === "message_too_long") return { ok: false, reason: "message_too_long" };
  return { ok: false, reason: "failed" };
}

/**
 * Message METADATA for a set of recipient rows, so a LIST surface can show unread counts.
 *
 * ★ NO BODIES CROSS THIS FUNCTION. The select list is `recipient_id, author_role, created_at` and
 * nothing else — a Tracking list needs to know that two things are unread, not what they said, and
 * a projection that never carries the text cannot leak it into a card that shows several people at
 * once.
 *
 * Returns an empty map on failure. An unread badge that fails to appear is a missing hint; a list
 * that fails to load because a badge could not be counted is a broken surface.
 */
export async function loadThreadMeta(
  admin: SupabaseClient,
  recipientIds: readonly string[],
): Promise<Map<string, ThreadMeta[]>> {
  const out = new Map<string, ThreadMeta[]>();
  const ids = [...new Set(recipientIds.filter(Boolean))];
  if (ids.length === 0) return out;

  const { data, error } = await admin
    .from("bty_announcement_thread_messages")
    .select("id, recipient_id, author_role, created_at")
    .in("recipient_id", ids)
    .returns<{ id: string; recipient_id: string; author_role: string; created_at: string }[]>();

  if (error) {
    console.error("[announcement-thread] meta failed", { code: error.code ?? "unknown" });
    return out;
  }

  for (const m of data ?? []) {
    if (!isThreadRole(m.author_role)) continue;
    const entry: ThreadMeta = {
      messageId: m.id,
      recipientId: m.recipient_id,
      authorRole: m.author_role as ThreadRole,
      createdAt: m.created_at,
    };
    const list = out.get(m.recipient_id);
    if (list) list.push(entry);
    else out.set(m.recipient_id, [entry]);
  }
  return out;
}

/**
 * Every message id THIS reader holds a receipt for, among the given messages.
 *
 * ★ SCOPED TO ONE READER, ALWAYS. `reader_user_id` is the caller's own session id, so this can
 * never answer "has somebody else read it" -- a question no surface in this product asks, and none
 * should be able to.
 *
 * An empty set on failure. A badge that under-reports is a missing hint; a list that fails to load
 * because a receipt lookup errored is a broken surface.
 */
export async function loadReadReceipts(
  admin: SupabaseClient,
  messageIds: readonly string[],
  readerUserId: string,
): Promise<Set<string>> {
  const out = new Set<string>();
  const ids = [...new Set(messageIds.filter(Boolean))];
  if (ids.length === 0 || !readerUserId) return out;

  const { data, error } = await admin
    .from("bty_announcement_thread_message_reads")
    .select("message_id")
    .eq("reader_user_id", readerUserId)
    .in("message_id", ids)
    .returns<{ message_id: string }[]>();

  if (error) {
    console.error("[announcement-thread] receipts failed", { code: error.code ?? "unknown" });
    return out;
  }
  for (const r of data ?? []) out.add(r.message_id);
  return out;
}

/** Every message id in the loaded metadata -- the input to `loadReadReceipts`. */
export function allMessageIds(meta: Map<string, ThreadMeta[]>): string[] {
  const out: string[] = [];
  for (const list of meta.values()) for (const m of list) out.push(m.messageId);
  return out;
}

/** Unread for one viewer on one thread, from already-loaded metadata. Pure counting lives in domain. */
export function unreadFrom(
  meta: Map<string, ThreadMeta[]>,
  recipientId: string,
  viewer: ThreadRole,
  readMessageIds: ReadonlySet<string>,
): number {
  return countUnreadFor(viewer, meta.get(recipientId) ?? [], readMessageIds);
}

/** How many messages this thread holds at all — what decides whether a conversation is shown. */
export function messageCountFrom(meta: Map<string, ThreadMeta[]>, recipientId: string): number {
  return (meta.get(recipientId) ?? []).length;
}

/*
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * ★ WHY NOTHING HERE SENDS A TEAMS MESSAGE — THE V1 DECISION, AND THE MEASUREMENT BEHIND IT.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * The obvious next move is to call the existing proactive notifier when a thread message lands. It
 * is refused in V1, and the reason is structural rather than a matter of taste.
 *
 * WHAT THE EXISTING ARCHITECTURE ACTUALLY IS. `notifyRecipient` implements AT-MOST-ONCE delivery
 * for ONE event, and it does it with three columns ON THE RECIPIENT ROW:
 *
 *     notified_at                     terminal. Once set, no lease may exist and nothing sends.
 *     notification_claim_token/expiry a lease one attempt owns.
 *     notification_send_started_at    the durable boundary between "reclaimable" and
 *                                     "a send began and its outcome is unknown, never retry".
 *
 * Those columns describe A SINGLE FACT: whether THIS PERSON has been told about THIS ANNOUNCEMENT.
 * A `notified_at` that is terminal is exactly right for that and exactly wrong for a conversation,
 * where the tenth reply must be as deliverable as the first. Reusing them would mean either
 * clearing a terminal marker — destroying the evidence that the first notification happened — or
 * sending once and never again. Both are worse than not sending.
 *
 * SO OPTION B WOULD BE A PER-MESSAGE LEDGER, and it is not small. Each message row would need its
 * own claim token, expiry and send-started marker; a `delivery_unknown` state a person must resolve;
 * a route or trigger to drive it; the conversation-reference reuse and the SECOND claim that
 * serializes conversation CREATION on (tenant, aad); and a concurrency suite of its own, because the
 * only way that architecture was ever proven correct was by testing the race. That is a slice, not
 * a bolt-on — and getting it wrong sends somebody's manager a duplicate message, which is the one
 * failure this system has been most careful about.
 *
 * V1 THEREFORE SHIPS IN-APP CONVERSATION AND PERSISTENT UNREAD. Both parties can see what they have
 * not read, from any device, because the cursor is in the database rather than in a component.
 * Nothing in this file, in the thread route, or in the migration reads or writes ANY notification
 * column — so the proven at-most-once first notification is untouched and V1.1 inherits it intact.
 *
 * NOT ON THE TEAMS APP BAR EITHER. The badge on the BTY icon inside Teams belongs to the Teams
 * client; this application does not control it, and a count it cannot set is not a count it should
 * pretend to.
 */
