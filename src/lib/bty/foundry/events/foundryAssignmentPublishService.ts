/**
 * Publish-time assignment creation — Slice 3.1B-3C.
 *
 * When a Host publishes with participation mode ASSIGNED_OVERLAY, this module resolves the
 * canonical recipient set and atomically freezes the audience snapshot + assignment rows.
 *
 * Boundaries (all measured, all enforced server-side):
 *   * The client supplies ONLY the declared audience selection the Builder already supports
 *     (type + optional detail). Never member ids, user ids, organization, count, names, or
 *     the actor snapshot.
 *   * Organization is derived inside the RPC from the actor's own active primary membership,
 *     so a Host can only ever assign within their own organization.
 *   * The whole snapshot+assignments+audit+mode write is ONE function transaction inside
 *     bty_foundry_publish_assignments. If it throws, NOTHING persists and the caller
 *     compensates the event it created.
 *   * ASSIGNED_OVERLAY is an OVERLAY: it never blocks anonymous joining. It records a
 *     required-learning recipient set alongside the normal link-based room.
 *   * Assignment is not participation — no participant row is created here.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ParticipationMode = "open_link" | "assigned_overlay";

export type AssignedAudience = {
  audienceType: "everyone" | "leaders" | "job_group" | "specific_role";
  audienceDetail: string | null;
};

export type PreflightResult =
  | { ok: true; eligibleCount: number; organizationId: string }
  | { ok: false; reason: AssignmentPublishFailReason };

export type AssignmentPublishFailReason =
  | "unsupported_audience"
  | "audience_detail_required"
  | "actor_organization_unresolved"
  | "zero_recipients"
  | "not_a_host"
  | "assignment_write_failed";

function mapRpcError(message: string): AssignmentPublishFailReason {
  if (/unsupported_audience/.test(message)) return "unsupported_audience";
  if (/audience_detail_required/.test(message)) return "audience_detail_required";
  if (/actor_organization_unresolved/.test(message)) return "actor_organization_unresolved";
  if (/zero_recipients/.test(message)) return "zero_recipients";
  if (/not_a_host/.test(message)) return "not_a_host";
  return "assignment_write_failed";
}

/**
 * READ-ONLY pre-flight. Resolves the eligible recipient set for the actor's own
 * organization WITHOUT creating anything. The publish flow calls this BEFORE creating the
 * event, so a zero-recipient assigned publish creates no event at all — and never silently
 * falls back to Everyone.
 */
export async function preflightAssignedAudience(
  admin: SupabaseClient,
  actorUserId: string,
  audience: AssignedAudience,
): Promise<PreflightResult> {
  const { data, error } = await admin.rpc("bty_foundry_resolve_audience", {
    p_actor_user_id: actorUserId,
    p_audience_type: audience.audienceType,
    p_audience_detail: audience.audienceDetail,
  });

  if (error) return { ok: false, reason: mapRpcError(error.message ?? "") };

  const rows = (data ?? []) as Array<{ organization_id: string }>;
  if (rows.length === 0) {
    // Distinguish "no eligible members" from an error: the RPC succeeded, the set is empty.
    return { ok: false, reason: "zero_recipients" };
  }
  return { ok: true, eligibleCount: rows.length, organizationId: rows[0].organization_id };
}

/**
 * ATOMIC assignment write for an already-created event. Delegates the entire
 * snapshot+resolve+assign+audit+mode transaction to the SECURITY DEFINER RPC. Idempotent:
 * a second call for the same event returns the existing count and writes nothing.
 */
export async function publishAssignmentsForEvent(
  admin: SupabaseClient,
  eventId: string,
  actorUserId: string,
  audience: AssignedAudience,
): Promise<{ ok: true; assignmentCount: number } | { ok: false; reason: AssignmentPublishFailReason }> {
  const { data, error } = await admin.rpc("bty_foundry_publish_assignments", {
    p_event_id: eventId,
    p_actor_user_id: actorUserId,
    p_audience_type: audience.audienceType,
    p_audience_detail: audience.audienceDetail,
  });

  if (error) return { ok: false, reason: mapRpcError(error.message ?? "") };

  const row = (Array.isArray(data) ? data[0] : data) as { assignment_count: number } | undefined;
  if (!row) return { ok: false, reason: "assignment_write_failed" };
  return { ok: true, assignmentCount: row.assignment_count };
}

export type CommittedParticipation = {
  mode: ParticipationMode;
  assignmentCount: number;
  audienceType: string | null;
};

/**
 * AUTHORITATIVE post-publish read. Reports what actually COMMITTED for an event — read back
 * from the participation-mode + audience-snapshot rows, NOT from the pre-publish preview and
 * NOT from the write call's return value. An event with no mode row is open_link with zero
 * assignments (the default), which is exactly what a compensated/failed assigned publish
 * leaves behind. This is the single source of truth the confirmation UI must use.
 */
export async function readCommittedParticipation(
  admin: SupabaseClient,
  eventId: string,
): Promise<CommittedParticipation> {
  const { data: modeRow } = await admin
    .from("foundry_event_participation_mode")
    .select("mode")
    .eq("event_id", eventId)
    .maybeSingle<{ mode: ParticipationMode }>();

  if (!modeRow || modeRow.mode !== "assigned_overlay") {
    return { mode: "open_link", assignmentCount: 0, audienceType: null };
  }

  const { data: snap } = await admin
    .from("foundry_event_audience_snapshot")
    .select("audience_type, resolved_count")
    .eq("event_id", eventId)
    .maybeSingle<{ audience_type: string; resolved_count: number }>();

  return {
    mode: "assigned_overlay",
    assignmentCount: snap?.resolved_count ?? 0,
    audienceType: snap?.audience_type ?? null,
  };
}
