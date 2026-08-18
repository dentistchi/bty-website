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
import { programContext, programContextFingerprint, requiredProgramKinds, isPreservableHostSection, PROGRAM_AUTHORSHIP_VERSION } from "@/domain/foundry/module/program-authorship";
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
      /*
        MIXED AUTHORSHIP (Slice R4-R2E-R1). Everything the section-by-section rule needs, and it
        is gathered HERE because this is the only moment both states exist at once: `before` is
        the durable pre-adoption row, `patchAnswers` is the journey being written. One request
        later, the pre-adoption content is gone.

        `adoption_reference` is the ONLY client-supplied part, and the authority hashes it against
        the attempt's durable digest before reading a value from it.
      */
      preAdoptionJourney: (before?.answers as BuilderAnswers | undefined)?.realityGroundedJourneyV1,
      reference: readAdoptionReference(body?.adoption_reference),
      decisions: readAdoptionDecisions(body?.adoption_decisions),
    });
    if (!decision.ok) {
      /*
        ZERO WRITES when the proposal is no longer acceptable (Slice 3.2P-W4-R1).

        Every other refusal is about the RECEIPT: the journey being written is the host's own
        work, possibly edited, and dropping the marker while keeping their edits is right — that
        is why this branch exists at all. `proposal_no_longer_valid` is different in kind. The
        journey in this patch IS the proposal today's rules reject, so stripping the marker and
        writing it anyway would put exactly the content this gate exists to stop into the draft,
        just without a receipt. It refuses before `updateDraftStep`, so nothing is written: no
        journey, no answers, no marker, no `applied_at`.
      */
      if (decision.reason === "proposal_no_longer_valid") {
        return managerJson(base, req, { error: "proposal_no_longer_valid" }, 409);
      }
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
 * The adoption reference, narrowed from an untrusted request body (Slice R4-R2E-R1).
 *
 * Shape only. This says nothing about whether the reference is the real proposal — that is
 * settled by the digest inside the authority, and a well-formed lie is refused exactly like a
 * malformed one. Anything unexpected becomes `null`, which restores the strict single-digest
 * rule rather than skipping it.
 */
function readAdoptionReference(raw: unknown): { displayTitle: string; contentByKind: Record<string, string> } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { displayTitle?: unknown; elements?: unknown };
  if (typeof r.displayTitle !== "string" || !Array.isArray(r.elements)) return null;
  const contentByKind: Record<string, string> = {};
  for (const el of r.elements) {
    if (!el || typeof el !== "object") return null;
    const e = el as { kind?: unknown; content?: unknown };
    if (typeof e.kind !== "string" || typeof e.content !== "string") return null;
    contentByKind[e.kind] = e.content;
  }
  return { displayTitle: r.displayTitle, contentByKind };
}

/** Element content by kind, for one journey — the shape the mixed-authorship rule compares. */
function contentByKind(journey: BuilderAnswers["realityGroundedJourneyV1"]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const el of journey?.elements ?? []) out[el.kind] = el.content;
  return out;
}

/**
 * The authorship each adopted element CLAIMS for itself (Slice R4-R2E-R2). Read straight off the
 * journey being written, and handed to the authority to be checked — content that is not the
 * proposal's may not claim a machine provenance.
 */
function provenanceByKind(journey: BuilderAnswers["realityGroundedJourneyV1"]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const el of journey?.elements ?? []) {
    const source = el.grounding?.[0]?.sourceType;
    if (typeof source === "string") out[el.kind] = source;
  }
  return out;
}

/**
 * What the Host said they did with each section, narrowed from an untrusted body
 * (Slice R4-R2E-R2). Only the three known outcomes survive; anything else is dropped, which
 * returns that section to the strict two-source rule rather than granting it freedom.
 */
function readAdoptionDecisions(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const [kind, decision] of Object.entries(raw as Record<string, unknown>)) {
    if (decision === "keep" || decision === "use" || decision === "edit") out[kind] = decision;
  }
  return Object.keys(out).length > 0 ? out : undefined;
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
    /** The draft's journey BEFORE this write. Absent in recovery — see below. */
    preAdoptionJourney?: BuilderAnswers["realityGroundedJourneyV1"];
    reference?: { displayTitle: string; contentByKind: Record<string, string> } | null;
    /** The Host's own keep/use/rewrite declarations for this adoption (Slice R4-R2E-R2). */
    decisions?: Record<string, string>;
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
    /*
      The acceptance contract in force NOW. A proposal generated under an older one is refused
      before any write — identity is not validity (Slice 3.2P-W4-R1).
    */
    currentAuthorityVersion: PROGRAM_AUTHORSHIP_VERSION,
    /*
      Read from the LEDGER, never from the marker (Slice 3.2R-R8F). An adoption whose receipt is
      already stamped is a completed fact, and a recovery must re-read it as adopted rather than
      re-judge it against a floor that moved afterwards.
    */
    receiptAlreadyStamped: facts.attempt?.receiptAlreadyStamped === true,
    latestSuccessfulAttemptId: facts.latestSuccessfulAttemptId,
    /*
      Recomputed from the journey being proved — the one in this patch for an initial claim,
      the durable one for a recovery. Never taken from the client (Slice 3.2L-R11.3).
    */
    adoptedJourneyDigest:
      PROPOSAL_DIGEST_ENABLED && input.journey
        ? journeyDigest(input.journey, requiredProgramKinds(input.answers))
        : null,
    /*
      MIXED-AUTHORSHIP EVIDENCE (Slice R4-R2E-R1), offered only when there is a pre-adoption
      journey to compare against — which is an INITIAL claim. A recovery re-proves durable state
      long after the pre-adoption content is gone, so it cannot answer "was this section
      preserved unchanged?" and does not pretend to: no evidence, strict rule, fail closed.

      `preservableKinds` is computed from the DURABLE row's own provenance. That is the whole
      reason KEEP cannot be asserted by a caller: the server decides which sections were ever
      the Host's to preserve.
    */
    mixedAuthorship: input.preAdoptionJourney
      ? {
          requiredKinds: requiredProgramKinds(input.answers),
          adoptedTitle: input.journey?.displayTitle ?? "",
          adoptedByKind: contentByKind(input.journey),
          adoptedProvenanceByKind: provenanceByKind(input.journey),
          declarations: input.decisions,
          preAdoptionTitle: input.preAdoptionJourney.displayTitle ?? null,
          preAdoptionByKind: contentByKind(input.preAdoptionJourney),
          preservableKinds: input.preAdoptionJourney.elements
            .filter((el) => isPreservableHostSection(el))
            .map((el) => el.kind),
          reference: input.reference ?? null,
        }
      : undefined,
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
