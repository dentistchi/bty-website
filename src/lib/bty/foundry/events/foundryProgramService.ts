import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A Program is the durable learning identity for Guided drafts and published
 * Quick or Guided runs. The service-role-only RPC derives its scope from the
 * actor's canonical membership or verified professional tenant binding. When
 * neither resolves an organization, the Program belongs to the actor's account.
 * Assignments, participants and completion remain on the published run.
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
 * With an existing ID, resolve the Program in the actor's organization or one
 * personally owned by the actor. With no ID, create a Program in the resolved
 * scope. The title is a display value. A successful call always returns an ID.
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
  // Both organization and account scopes require a durable Program ID.
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
 * - `lineage` absent (Quick / direct create) → create a Program for the owner.
 *   The caller rejects a resolution error before creating the event.
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
