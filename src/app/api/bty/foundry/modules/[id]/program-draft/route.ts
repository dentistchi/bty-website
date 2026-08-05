import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { getOwnerDraft } from "@/lib/bty/foundry/events/foundryModuleService";
import { generateProgram, evidenceCeilingFor } from "@/lib/bty/foundry/events/programAuthorshipService";
import { currentSourceIdentity } from "@/lib/bty/foundry/arena/sourceIdentity";
import {
  programContext,
  programContextFingerprint,
  requiredProgramKinds,
} from "@/domain/foundry/module/program-authorship";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

export const runtime = "nodejs";

/**
 * Guided Program Authorship — generate one whole program (manager-gated, owner-scoped).
 *
 * SERVER-AUTHORITATIVE. The draft is reloaded from the database and the authorship
 * context is rebuilt from it; the client's Builder answers are never trusted, and the
 * client cannot widen what the program is authored from.
 *
 * Generation NEVER mutates the draft. The proposal is returned to the Host for
 * section-by-section review and reaches the database only through the separate apply
 * path, and only if the Host applies it. No event, session, QR, assignment, approval or
 * publication is touched here.
 *
 * A submission intent is REQUIRED: one explicit Host instruction buys one generation,
 * enforced by a unique index, so a re-delivered request cannot spend twice.
 */

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    locale?: unknown;
    submission_intent_id?: unknown;
    context_fingerprint?: unknown;
  };

  const locale = body.locale === "ko" ? "ko" : "en";
  const submissionIntentId = typeof body.submission_intent_id === "string" ? body.submission_intent_id : "";
  if (!/^[0-9a-f-]{36}$/i.test(submissionIntentId)) {
    return managerJson(base, req, { error: "submission_intent_required" }, 400);
  }

  const draft = await getOwnerDraft(admin, user.id, id);
  if (!draft) return managerJson(base, req, { error: "not_found" }, 404);
  if (draft.status !== "draft") return managerJson(base, req, { error: "draft_not_mutable" }, 409);

  const answers = (draft.answers ?? {}) as BuilderAnswers;
  const programCtx = programContext(answers);
  if (!programCtx) return managerJson(base, req, { error: "context_incomplete" }, 409);

  // Stale-context protection. The client echoes the fingerprint it was showing; if the
  // draft has moved since, refuse rather than author from something the Host is no
  // longer looking at.
  const fingerprint = programContextFingerprint(programCtx);
  if (typeof body.context_fingerprint === "string" && body.context_fingerprint !== fingerprint) {
    return managerJson(base, req, { error: "context_mismatch", context_fingerprint: fingerprint }, 409);
  }

  // The deploy identity is read from the environment and nowhere else — a client that
  // could name the build could forge the provenance of every attempt recorded under it.
  // A build that cannot name itself may not spend provider budget.
  const identity = currentSourceIdentity();
  if (!identity) return managerJson(base, req, { error: "source_identity_unavailable" }, 503);

  const result = await generateProgram(admin, {
    draftId: id,
    ownerUserId: user.id,
    submissionIntentId,
    answers,
    ctx: programCtx,
    locale,
    deployVersion: identity.sourceCommitSha,
    correlationId: crypto.randomUUID(),
  });

  if (!result.ok) {
    const status = result.code === "duplicate_intent" ? 409 : result.code === "provider_unavailable" ? 503 : 502;
    return managerJson(base, req, { error: result.code, refusal: result.refusal ?? null }, status);
  }

  return managerJson(base, req, {
    program: result.value.proposal,
    version: result.value.version,
    attempt_id: result.attemptId,
    context_fingerprint: result.contextFingerprint,
    required_kinds: requiredProgramKinds(answers),
    evidence_ceiling: evidenceCeilingFor(programCtx),
  });
}
