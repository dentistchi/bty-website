import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import {
  getOwnerArenaDraft,
  readGenerationGovernance,
  saveArenaDraftEdits,
  toClientArenaDraft,
} from "@/lib/bty/foundry/arena/foundryArenaDraftService";

export const runtime = "nodejs";

/**
 * Foundry Guided Arena Builder — one Arena scenario draft (manager-gated, owner-scoped).
 *
 * GET   — read one draft (client shape). 404 non-disclosing if not owned/missing.
 * PATCH — save the host-edited scenario. The edited structure MUST pass the
 *         deterministic validator; an invalid edit is refused (422 invalid_structure
 *         + failing codes) and never silently saved. A DB failure surfaces as an
 *         error, never a fake success. Returns the fresh { draft, warnings }.
 *
 * A foreign owner's draft is indistinguishable from a missing one (both 404).
 */

function statusForReason(reason: string): number {
  if (reason === "arena_draft_not_found") return 404;
  if (reason === "invalid_structure") return 422;
  return 400;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { id } = await ctx.params;
  const draft = await getOwnerArenaDraft(admin, user.id, id);
  if (!draft) return managerJson(base, req, { error: "not_found" }, 404);

  /**
   * R5C-4B — governance travels with the READ.
   *
   * Before this, `revision_required` was reachable only as a 409 on the generate POST, so a Host
   * had to attempt a generation to be told they must not start one. The locale is normalized here
   * exactly as the generate route normalizes it; an unsupported value is refused rather than
   * silently becoming English.
   */
  const rawLocale = req.nextUrl.searchParams.get("locale");
  if (rawLocale !== null && rawLocale !== "" && rawLocale !== "en" && rawLocale !== "ko") {
    return managerJson(base, req, { error: "generation_locale_invalid", code: "generation_locale_invalid" }, 400);
  }
  const locale = rawLocale === "ko" ? "ko" : "en";
  const governance = await readGenerationGovernance(admin, user.id, id, locale);

  return managerJson(base, req, {
    draft: toClientArenaDraft(draft),
    // Absent rather than guessed when the read fails: a fabricated `ready` would invite exactly the
    // spending this arc exists to prevent.
    ...(governance ? { governance } : {}),
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const result = await saveArenaDraftEdits(admin, user.id, id, body?.scenario_draft);
  if (!result.ok) {
    return managerJson(
      base,
      req,
      { error: result.reason, ...(result.errors ? { fields: result.errors } : {}) },
      statusForReason(result.reason),
    );
  }
  return managerJson(base, req, { draft: toClientArenaDraft(result.value.row), warnings: result.value.warnings });
}
