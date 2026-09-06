import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hostActivityVersion,
  hostTodayAction,
  isTodayItemKind,
  recipientActivityVersion,
  recipientTodayAction,
  type TodayItemKind,
} from "@/domain/daily/todayDismissal";
import { countUnreadFor } from "@/domain/announcement/announcementThread";
import { recipientNeedsHostAttention } from "@/domain/announcement/announcementThread";

/**
 * "Remove this from my Today" — SERVER ONLY.
 *
 * ★ THIS FILE IS THE CROSS-USER BOUNDARY, AND THE SCHEMA IS NOT.
 *
 * A composite primary key separates rows; it does not authorize them — `service_role` can insert
 * any `user_id` it is given. What actually holds the boundary is here:
 *
 *   * `userId` is always the caller's own session id, passed down from the route. There is no
 *     parameter, body field or header anywhere on this path that can name a different person.
 *   * before any write, the named card is VERIFIED to belong to that user's own Today — a recipient
 *     row bound to them, or an announcement they own. Anything else is refused, and refused
 *     identically to a card that does not exist, so this cannot be used to probe for one.
 *
 * ★ NOTHING HERE TOUCHES WHAT IT HIDES. Rows are READ from the Track tables to establish ownership
 * and to count activity; nothing in this file writes to any of them.
 *
 * ★ REMOVABILITY IS RE-DECIDED HERE, FROM LIVE ROWS. The client's tray is guidance, not authority.
 * A projection can be seconds stale — a Host reply may have landed since the card was drawn — so a
 * dismissal is refused unless the card is settled ACCORDING TO THE DATABASE RIGHT NOW. Without
 * this, a stale screen could hide a card that had just become attention-worthy, which is the exact
 * failure the whole eligibility rule exists to prevent.
 */

export type DismissResult =
  | { ok: true; dismissedAt: string; activityVersion: number }
  | { ok: false; reason: "invalid_kind" | "not_found" | "not_removable" | "failed" };

/**
 * The card's CURRENT monotonic activity count, and whether it belongs to this person at all.
 *
 * Returns null when the card is not theirs OR does not exist — deliberately the same answer, so a
 * dismissal request cannot be used to discover somebody else's Track.
 */
type Owned = { version: number; removable: boolean };

async function ownedActivityVersion(
  admin: SupabaseClient,
  userId: string,
  itemKind: TodayItemKind,
  itemId: string,
): Promise<Owned | null> {
  if (itemKind === "track_recipient") {
    // OWNERSHIP: the recipient row must be BOUND to the caller.
    const { data: row, error } = await admin
      .from("bty_tracked_announcement_recipients")
      .select("id, response")
      .eq("id", itemId)
      .eq("user_id", userId)
      .maybeSingle<{ id: string; response: string | null }>();
    if (error) {
      console.error("[today-dismissal] recipient lookup failed", { code: error.code ?? "unknown" });
      return null;
    }
    if (!row) return null;

    const { data: msgs, error: mErr } = await admin
      .from("bty_announcement_thread_messages")
      .select("id, author_role")
      .eq("recipient_id", itemId)
      .returns<{ id: string; author_role: string }[]>();
    if (mErr) {
      console.error("[today-dismissal] recipient messages failed", { code: mErr.code ?? "unknown" });
      return null;
    }
    const all = (msgs ?? []).map((m) => ({ messageId: m.id, authorRole: m.author_role as "HOST" | "RECIPIENT" }));

    // The caller's OWN receipts — the same question the list surface asks.
    const ids = all.map((m) => m.messageId);
    let read = new Set<string>();
    if (ids.length > 0) {
      const { data: rd, error: rErr } = await admin
        .from("bty_announcement_thread_message_reads")
        .select("message_id")
        .eq("reader_user_id", userId)
        .in("message_id", ids)
        .returns<{ message_id: string }[]>();
      if (rErr) {
        console.error("[today-dismissal] recipient receipts failed", { code: rErr.code ?? "unknown" });
        return null;
      }
      read = new Set((rd ?? []).map((x) => x.message_id));
    }
    const unreadCount = countUnreadFor("RECIPIENT", all, read);
    return {
      version: recipientActivityVersion(all),
      removable: recipientTodayAction({ response: row.response, unreadCount }).removable,
    };
  }

  // OWNERSHIP: the announcement must be OWNED by the caller.
  const { data: run, error } = await admin
    .from("bty_tracked_announcements")
    .select("id")
    .eq("id", itemId)
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[today-dismissal] announcement lookup failed", { code: error.code ?? "unknown" });
    return null;
  }
  if (!run) return null;

  const { data: recips, error: rErr } = await admin
    .from("bty_tracked_announcement_recipients")
    .select("id, response, handled_at")
    .eq("announcement_id", itemId)
    .returns<{ id: string; response: string | null; handled_at: string | null }[]>();
  if (rErr) {
    console.error("[today-dismissal] run recipients failed", { code: rErr.code ?? "unknown" });
    return null;
  }
  const ids = (recips ?? []).map((r) => r.id);
  let msgs: { id: string; recipient_id: string; author_role: string }[] = [];
  if (ids.length > 0) {
    const { data, error: mErr } = await admin
      .from("bty_announcement_thread_messages")
      .select("id, recipient_id, author_role")
      .in("recipient_id", ids)
      .returns<{ id: string; recipient_id: string; author_role: string }[]>();
    if (mErr) {
      console.error("[today-dismissal] run messages failed", { code: mErr.code ?? "unknown" });
      return null;
    }
    msgs = data ?? [];
  }

  // The OWNER's own receipts, so "unread for the Host" means what it means everywhere else.
  let read = new Set<string>();
  if (msgs.length > 0) {
    const { data: rd, error: rErr } = await admin
      .from("bty_announcement_thread_message_reads")
      .select("message_id")
      .eq("reader_user_id", userId)
      .in("message_id", msgs.map((m) => m.id))
      .returns<{ message_id: string }[]>();
    if (rErr) {
      console.error("[today-dismissal] run receipts failed", { code: rErr.code ?? "unknown" });
      return null;
    }
    read = new Set((rd ?? []).map((x) => x.message_id));
  }

  /* `needsAttention` is re-derived from LIVE rows with the same domain rule the Host surface uses. */
  const responders = (recips ?? []).map((r) => {
    const mine = msgs
      .filter((m) => m.recipient_id === r.id)
      .map((m) => ({ messageId: m.id, authorRole: m.author_role as "HOST" | "RECIPIENT" }));
    const unreadCount = countUnreadFor("HOST", mine, read);
    return {
      unreadCount,
      needsAttention: recipientNeedsHostAttention({
        response: r.response,
        handledAt: r.handled_at,
        unreadForHost: unreadCount,
      }),
    };
  });

  return {
    version: hostActivityVersion(
      msgs.map((m) => ({ authorRole: m.author_role })),
      (recips ?? []).map((r) => r.response),
    ),
    removable: hostTodayAction({ responders }).removable,
  };
}

