import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { getOwnerDraft } from "@/lib/bty/foundry/events/foundryModuleService";
import { listDraftAssets } from "@/lib/bty/foundry/events/draftAssetService";
import { generateProgram, evidenceCeilingFor } from "@/lib/bty/foundry/events/programAuthorshipService";
import { currentSourceIdentity } from "@/lib/bty/foundry/arena/sourceIdentity";
import { readResumeEligibility, resolveProgramGenerationAuthority } from "@/lib/bty/foundry/events/programGenerationRecorder";
import {
  programContext,
  programContextFingerprint,
  requiredProgramKinds,
} from "@/domain/foundry/module/program-authorship";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";
import { isGenerationUuid } from "@/domain/foundry/module/program-generation-lease";

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

/**
 * GET …/program-draft?attempt=<id> — MAY THIS PROPOSAL STILL BE OFFERED? (R11.4K-R1)
 *
 * Eligibility only. It returns no proposal, no section, no sentence — the browser already
 * holds the words it is asking about; what it cannot know is whether the attempt behind
 * them is still adoptable. Manager-gated and owner-scoped, so another Host's attempt is
 * indistinguishable from one that never existed.
 *
 * Read-only: no provider call, no attempt, no draft write.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { id } = await ctx.params;
  const attemptId = new URL(req.url).searchParams.get("attempt") ?? "";
  if (!isGenerationUuid(attemptId)) {
    return managerJson(base, req, { eligible: false, reason: "attempt_not_found" }, 200);
  }

  const draft = await getOwnerDraft(admin, user.id, id);
  if (!draft) return managerJson(base, req, { eligible: false, reason: "attempt_not_found" }, 200);
  if (draft.status !== "draft") {
    return managerJson(base, req, { eligible: false, reason: "attempt_not_successful" }, 200);
  }

  const answers = (draft.answers ?? {}) as BuilderAnswers;
  const programCtx = programContext(answers);
  if (!programCtx) return managerJson(base, req, { eligible: false, reason: "context_moved" }, 200);

  const verdict = await readResumeEligibility(admin, {
    attemptId,
    draftId: id,
    ownerUserId: user.id,
    currentFingerprint: programContextFingerprint(programCtx),
  });

  return managerJson(
    base,
    req,
    verdict.ok ? { eligible: true } : { eligible: false, reason: verdict.reason },
    200,
  );
}

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
  // ONE shape, shared with the generation service (Slice 3.2P-W1-R1). Two regexes were how
  // the route and the service came to disagree about what a usable identifier is.
  if (!isGenerationUuid(submissionIntentId)) {
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

  // No SECOND generation while one is already running on this draft (Slice 3.2L-R1.3).
  // The unique submission-intent index is the final authority, but refusing here means a
  // duplicate gesture never reaches the provider at all — the spend is what matters.
  // Fails CLOSED: if authority cannot be established, no provider call is made.
  const authority = await resolveProgramGenerationAuthority(admin, id);
  if (authority.state === "active") {
    return managerJson(base, req, { error: "program_generation_in_progress" }, 409);
  }
  if (authority.state === "unavailable") {
    return managerJson(base, req, { error: "program_generation_state_unavailable" }, 503);
  }

  // The deploy identity is read from the environment and nowhere else — a client that
  // could name the build could forge the provenance of every attempt recorded under it.
  // A build that cannot name itself may not spend provider budget.
  const identity = currentSourceIdentity();
  if (!identity) return managerJson(base, req, { error: "source_identity_unavailable" }, 503);

  // Only VERIFIED material identities may ground an artifact's existence. Uploaded file
  // titles qualify — the application stored them. The YouTube URL deliberately does not:
  // a link proves the material exists, never what is inside it (Slice 3.2L-R2).
  const assets = (await listDraftAssets(admin, user.id, id)) ?? [];
  const verifiedArtifacts = assets
    .map((a) => (a as { filename?: unknown }).filename)
    .filter((n): n is string => typeof n === "string" && n.trim().length > 0);

  const result = await generateProgram(admin, {
    draftId: id,
    ownerUserId: user.id,
    submissionIntentId,
    answers,
    ctx: programCtx,
    locale,
    deployVersion: identity.sourceCommitSha,
    correlationId: crypto.randomUUID(),
    verifiedArtifacts,
    // Re-read AFTER the provider returns. The draft may have been published, deleted or
    // edited while the call was in flight — measured live during the first controlled
    // window — and a proposal for a draft that moved is not a success.
    reloadDraftState: async () => {
      const fresh = await getOwnerDraft(admin, user.id, id);
      if (!fresh) return null;
      const freshCtx = programContext((fresh.answers ?? {}) as BuilderAnswers);
      return {
        draftId: fresh.id,
        ownerUserId: user.id,
        status: fresh.status,
        fingerprint: freshCtx ? programContextFingerprint(freshCtx) : "",
      };
    },
  });

  if (!result.ok) {
    const status =
      result.code === "duplicate_intent" || result.code === "stale_context"
        ? 409
        : result.code === "provider_unavailable"
          ? 503
          : 502;
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
