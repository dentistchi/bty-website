import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { createOrResumeRevision } from "@/lib/bty/foundry/events/foundryRevisionService";

export const runtime = "nodejs";

/**
 * POST /api/bty/foundry/events/[eventId]/revisions — Guided Program "Create new
 * version" (Slice 3.2C-B1). The Host supplies ONLY the published event id; the
 * server resolves the source draft, authorizes ownership, and creates OR resumes
 * exactly one new draft version in the SAME Program (parent_module_id lineage,
 * inherited program_id, prior answers prefilled). No event/snapshot is created
 * here — publish stays the existing Builder flow.
 *
 * Behind requireManager (401 unauthenticated, 403 foundry_host_required). Errors
 * are calm and non-enumerating: not_owner / not_guided_program / source_not_found
 * → 404 (non-disclosing); newer_version_exists → 409 (+ latestVersionDraftId to
 * navigate); source_not_published / program_lineage_missing / revision_unavailable
 * → 400. Success → 201 { ok, draftId, programId, moduleVersion, resumed }.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { eventId } = await ctx.params;
  const result = await createOrResumeRevision(admin, user.id, eventId);

  if (!result.ok) {
    const nonDisclosing = result.reason === "not_owner" || result.reason === "not_guided_program" || result.reason === "source_not_found";
    const status = nonDisclosing ? 404 : result.reason === "newer_version_exists" ? 409 : 400;
    return managerJson(
      base,
      req,
      {
        error: result.reason,
        ...(result.latestVersionDraftId ? { latestVersionDraftId: result.latestVersionDraftId } : {}),
      },
      status,
    );
  }

  return managerJson(
    base,
    req,
    {
      ok: true,
      draftId: result.draftId,
      programId: result.programId,
      moduleVersion: result.moduleVersion,
      resumed: result.resumed,
    },
    201,
  );
}