/**
 * Hide one card from this person's Today, at the activity version they could actually see.
 *
 * ★ UPDATE-THEN-INSERT, NOT UPSERT, AND THE GRANT IS WHY.
 *
 * `service_role` holds UPDATE on `(dismissed_at, dismissed_activity_version)` ONLY, so an existing
 * dismissal can never be re-pointed at another person or another Track. A PostgREST upsert issues
 * `ON CONFLICT DO UPDATE SET` across every column it was given — including `user_id` — and would be
 * refused by that column grant. Two explicit statements stay inside it.
 *
 * The insert races with itself only on a first-ever double tap; the unique violation is caught and
 * resolved by the update that must now succeed.
 */
export async function dismissTodayItem(
  admin: SupabaseClient,
  params: { userId: string; itemKind: unknown; itemId: unknown },
): Promise<DismissResult> {
  if (!isTodayItemKind(params.itemKind)) return { ok: false, reason: "invalid_kind" };
  const itemId = typeof params.itemId === "string" ? params.itemId.trim() : "";
  if (!itemId) return { ok: false, reason: "invalid_kind" };

  const owned = await ownedActivityVersion(admin, params.userId, params.itemKind, itemId);
  if (owned === null) return { ok: false, reason: "not_found" };
  /*
    ★ THE SERVER DECIDES, NOT THE SCREEN. The tray a person tapped may have been drawn before a
    Host reply landed. Refusing here is what stops a stale projection from hiding a card that has
    since become attention-worthy.
  */
  if (!owned.removable) return { ok: false, reason: "not_removable" };
  const version = owned.version;

  const dismissedAt = new Date().toISOString();
  const patch = { dismissed_at: dismissedAt, dismissed_activity_version: version };
  const key = { user_id: params.userId, item_kind: params.itemKind, item_id: itemId };

  const update = async () =>
    admin
      .from("bty_today_dismissals")
      .update(patch)
      .eq("user_id", key.user_id)
      .eq("item_kind", key.item_kind)
      .eq("item_id", key.item_id)
      .select("item_id");

  const first = await update();
  if (first.error) {
    console.error("[today-dismissal] update failed", { code: first.error.code ?? "unknown" });
    return { ok: false, reason: "failed" };
  }
  if ((first.data ?? []).length > 0) return { ok: true, dismissedAt, activityVersion: version };

  const ins = await admin.from("bty_today_dismissals").insert({ ...key, ...patch });
  if (!ins.error) return { ok: true, dismissedAt, activityVersion: version };

  // 23505: somebody inserted the same row between our update and our insert. The update now works.
  if (ins.error.code === "23505") {
    const retry = await update();
    if (!retry.error && (retry.data ?? []).length > 0) {
      return { ok: true, dismissedAt, activityVersion: version };
    }
  }
  console.error("[today-dismissal] insert failed", { code: ins.error.code ?? "unknown" });
  return { ok: false, reason: "failed" };
}

/**
 * What THIS person has hidden, of one kind: item id → the activity version they hid it at.
 *
 * Scoped by `user_id` in the query, so it can never answer about anybody else. An empty map on
 * failure: a lookup that fails must show MORE than it should, never less — a card wrongly visible
 * is noise, a card wrongly hidden is a message somebody never sees.
 */
export async function loadTodayDismissals(
  admin: SupabaseClient,
  userId: string,
  itemKind: TodayItemKind,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!userId) return out;
  const { data, error } = await admin
    .from("bty_today_dismissals")
    .select("item_id, dismissed_activity_version")
    .eq("user_id", userId)
    .eq("item_kind", itemKind)
    .returns<{ item_id: string; dismissed_activity_version: number }[]>();

  if (error) {
    console.error("[today-dismissal] load failed", { code: error.code ?? "unknown" });
    return out;
  }
  for (const r of data ?? []) out.set(r.item_id, Number(r.dismissed_activity_version));
  return out;
}
