import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { regenerateArenaDraft, toClientArenaDraft } from "@/lib/bty/foundry/arena/foundryArenaDraftService";

export const runtime = "nodejs";

/**
 * Foundry Guided Arena Builder — regenerate one draft (manager-gated, owner-scoped).
 *
 * POST — re-run generation from the SAME stored guided answers + the same bound
 *        source version (the host's re-roll; their answers are never lost and
 *        the source is never re-pointed). 404 non-disclosing if not owned/missing;
 *        409 if the source module was since retired. Returns the fresh { draft }.
 */

function statusForReason(reason: string): number {
  if (reason === "arena_draft_not_found" || reason === "source_not_found" || reason === "source_not_owned") return 404;
  if (reason === "source_no_module") return 409;
  return 400;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const locale = body?.locale === "ko" ? "ko" : "en";

  const result = await regenerateArenaDraft(admin, user.id, id, locale);
  if (!result.ok) return managerJson(base, req, { error: result.reason }, statusForReason(result.reason));
  return managerJson(base, req, { draft: toClientArenaDraft(result.value.row), warnings: result.value.warnings });
}
