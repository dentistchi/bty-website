import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import {
  getOwnerDraft,
  updateDraftStep,
  deleteDraft,
} from "@/lib/bty/foundry/events/foundryModuleService";
import { listDraftAssets } from "@/lib/bty/foundry/events/draftAssetService";
import {
  findActiveProgramGeneration,
  markProgramAttemptApplied,
  readAdoptionFacts,
  PROPOSAL_DIGEST_ENABLED,
} from "@/lib/bty/foundry/events/programGenerationRecorder";
import { journeyDigest } from "@/domain/foundry/module/proposal-digest";
import { decideAdoptionReceipt } from "@/domain/foundry/module/adoption-authority";
import { programContext, programContextFingerprint, requiredProgramKinds } from "@/domain/foundry/module/program-authorship";
import { toClientDraft } from "@/lib/bty/foundry/events/moduleClient";
import { validateDraftPatch, type BuilderAnswers } from "@/domain/foundry/module/module-builder";

export const runtime = "nodejs";

/**
 * Guided Module Builder — one draft (manager-gated, owner-scoped).
 *
 * GET    — read one draft (client shape). 404 non-disclosing if not owned/missing.
 * PATCH  — save validated answers + current_step. Field-level validation only
 *          (partial drafts save fine — NOT approval completeness). 400 on bad
 *          input, 404 non-disclosing if not owned/missing, 409 if the draft is
 *          approved/published (immutable). Returns the fresh { draft }.
 * DELETE — delete a draft-status draft only. 404 non-disclosing / 409 if immutable.
 *
 * A foreign owner's draft is indistinguishable from a missing one (both 404). The
 * server rejects mutation/deletion of approved/published drafts even if the client
 * is manipulated. No approve/publish/session/event side effects here.
 */

/** Map a service failure reason to an HTTP status without disclosing existence. */
function statusForReason(reason: string): number {
  if (reason === "draft_not_found") return 404;
  if (reason === "draft_not_mutable") return 409;
  return 400;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { id } = await ctx.params;
  const draft = await getOwnerDraft(admin, user.id, id);
  if (!draft) return managerJson(base, req, { error: "not_found" }, 404);
  const assets = (await listDraftAssets(admin, user.id, id)) ?? [];
  // Slice 3.2L-R1: a reload must reconcile SERVER state, not trust a stale browser
  // pending flag. If a generation is still running — including one started in another
  // tab — the Builder learns it here and keeps publication disabled.
  const active = await findActiveProgramGeneration(admin, id);
  return managerJson(base, req, {
    draft: { ...toClientDraft(draft), assets },
    program_generation_active: active !== null,
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const validated = validateDraftPatch({ answers: body?.answers, currentStep: body?.current_step });
  if (!validated.ok) return managerJson(base, req, { error: "invalid_fields", fields: validated.errors }, 400);

  const result = await updateDraftStep(admin, user.id, id, {
    answers: validated.value.answers,
    currentStep: validated.value.currentStep,
  });
  if (!result.ok) return managerJson(base, req, { error: result.reason }, statusForReason(result.reason));

  /**
   * ADOPTION RECEIPT, DERIVED FROM DURABLE STATE (Slice 3.2L-R11.1).
   *
   * R11 stamped `applied_at` from a transient request field and swallowed any failure. The
   * draft write and the attempt write are two separate statements with no transaction
   * around them, so that could acknowledge an Apply while the ledger still said the
   * proposal was never adopted — and nothing could say WHICH attempt to stamp afterwards,
   * because the journey records no attempt id.
   *
   * The receipt now follows the draft's own durable `programAdoptionV1` marker, written in
   * the SAME row update as the journey. So the two facts are recoverable from one another:
   * if the stamp fails, the marker survives and the very next save completes it. First
   * receipt wins, so re-offering it never moves the timestamp.
   *
   * This is exact, owner-scoped and retry-safe. It is NOT a transaction, and it is not
   * described as one: the honest guarantee is that adoption is never lost, not that both
   * writes land together.
   */
  /**
   * PROVE THE RECEIPT BELONGS TO WHAT WAS ACTUALLY ADOPTED (Slice 3.2L-R11.2).
   *
   * A UUID owned by the Host is not proof. This draft has five successful attempts sharing
   * one context fingerprint, so naming a v1 proposal from days ago while adopting the v9
   * journey would previously have been stamped without complaint.
   *
   * Everything checked here comes from columns that already exist, including the
   * fingerprint the attempts migration always meant to be enforced at this moment. A claim
   * that cannot be proved is simply not stamped: the Host's draft still saved, and the
   * durable marker keeps the fact recoverable.
   */
  const adoptedAttemptId = (result.value.answers as { programAdoptionV1?: { attemptId?: unknown } } | null)
    ?.programAdoptionV1?.attemptId;
  if (typeof adoptedAttemptId === "string" && adoptedAttemptId.length > 0) {
    const ctx = programContext((result.value.answers ?? {}) as BuilderAnswers);
    const facts = await readAdoptionFacts(admin, {
      attemptId: adoptedAttemptId,
      draftId: id,
      ownerUserId: user.id,
      currentFingerprint: ctx ? programContextFingerprint(ctx) : "",
    }).catch(() => ({ attempt: null, latestSuccessfulAttemptId: null }));

    const adoptedJourney = validated.value.answers?.realityGroundedJourneyV1;
    const decision = decideAdoptionReceipt({
      claimedAttemptId: adoptedAttemptId,
      // A marker with no journey in the same request adopts nothing.
      journeyInSamePatch: adoptedJourney !== undefined,
      attempt: facts.attempt,
      draftId: id,
      currentFingerprint: ctx ? programContextFingerprint(ctx) : "",
      latestSuccessfulAttemptId: facts.latestSuccessfulAttemptId,
      /*
        The identity of the journey THIS request wrote, computed here and never taken from
        the client (Slice 3.2L-R11.3). Null until the digest column exists, which leaves the
        R11.2 predicates as the complete set rather than quietly weakening them.
      */
      adoptedJourneyDigest:
        PROPOSAL_DIGEST_ENABLED && adoptedJourney
          ? journeyDigest(adoptedJourney, requiredProgramKinds((result.value.answers ?? {}) as BuilderAnswers))
          : null,
    });
    if (decision.ok) {
      await markProgramAttemptApplied(admin, adoptedAttemptId, user.id).catch(() => false);
    }
  }

  return managerJson(base, req, { draft: toClientDraft(result.value) });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { id } = await ctx.params;
  const result = await deleteDraft(admin, user.id, id);
  if (!result.ok) return managerJson(base, req, { error: result.reason }, statusForReason(result.reason));
  return managerJson(base, req, { deleted: true });
}
