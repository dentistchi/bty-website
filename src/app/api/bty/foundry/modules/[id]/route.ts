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

  /**
   * ADOPTION AUTHORITY RUNS BEFORE THE WRITE (Slice 3.2L-R11.3A).
   *
   * R11.1 through R11.3 persisted `programAdoptionV1` first and judged it afterwards, so a
   * claim that failed every check still left the draft durably saying it had adopted that
   * proposal. `applied_at` stayed null, which was the point — but the marker itself is an
   * adoption FACT, and an unprovable one must not survive on the row.
   *
   * So an INITIAL claim is proved first and the marker is stripped from the patch if it
   * cannot be. The rest of the Host's edit still saves: a refused receipt has never been a
   * reason to lose their work.
   */
  const patchAnswers = { ...(validated.value.answers ?? {}) };
  let initialClaimProved = false;
  const claimedAttemptId = patchAnswers.programAdoptionV1?.attemptId;
  /**
   * What the caller is told (Slice 3.2L-R11.3B). `receipt` distinguishes the two honest
   * success shapes: the adoption is durable either way, but only `recorded` means the
   * ledger already carries its receipt.
   */
  let adoptionOutcome: { ok: true; receipt: "recorded" | "pending" } | { ok: false; reason: string } | null = null;

  if (typeof claimedAttemptId === "string") {
    const before = await getOwnerDraft(admin, user.id, id);
    // The answers as they WILL be, so the fingerprint is judged on the state being adopted.
    const merged = { ...((before?.answers ?? {}) as BuilderAnswers), ...patchAnswers };
    const decision = await proveAdoption(admin, {
      mode: "initial",
      attemptId: claimedAttemptId,
      draftId: id,
      ownerUserId: user.id,
      answers: merged,
      journeyInSamePatch: patchAnswers.realityGroundedJourneyV1 !== undefined,
      journey: patchAnswers.realityGroundedJourneyV1,
    });
    if (!decision.ok) {
      adoptionOutcome = decision;
      delete patchAnswers.programAdoptionV1;
    }
    initialClaimProved = decision.ok;
  }

  const result = await updateDraftStep(admin, user.id, id, {
    answers: patchAnswers,
    currentStep: validated.value.currentStep,
  });
  if (!result.ok) return managerJson(base, req, { error: result.reason }, statusForReason(result.reason));

  /**
   * RECEIPT, from durable state only.
   *
   * An INITIAL claim that just proved itself is stamped here; a marker already on the row
   * whose receipt never landed is RE-PROVED from the durable journey and stamped. Recovery
   * never trusts the marker's existence — a forged or legacy marker faces the same checks.
   */
  const durable = (result.value.answers ?? {}) as BuilderAnswers;
  const durableAttemptId = durable.programAdoptionV1?.attemptId;
  if (typeof durableAttemptId === "string" && durableAttemptId.length > 0) {
    const decision = initialClaimProved
      ? ({ ok: true } as const)
      : await proveAdoption(admin, {
          mode: "recovery",
          attemptId: durableAttemptId,
          draftId: id,
          ownerUserId: user.id,
          answers: durable,
          journeyInSamePatch: false,
          journey: durable.realityGroundedJourneyV1,
        });
    if (decision.ok) {
      const recorded = await markProgramAttemptApplied(admin, durableAttemptId, user.id).catch(() => false);
      // Durable either way — the journey and the marker are on the row. Only the receipt
      // is in question, and the next save re-proves and completes it.
      adoptionOutcome = { ok: true, receipt: recorded ? "recorded" : "pending" };
    } else if (adoptionOutcome === null) {
      adoptionOutcome = decision;
    }
  }

  return managerJson(base, req, {
    draft: toClientDraft(result.value),
    // Never a silent 200-shaped success: a refused claim says so, by its closed reason.
    ...(adoptionOutcome ? { adoption: adoptionOutcome } : {}),
  });
}

/**
 * Gather the durable facts and decide. Kept beside the route because it is the only caller,
 * and kept OUT of the domain because it reads the database.
 */
async function proveAdoption(
  admin: Parameters<typeof readAdoptionFacts>[0],
  input: {
    mode: "initial" | "recovery";
    attemptId: string;
    draftId: string;
    ownerUserId: string;
    answers: BuilderAnswers;
    journeyInSamePatch: boolean;
    journey: BuilderAnswers["realityGroundedJourneyV1"];
  },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const ctx = programContext(input.answers);
  const fingerprint = ctx ? programContextFingerprint(ctx) : "";
  const facts = await readAdoptionFacts(admin, {
    attemptId: input.attemptId,
    draftId: input.draftId,
    ownerUserId: input.ownerUserId,
    currentFingerprint: fingerprint,
  }).catch(() => ({ attempt: null, latestSuccessfulAttemptId: null }));

  return decideAdoptionReceipt({
    mode: input.mode,
    claimedAttemptId: input.attemptId,
    journeyInSamePatch: input.journeyInSamePatch,
    durableJourneyPresent: input.journey !== undefined,
    attempt: facts.attempt,
    draftId: input.draftId,
    currentFingerprint: fingerprint,
    latestSuccessfulAttemptId: facts.latestSuccessfulAttemptId,
    /*
      Recomputed from the journey being proved — the one in this patch for an initial claim,
      the durable one for a recovery. Never taken from the client (Slice 3.2L-R11.3).
    */
    adoptedJourneyDigest:
      PROPOSAL_DIGEST_ENABLED && input.journey
        ? journeyDigest(input.journey, requiredProgramKinds(input.answers))
        : null,
  });
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
