import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureActionCapture } from "@/lib/bty/action-capture/ensureActionCapture.server";
import type { TeamsCaptureInput } from "@/domain/action-capture/captureSource";
import {
  normalizeHostFraming,
  parsePickedRecipients,
} from "@/domain/announcement/trackedAnnouncement";

/**
 * Track with BTY — the atomic write. Slice A1. SERVER ONLY.
 *
 * THE ORDER IS THE AUTHORITY, and every input is server-derived:
 *
 *   verified Teams identity → Host user id      (never from the body)
 *   the invoke's own messagePayload → capture    (never re-uploaded by a client)
 *   the dialog's two fields → framing + oids     (the ONLY client-supplied values)
 *
 * The client cannot supply a user id, an owner, an organization, an email, a tenant or a
 * conversation. Those come from the token and the invoke.
 *
 * SOURCE EVIDENCE IS REUSED, NOT COPIED. `ensureActionCapture` is called exactly as Save to BTY
 * calls it, so a message that was already saved yields the SAME capture row by its existing
 * `UNIQUE(user_id, source_type, external_key)` key. Tracking does not change the capture's status,
 * does not promote it, and does not create an Action Contract — the capture stays what it is, and
 * the announcement merely points at it.
 *
 * ALL-OR-NOTHING. The announcement and every recipient row are written by ONE SECURITY DEFINER
 * function transaction. A run with a partial audience would publish a denominator that was never
 * true, so if any part fails, nothing exists.
 */

export type TrackResult =
  | { ok: true; announcementId: string; count: number; alreadyExisted: boolean }
  | {
      ok: false;
      reason:
        | "invalid_framing"
        | "zero_recipients"
        | "capture_failed"
        | "track_failed";
    };

const TRACK_RPC = "bty_track_announcement";

export async function trackAnnouncement(
  admin: SupabaseClient,
  params: {
    /** Server-derived from the verified Teams token. */
    ownerUserId: string;
    /** The invoke's own message payload — the same input Save to BTY uses. */
    capture: TeamsCaptureInput;
    /** The Host's own words, from the dialog. */
    hostFramingRaw: unknown;
    /** The People Picker's submitted value, still raw. */
    pickedRaw: unknown;
    /**
     * Bot Framework routing base for this invoke, or null when it was not
     * observed. Slice A0.1. ALREADY RESOLVED by the caller from the VERIFIED
     * activity — this layer does not re-read the body, so there is no second
     * place where an unverified value could enter.
     *
     * Null is ordinary, not an error: a Track whose coordinate was never
     * observed is still a completely valid Track, and refusing it would trade a
     * working product loop for one that does not exist yet.
     */
    serviceUrl?: string | null;
  },
): Promise<TrackResult> {
  const hostFraming = normalizeHostFraming(params.hostFramingRaw);
  if (!hostFraming) return { ok: false, reason: "invalid_framing" };

  // Canonicalized ONCE, in the domain: lowercased, de-duplicated, GUIDs only.
  const oids = parsePickedRecipients(params.pickedRaw);
  if (oids.length < 1) return { ok: false, reason: "zero_recipients" };

  /*
    The capture is ensured BEFORE the announcement, because the announcement FKs to it. Idempotent
    by construction — a message already saved returns its existing row untouched.

    ★ `intent: "track_source"` is what stops Track from meaning "and save it too". The row is
    source evidence; it carries no `saved_at`, so the Saved for later lane does not list it. A
    message the person ALREADY saved keeps the `saved_at` it has — this never clears one — and if
    they save it later, that Save stamps this same row rather than creating a second.
  */
  const captured = await ensureActionCapture(admin, {
    userId: params.ownerUserId,
    input: params.capture,
    intent: "track_source",
  });
  if (!captured.ok) {
    console.error("[track-announcement] capture failed", { code: captured.code });
    return { ok: false, reason: "capture_failed" };
  }

  const { data, error } = await admin.rpc(TRACK_RPC, {
    p_owner_user_id: params.ownerUserId,
    p_source_capture_id: captured.capture.id,
    p_host_framing: hostFraming,
    p_tenant_id: params.capture.tenant_id,
    p_conversation_id: params.capture.conversation_id,
    p_recipient_oids: oids,
    // Stored on creation only. The function deliberately does NOT re-point an
    // existing run, so a repeat Track cannot move a coordinate that may already
    // have been used.
    p_service_url: params.serviceUrl ?? null,
  });

  if (error) {
    // The function's own refusals are stable strings; anything else is ours.
    const msg = error.message ?? "";
    if (/zero_recipients/.test(msg)) return { ok: false, reason: "zero_recipients" };
    if (/invalid_framing/.test(msg)) return { ok: false, reason: "invalid_framing" };
    console.error("[track-announcement] rpc failed", { code: error.code ?? "unknown" });
    return { ok: false, reason: "track_failed" };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { announcement_id?: string; resolved_count?: number; already_existed?: boolean }
    | null;
  if (!row?.announcement_id || typeof row.resolved_count !== "number") {
    console.error("[track-announcement] rpc returned no run");
    return { ok: false, reason: "track_failed" };
  }

  return {
    ok: true,
    announcementId: row.announcement_id,
    count: row.resolved_count,
    alreadyExisted: row.already_existed === true,
  };
}

/**
 * Attach a canonical BTY user to any recipient rows frozen for their Microsoft identity.
 *
 * Called on canonical entry, and it is a no-op for almost every request. It NEVER creates a user:
 * a recipient row is not permission to make an account, and first-time users go through the
 * existing Microsoft-first OAuth path. Idempotent — an already-bound row is never re-pointed,
 * because that would move somebody's response to a different person.
 */
export async function bindAnnouncementRecipients(
  admin: SupabaseClient,
  userId: string,
  tenantId: string,
  aadObjectId: string,
): Promise<number> {
  const { data, error } = await admin.rpc("bty_bind_announcement_recipients", {
    p_user_id: userId,
    p_tenant_id: tenantId,
    p_aad_object_id: aadObjectId,
  });
  if (error) {
    // Binding is best-effort on an auth path: failing it must never block sign-in.
    console.error("[track-announcement] bind failed", { code: error.code ?? "unknown" });
    return 0;
  }
  const row = (Array.isArray(data) ? data[0] : data) as { bound?: number } | null;
  return typeof row?.bound === "number" ? row.bound : 0;
}

/**
 * Bind this canonical user's frozen recipient rows, deriving their Microsoft identity server-side.
 *
 * THE SAME RULE AS `bindAnnouncementRecipients`, ON THE OTHER ROAD IN. That function is called by
 * the Teams tab bootstrap, which already holds a verified Entra token and can pass the tuple. The
 * ordinary Microsoft sign-in on the web — which is where the Teams notification's "Open BTY" link
 * actually sends people — has no such token by the time a Supabase session exists, only a user id.
 * So the tuple is read from `auth.identities` inside the database instead.
 *
 * It creates nothing, re-points nothing, and returns only a count. Best-effort by construction: a
 * failed binding must never be able to hide the list it was about to make visible.
 */
export async function bindAnnouncementRecipientsForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data, error } = await admin.rpc("bty_bind_announcement_recipients_for_user", {
    p_user_id: userId,
  });
  if (error) {
    console.error("[track-announcement] bind for user failed", { code: error.code ?? "unknown" });
    return 0;
  }
  const row = (Array.isArray(data) ? data[0] : data) as { bound?: number } | null;
  return typeof row?.bound === "number" ? row.bound : 0;
}
