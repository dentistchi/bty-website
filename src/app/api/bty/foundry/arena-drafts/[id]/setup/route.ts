import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import {
  readGenerationGovernance,
  saveDraftGuidedAnswers,
  toClientArenaDraft,
} from "@/lib/bty/foundry/arena/foundryArenaDraftService";

export const runtime = "nodejs";

/**
 * Foundry Practice — the two editable GUIDED SETUP ANSWERS (manager-gated, owner-scoped).
 *
 * R5C-4A1 measured that `hardestWhen` and `avoidancePressure` had no post-creation write path at
 * all, and R5C-4A2 then made two same-input refusals tell the Host to review their setup. A Host
 * could therefore be told to change something the product gave them no way to change. This route
 * is that way.
 *
 * PUT is guarded by BOTH revisions — the optimistic token against another tab, the semantic epoch
 * against a screen describing an input that has since moved. A semantic no-op writes nothing, so
 * re-saving identical answers can never be used to reset retry governance.
 */

function statusForReason(reason: string): number {
  if (reason === "arena_draft_not_found") return 404;
  if (reason === "guided_answers_invalid") return 422;
  // Both revisions are optimistic-concurrency conflicts with the current state of the resource.
  if (reason === "stale_revision" || reason === "generation_input_revision_stale") return 409;
  return 400;
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const rawLocale = body?.locale;
  if (rawLocale !== undefined && rawLocale !== null && rawLocale !== "" && rawLocale !== "en" && rawLocale !== "ko") {
    return managerJson(base, req, { error: "generation_locale_invalid", code: "generation_locale_invalid" }, 400);
  }
  const locale = rawLocale === "ko" ? "ko" : "en";

  const result = await saveDraftGuidedAnswers(
    admin,
    user.id,
    id,
    body?.guided,
    typeof body?.expectedRevision === "number" ? body.expectedRevision : null,
    typeof body?.expectedGenerationInputRevision === "number" ? body.expectedGenerationInputRevision : null,
  );

  if (!result.ok) {
    return managerJson(
      base,
      req,
      {
        error: result.reason,
        code: result.reason,
        // Bounded field codes only — never a message built from the submitted value.
        ...(result.errors ? { fields: result.errors } : {}),
      },
      statusForReason(result.reason),
    );
  }

  // Governance is re-read from the SERVER after the write, so the screen can never keep showing a
  // state that the save has just invalidated.
  const governance = await readGenerationGovernance(admin, user.id, id, locale);
  return managerJson(base, req, {
    draft: toClientArenaDraft(result.value.row),
    // Says whether this save actually created a new input epoch. A no-op is a success, not a change.
    changed: result.value.changed,
    ...(governance ? { governance } : {}),
  });
}
