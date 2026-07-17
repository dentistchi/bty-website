import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { resolveArenaSource } from "@/lib/bty/foundry/arena/arenaScenarioSource";

export const runtime = "nodejs";

/**
 * Foundry Guided Arena Builder — source-module summary (manager-gated, owner-scoped).
 *
 * GET — the compact, read-only source summary the guided flow prefills from: plain
 *       product language (capability / for whom / expected behavior / training
 *       title), the arena-recommended flag, and the guided-question suggestion KEYS
 *       (the client localizes labels). 404 non-disclosing if the event is
 *       missing/not owned; 409 if it has no published module. No internal ids or
 *       architecture terms are exposed.
 *
 * NOTE: this lives at a TOP-LEVEL static path (not under arena-drafts/[id]) so the
 * opennextjs-cloudflare runtime never shadows it behind a dynamic sibling.
 */

function statusForReason(reason: string): number {
  if (reason === "source_not_found" || reason === "source_not_owned") return 404;
  if (reason === "source_no_module") return 409;
  return 400;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { eventId } = await ctx.params;
  const result = await resolveArenaSource(admin, user.id, eventId);
  if (!result.ok) return managerJson(base, req, { error: result.reason }, statusForReason(result.reason));

  const s = result.value;
  // Plain-language summary only — the client renders labels; no internal ids.
  return managerJson(base, req, {
    source: {
      event_id: s.eventId,
      event_title: s.eventTitle,
      event_status: s.eventStatus,
      module_version: s.moduleVersion,
      arena_recommended: s.arenaRecommended,
      capability: s.facts.problem,
      expected_behavior: s.facts.observableBehavior,
      success_evidence: s.facts.successEvidence,
      audience_type: s.facts.audienceType,
      audience_detail: s.facts.audienceDetail,
      learning_needs: s.facts.learningNeeds,
      hardest_when_options: s.hardestWhenOptions,
      avoidance_seeds: s.avoidanceSeeds,
    },
  });
}
