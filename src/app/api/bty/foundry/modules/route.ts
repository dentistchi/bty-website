import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { createDraft, listOwnerDrafts } from "@/lib/bty/foundry/events/foundryModuleService";
import { toClientDraft, toClientSummary } from "@/lib/bty/foundry/events/moduleClient";

export const runtime = "nodejs";

/**
 * Guided Module Builder — draft collection (manager-gated).
 *
 * POST /api/bty/foundry/modules — create ONE empty draft (status 'draft', step 1).
 *   Body may be empty. Repeated-tap duplication is prevented client-side (in-flight
 *   guard); the server simply creates a row. Returns 201 { draft } (client shape).
 * GET  /api/bty/foundry/modules — list the caller's own drafts (newest-touched
 *   first). Returns { drafts } summaries (no owner id, no answers, no asset value).
 *   The builder UI focuses on status='draft'; approved/published are not resumable.
 *
 * No approve/publish here — those are a later slice. Ownership + mutability rules
 * live in foundryModuleService; this handler only gates, delegates, and serializes.
 */
export async function POST(req: NextRequest) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const result = await createDraft(admin, user.id);
  if (!result.ok) return managerJson(base, req, { error: result.reason }, 400);
  return managerJson(base, req, { draft: toClientDraft(result.value) }, 201);
}

export async function GET(req: NextRequest) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const summaries = await listOwnerDrafts(admin, user.id);
  return managerJson(base, req, { drafts: summaries.map(toClientSummary) });
}
