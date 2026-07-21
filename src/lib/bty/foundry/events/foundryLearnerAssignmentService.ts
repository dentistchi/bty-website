/**
 * Learner assignment READ path — Slice 3.1B-3E.
 *
 * A logged-in learner reads THEIR OWN Foundry required-learning assignments so the
 * installed app can surface them without the learner already holding the Room link.
 *
 * Boundaries (all enforced server-side, mirrored from the 3.1B-3D claim path):
 *   * Identity is SERVER-DERIVED: the route passes auth.getUser().id as authUserId.
 *     The client never supplies a user id — matching is by the immutable publish-time
 *     user_id_snapshot inside the SECURITY DEFINER RPC only.
 *   * The RPC returns only the caller's own assignments (assigned | completed) for
 *     assigned_overlay events. Revoked rows and open-link rooms never appear.
 *   * No other recipient, membership, audience count, reflection, response body, or
 *     audit actor is read. The only per-row extras are the event title (the learner's
 *     own required event) and the join_version needed to mint the learner's Room token.
 *   * This layer only orchestrates RPC + token crypto; it computes no business rules.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { mintJoinToken } from "./foundryEventService";

export type LearnerAssignmentStatus = "assigned" | "completed";

/**
 * Service-shaped learner assignment. `joinToken` is the freshly minted Room
 * capability; the API route composes the absolute `roomUrl` from it + request
 * origin (mirroring attachJoinUrl), so origin handling stays a request concern.
 */
export type LearnerAssignment = {
  assignmentId: string;
  eventId: string;
  status: LearnerAssignmentStatus;
  title: string;
  assignedAt: string;
  completedAt: string | null;
  joinToken: string;
  participationMode: "assigned_overlay";
};

type AssignmentRow = {
  assignment_id: string;
  event_id: string;
  status: string;
  title: string;
  assigned_at: string;
  completed_at: string | null;
  join_version: number;
  participation_mode: string;
};

/**
 * List the authenticated caller's OWN required-learning assignments via the atomic
 * RPC. Fail-soft: any RPC error yields an empty list (a read failure must never leak
 * an error surface into the calm learner view — the app renders the intentional empty
 * state instead). A row is emitted only for the honest states assigned | completed.
 */
export async function listMyAssignments(
  admin: SupabaseClient,
  authUserId: string,
): Promise<LearnerAssignment[]> {
  const { data, error } = await admin.rpc("bty_foundry_list_my_assignments", {
    p_auth_user_id: authUserId,
  });
  if (error || !data) return [];

  const rows = (Array.isArray(data) ? data : []) as AssignmentRow[];
  return rows
    .filter((r) => r.status === "assigned" || r.status === "completed")
    .map((r) => ({
      assignmentId: r.assignment_id,
      eventId: r.event_id,
      status: r.status as LearnerAssignmentStatus,
      title: r.title,
      assignedAt: r.assigned_at,
      completedAt: r.completed_at,
      // Mint the learner's OWN current Room capability from the event id + version.
      // Opening it later loads the link-based Room; it creates no participant and
      // awards no XP by itself (join + claim remain separate, explicit actions).
      joinToken: mintJoinToken({ id: r.event_id, join_version: r.join_version }),
      participationMode: "assigned_overlay",
    }));
}
