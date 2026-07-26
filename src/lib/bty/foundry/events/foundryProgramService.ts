import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Foundry Program identity — service layer (Slice 3.2C, Minimal Program Root).
 *
 * A Program is the durable, organization-scoped learning IDENTITY that a draft/
 * version (Guided authoring) and a published run (Guided or Quick) belong to. It
 * owns identity ONLY — never assignments, participants, completion, QR, or XP
 * (those stay on the Program Run = foundry_events). See
 * docs/UNIFIED_PROGRAM_LIVE_EXPERIENCE_CONTRACT.md.
 *
 * All linkage is BEST-EFFORT and server-authoritative:
 *   - Org is DERIVED (inside the RPC) from the actor's active-primary
 *     bty_org_membership — the caller never supplies an org or a foreign
 *     program_id it did not receive from the server.
 *   - Foundry Host is a GLOBAL capability, so a Host may have no org membership.
 *     In that case resolveOrCreateProgramForActor returns null and the caller
 *     proceeds WITHOUT Program linkage (program_id stays NULL = "legacy
 *     unified-lineage not recorded"), exactly preserving today's create behavior.
 *
 * This service is a thin wrapper over the service-role-only SECURITY DEFINER RPC
 * bty_foundry_resolve_or_create_program; it never widens client access.
 */

/**
 * Resolve or create the Program identity for a create/publish action by `actorUserId`.
 *
 * - `existingProgramId` present  → resolve that Program (must exist AND be the
 *   actor's own org; a foreign-org id raises inside the RPC). Used so a Guided
 *   revision / publish inherits the SAME Program identity as its draft.
 * - `existingProgramId` absent   → create a new Program in the actor's org, using
 *   `title` for display identity only (never dedup/merge by title).
 *
 * Returns the resolved/created program_id, or `null` when the actor has no
 * resolvable organization (best-effort — caller links nothing). Throws only on a
 * genuine authorization violation (program_missing / cross_organization) or a DB
 * error, so a cross-org attempt fails closed rather than linking silently.
 */
export async function resolveOrCreateProgramForActor(
  admin: SupabaseClient,
  actorUserId: string,
  title: string,
  existingProgramId?: string | null,
): Promise<string | null> {
  const { data, error } = await admin.rpc("bty_foundry_resolve_or_create_program", {
    p_actor_user_id: actorUserId,
    p_title: title,
    p_program_id: existingProgramId ?? null,
  });
  if (error) throw new Error(`program_resolve_failed:${error.message}`);
  // RPC returns a single-row table { program_id } (program_id may be null).
  const row = Array.isArray(data) ? data[0] : data;
  const programId = (row as { program_id?: string | null } | null)?.program_id ?? null;
  return programId;
}

/** Lineage a run-create primitive may receive from a Guided publish. */
export type ProgramLineage = { programId: string | null };

/**
 * Resolve the program_id to stamp on a NEW Program Run (foundry_events).
 *
 * - `lineage` present (Guided publish) → use the draft's recorded Program identity
 *   EXACTLY, including `null` (a draft with no lineage yields an unlinked run).
 * - `lineage` absent (Quick / direct create) → best-effort resolve-or-create a
 *   fresh Program in the owner's org; a failure or no-org yields `null` and the
 *   run is created unlinked (today's behavior, never blocked).
 */
export async function programIdForNewRun(
  admin: SupabaseClient,
  ownerUserId: string,
  title: string,
  lineage?: ProgramLineage,
): Promise<string | null> {
  if (lineage) return lineage.programId;
  try {
    return await resolveOrCreateProgramForActor(admin, ownerUserId, title);
  } catch {
    return null; // best-effort: Program linkage must never block run creation
  }
}
