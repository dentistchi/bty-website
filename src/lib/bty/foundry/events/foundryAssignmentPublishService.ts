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

// ---------------------------------------------------------------------------
// Slice 3.1B-3D — authenticated assignment claim
// ---------------------------------------------------------------------------

/** Neutral, non-disclosing outcomes of an assignment claim. */
export type AssignmentClaimResult =
  | "claimed"
  | "already_claimed"
  | "claim_conflict"
  | "no_matching_assignment"
  // Ordinary open-link room (no assignment overlay) — assignments are not a concept
  // here, so the UI stays silent. Distinct from no_matching_assignment (wrong account
  // on an assigned event), which the UI surfaces neutrally.
  | "not_applicable";

/**
 * Claim the authenticated caller's OWN assignment for an event, via the atomic RPC.
 *
 * This runs AFTER the proven claim-xp engine and NEVER fails the XP claim — its result is
 * reported separately. The client supplies no targeting: `authUserId` comes from the server
 * session, `participantId` from the session-validated participant, `eventId` from the join
 * token. Match is by the immutable publish-time user_id_snapshot only.
 *
 * A missing match (wrong account / open-link event / no assignment) returns
 * `no_matching_assignment` — a neutral outcome, never an error and never a disclosure.
 */
export async function claimAssignmentForParticipant(
  admin: SupabaseClient,
  eventId: string,
  participantId: string,
  authUserId: string,
): Promise<AssignmentClaimResult> {
  /*
    THIS MUST NEVER THROW INTO THE COMPLETION PATH (Slice R4-R5B1).

    Since R4-R5B1 this helper is also called from the three `complete*Training` services, where a
    rejection would fail a TRUTHFUL training completion the learner has already earned. The
    `{ error }` branch below has always covered an RPC that ANSWERS with an error; it does not
    cover one that never answers — a transport failure, an abort, a client that rejects.

    Its two siblings in the same authenticated block already state this contract explicitly:
    `materializeFollowupObligation` ends `catch { return "error"; // materialization must NEVER
    throw into the completion/claim path }`, and `materializeApplyWindow` does the same. This
    brings the assignment claim to that same posture.

    Degrading to `not_applicable` is the function's OWN documented degradation for "any error",
    and it is the silent outcome — so a transport failure reports nothing to the participant and,
    critically, never falsely reports an assignment transition that did not happen. Nothing is
    written on this path, so silence is the truthful answer.
  */
  let data: unknown;
  let error: unknown;
  try {
    ({ data, error } = await admin.rpc("bty_foundry_claim_assignment", {
      p_event_id: eventId,
      p_participant_id: participantId,
      p_auth_user_id: authUserId,
    }));
  } catch {
    return "not_applicable";
  }
  // Assignment-claim failure must not disturb the canonical XP result: treat any error as
  // "no matching assignment" for the participant-facing outcome (nothing was written).
  // A claim failure must never disturb the canonical XP result; degrade to the SILENT
  // not_applicable so a transient error shows the participant nothing about assignments.
  if (error) return "not_applicable";
  const row = (Array.isArray(data) ? data[0] : data) as { result?: string } | undefined;
  const r = row?.result;
  if (
    r === "claimed" ||
    r === "already_claimed" ||
    r === "claim_conflict" ||
    r === "no_matching_assignment" ||
    r === "not_applicable"
  ) {
    return r;
  }
  return "not_applicable";
}

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
