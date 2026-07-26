import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Foundry Program identity — service layer (Slice 3.2C, corrected 3.2C-R1).
 *
 * A Program is the durable, organization-scoped learning IDENTITY that a draft/
 * version (Guided authoring) and a published run (Guided or Quick) belong to. It
 * owns identity ONLY — never assignments, participants, completion, QR, or XP
 * (those stay on the Program Run = foundry_events). See
 * docs/UNIFIED_PROGRAM_LIVE_EXPERIENCE_CONTRACT.md.
 *
 * FAIL-CLOSED authorization (3.2C-R1): creating a NEW Program REQUIRES a
 * deterministically resolved canonical organization. Org is DERIVED (inside the
 * RPC) from the actor's active-primary bty_org_membership — never the legacy
 * `memberships` table, never a client value. If the actor has no active-primary
 * org the RPC raises `organization_unresolved`; more than one raises
 * `organization_ambiguous`; a supplied foreign/absent Program raises
 * `cross_organization` / `program_missing`. Foundry Host is a GLOBAL capability
 * and does NOT by itself authorize an org-owned Program. There is NO silent
 * NULL-linkage downgrade for a NEW Program — only HISTORICAL rows keep NULL.
 *
 * This service is a thin wrapper over the service-role-only SECURITY DEFINER RPC
 * bty_foundry_resolve_or_create_program; it never widens client access.
 */

const PROGRAM_REASONS = [
  "organization_unresolved",
  "organization_ambiguous",
  "cross_organization",
  "program_missing",
] as const;

/** Map an RPC/wrapper error to a stable, calm reason for the existing UI. */
export function programErrorReason(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return PROGRAM_REASONS.find((r) => msg.includes(r)) ?? "program_resolve_failed";
}

/**
 * Resolve or create the Program identity for a create/publish action by `actorUserId`.
 *
 * - `existingProgramId` present  → resolve that Program (must exist AND be the
 *   actor's own org; a foreign-org id raises). Used so a Guided revision / publish
 *   inherits the SAME Program identity as its draft.
 * - `existingProgramId` absent   → create a NEW Program in the actor's org, using
 *   `title` for display identity only (never dedup/merge by title).
 *
 * Returns a NON-NULL program_id on success. THROWS a stable-reason Error
 * (`organization_unresolved` / `organization_ambiguous` / `cross_organization` /
 * `program_missing` / `program_resolve_failed`) when the org cannot be resolved
 * or the supplied Program is foreign — so a caller ALWAYS fails closed and never
 * links (or silently unlinks) across an authorization boundary.
 */
export async function resolveOrCreateProgramForActor(
  admin: SupabaseClient,
  actorUserId: string,
  title: string,
  existingProgramId?: string | null,
): Promise<string> {
  const { data, error } = await admin.rpc("bty_foundry_resolve_or_create_program", {
    p_actor_user_id: actorUserId,
    p_title: title,
    p_program_id: existingProgramId ?? null,
  });
  if (error) throw new Error(programErrorReason(error.message ?? "program_resolve_failed"));
  const row = Array.isArray(data) ? data[0] : data;
  const programId = (row as { program_id?: string | null } | null)?.program_id ?? null;
  // The RPC fails closed (raises) on no/ambiguous org, so a null here is a
  // contract violation — treat it as unresolved rather than link silently.
  if (programId == null) throw new Error("organization_unresolved");
  return programId;
}

/** Lineage a run-create primitive may receive from a Guided publish. */
export type ProgramLineage = { programId: string | null };

/**
 * Resolve the program_id to stamp on a NEW Program Run (foundry_events).
 *
 * - `lineage` present (Guided publish) → use the draft's recorded Program identity
 *   EXACTLY, including `null` (a HISTORICAL draft with no lineage yields an
 *   unlinked run). Never throws — publishing a legacy draft must keep working.
 * - `lineage` absent (Quick / direct create) → resolve-or-create a Program in the
 *   owner's org and FAIL CLOSED (throw) if the org cannot be resolved. The caller
 *   must reject BEFORE creating the event — never a silent NULL run.
 */
export async function programIdForNewRun(
  admin: SupabaseClient,
  ownerUserId: string,
  title: string,
  lineage?: ProgramLineage,
): Promise<string | null> {
  if (lineage) return lineage.programId;
  return await resolveOrCreateProgramForActor(admin, ownerUserId, title);
}
