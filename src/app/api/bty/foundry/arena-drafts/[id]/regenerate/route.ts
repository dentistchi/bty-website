import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { regenerateArenaDraft, toClientArenaDraft } from "@/lib/bty/foundry/arena/foundryArenaDraftService";
import { PRACTICE_SAMPLING } from "@/lib/bty/foundry/arena/arenaScenarioGenerationService";
import { isUpstreamFailure, retriabilityOf, type GenerationProductCode } from "@/domain/foundry/arena-draft/generationOutcome";

export const runtime = "nodejs";

/**
 * Foundry Guided Arena Builder — regenerate one draft (manager-gated, owner-scoped).
 *
 * POST — re-run generation from the SAME stored guided answers + the same bound
 *        source version (the host's re-roll; their answers are never lost and
 *        the source is never re-pointed). 404 non-disclosing if not owned/missing;
 *        409 if the source module was since retired. Returns the fresh { draft }.
 *
 * R5A — the response now carries a STABLE product code, whether a second attempt is reasonable,
 * and a privacy-safe support reference. 3.2K-R4 measured the cost of the previous contract: every
 * provider failure answered 400 with one undifferentiated reason, so the client could only ever
 * say one thing, and the Host was invited to retry a failure whose transience was unknown.
 *
 * What may cross this boundary: a code, a retriability classification, a derived support
 * reference, and the deadline the Host was waiting against. What may not: provider prose, stack
 * traces, prompts, or any database identifier.
 */

/**
 * HTTP semantics that say WHOSE failure it was. Collapsing an upstream outage into 400 tells the
 * client its own request was invalid — both untrue and unactionable.
 */
function statusForReason(reason: string, outcome?: GenerationProductCode): number {
  if (reason === "arena_draft_not_found" || reason === "source_not_found" || reason === "source_not_owned") return 404;
  if (reason === "source_no_module") return 409;
  // The application could not create its durable attempt record, so it declined to start.
  if (reason === "generation_observability_unavailable") return 503;
  if (outcome) {
    if (outcome === "provider_timeout") return 504; // an upstream deadline, not a bad request
    if (isUpstreamFailure(outcome)) return 502; // the provider, or the path to it, failed
    if (outcome === "scenario_persistence_failed" || outcome === "internal_failure") return 500;
    return 422; // our own gates refused this content
  }
  if (reason === "stale_revision") return 409;
  // Setup/eligibility reasons: the request genuinely is not in a state that can generate.
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
  if (!result.ok) {
    const code = (result.outcome ?? result.reason) as GenerationProductCode;
    return managerJson(
      base,
      req,
      {
        error: result.reason,
        code,
        retriable: retriabilityOf(code),
        // Present only when an attempt row exists to look up. Derived — never the row id.
        ...(result.attemptRef ? { supportRef: result.attemptRef } : {}),
        // What the Host was waiting against, so the screen can be honest about the wait.
        deadlineMs: PRACTICE_SAMPLING.generation.timeoutMs,
      },
      statusForReason(result.reason, result.outcome),
    );
  }
  return managerJson(base, req, { draft: toClientArenaDraft(result.value.row), warnings: result.value.warnings });
}
