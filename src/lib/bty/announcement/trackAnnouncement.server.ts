import type { SupabaseClient } from "@supabase/supabase-js";
import { type TrackingMode } from "@/domain/announcement/trackingEvidence";
import { resolveTeamsCaptureSource, type TeamsCaptureInput } from "@/domain/action-capture/captureSource";
import { normalizeHostFraming } from "@/domain/announcement/trackedAnnouncement";

export type TrackResult =
  | { ok: true; announcementId: string; count: number; alreadyExisted: boolean }
  | { ok: false; reason: "invalid_framing" | "invalid_tracking_mode" | "invalid_actor" | "invalid_recipients" | "zero_recipients" | "capture_failed" | "track_failed" };

/** Server only. Actor/tenant come from the authenticated Teams invoke.
 * The RPC reuses the canonical Microsoft resolver and active organization membership,
 * rejects the entire audience before any write, then captures and freezes it atomically.
 * Save remains on its existing independent writer; track_source never stamps saved_at.
 */
export async function trackAnnouncement(admin: SupabaseClient, params: {
  ownerUserId: string;
  actorAadObjectId?: string;
  capture: TeamsCaptureInput;
  hostFramingRaw: unknown;
  pickedRaw: unknown;
  serviceUrl?: string | null;
  trackingMode?: TrackingMode;
}): Promise<TrackResult> {
  const hostFraming = normalizeHostFraming(params.hostFramingRaw);
  if (!hostFraming) return { ok: false, reason: "invalid_framing" };
  if (params.trackingMode !== "acknowledgment" && params.trackingMode !== "response")
    return { ok: false, reason: "invalid_tracking_mode" };
  const source = resolveTeamsCaptureSource(params.capture);
  if (!source.ok) return { ok: false, reason: "capture_failed" };
  const raw = typeof params.pickedRaw === "string" ? params.pickedRaw.split(",") : params.pickedRaw;
  if (!Array.isArray(raw)) return { ok: false, reason: "invalid_recipients" };
  if (!raw.length || (raw.length === 1 && raw[0] === "")) return { ok: false, reason: "zero_recipients" };
  // Never silently drop an invalid member of an otherwise valid audience.
  const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (raw.some(v => typeof v !== "string" || !guid.test(v.trim())))
    return { ok: false, reason: "invalid_recipients" };
  const oids = [...new Set(raw.map((v: string) => v.trim().toLowerCase()))];
  const { sender_display: _senderDisplay, ...metadata } = source.sourceMetadata;
  const { data, error } = await admin.rpc("bty_track_announcement_v1", {
    p_owner_user_id: params.ownerUserId,
    p_actor_oid: params.actorAadObjectId ?? null,
    p_source: { ...metadata, capture_reason: "track_source", preview_text: source.previewText, source_url: source.sourceUrl },
    p_host_framing: hostFraming,
    p_recipient_oids: oids,
    p_tracking_mode: params.trackingMode,
    p_service_url: params.serviceUrl ?? null,
  });
  if (error) {
    const msg = error.message ?? "";
    if (/zero_recipients/.test(msg)) return { ok: false, reason: "zero_recipients" };
    // The SENDER failing is not the audience failing: never blame the selected people for it.
    if (/invalid_actor/.test(msg)) return { ok: false, reason: "invalid_actor" };
    if (/invalid_recipients/.test(msg)) return { ok: false, reason: "invalid_recipients" };
    console.error("[track-announcement] rpc failed", { code: error.code ?? "unknown" });
    return { ok: false, reason: "track_failed" };
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    { announcement_id?: string; resolved_count?: number; already_existed?: boolean } | null;
  if (!row?.announcement_id || typeof row.resolved_count !== "number") return { ok: false, reason: "track_failed" };
  return { ok: true, announcementId: row.announcement_id, count: row.resolved_count, alreadyExisted: row.already_existed === true };
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
