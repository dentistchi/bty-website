import type { SupabaseClient } from "@supabase/supabase-js";
import { type TrackingMode } from "@/domain/announcement/trackingEvidence";
import { resolveTeamsCaptureSource, type TeamsCaptureInput } from "@/domain/action-capture/captureSource";
import { normalizeHostFraming } from "@/domain/announcement/trackedAnnouncement";
import { resolveBtyUserFromMicrosoftIdentity } from "@/lib/bty/identity-link/microsoftIdentityLink.server";
import { graphConfigFromEnv, getGraphAppToken, probeRecipientEligibility } from "@/lib/bty/microsoft/graphDirectory.server";

export type TrackResult =
  | { ok: true; announcementId: string; count: number; alreadyExisted: boolean }
  | { ok: false; reason: "invalid_framing" | "invalid_tracking_mode" | "invalid_actor" | "invalid_recipients" | "recipient_check_unavailable" | "zero_recipients" | "capture_failed" | "track_failed" };

/** Server only. Actor/tenant come from the authenticated Teams invoke.
 * The RPC verifies the entire audience before any write. A selected coworker who has
 * never signed in requires positive, same-tenant Microsoft directory verification.
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
  const request = {
    p_owner_user_id: params.ownerUserId,
    p_actor_oid: params.actorAadObjectId ?? null,
    p_source: { ...metadata, capture_reason: "track_source", preview_text: source.previewText, source_url: source.sourceUrl },
    p_host_framing: hostFraming,
    p_recipient_oids: oids,
    p_tracking_mode: params.trackingMode,
    p_service_url: params.serviceUrl ?? null,
  };
  let { data, error } = await admin.rpc("bty_track_announcement_v1", request);
  if (/invalid_recipients/.test(error?.message ?? "")) {
    const tenantId = params.capture.tenant_id.trim().toLowerCase();
    const unlinked: string[] = [];
    // Teams only waits five seconds for the complete invoke. Leave time for
    // the original lookup, the final write, and the response.
    const deadline = AbortSignal.timeout(2000);
    const expired = new Promise<null>(resolve => {
      deadline.addEventListener("abort", () => resolve(null), { once: true });
    });
    // The normal linked path has already failed before any write. Only a real
    // NOT_LINKED result qualifies for the directory check.
    for (let start = 0; start < oids.length; start += 5) {
      const batch = oids.slice(start, start + 5);
      const identities = await Promise.race([
        Promise.all(batch.map(oid => resolveBtyUserFromMicrosoftIdentity(admin, tenantId, oid))),
        expired,
      ]);
      if (!identities) return { ok: false, reason: "recipient_check_unavailable" };
      for (const [index, identity] of identities.entries()) {
        if (identity.status === "NOT_LINKED") unlinked.push(batch[index]!);
        else if (identity.status === "LOOKUP_FAILED") return { ok: false, reason: "recipient_check_unavailable" };
        else if (identity.status !== "RESOLVED") return { ok: false, reason: "invalid_recipients" };
      }
    }
    if (unlinked.length) {
      const config = graphConfigFromEnv();
      if (!config || config.tenantId !== tenantId) return { ok: false, reason: "recipient_check_unavailable" };
      const token = await getGraphAppToken(config, deadline);
      if (!token) return { ok: false, reason: "recipient_check_unavailable" };
      for (let start = 0; start < unlinked.length; start += 5) {
        const batch = unlinked.slice(start, start + 5);
        const results = await Promise.all(batch.map(oid => probeRecipientEligibility(token, oid, deadline)));
        for (const result of results) {
          if (!result.ok && (result.reason === "http_error" || result.reason === "network")) {
            return { ok: false, reason: "recipient_check_unavailable" };
          }
          if (!result.ok || !result.eligible) return { ok: false, reason: "invalid_recipients" };
        }
      }
      if (deadline.aborted) return { ok: false, reason: "recipient_check_unavailable" };
      // The SQL writer re-resolves current BTY identity and verifies the proof
      // IDs are among the selected recipients before creating any rows.
      ({ data, error } = await admin.rpc("bty_track_announcement_v2", {
        ...request,
        p_preverified_unlinked_oids: unlinked,
      }));
    }
  }
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
