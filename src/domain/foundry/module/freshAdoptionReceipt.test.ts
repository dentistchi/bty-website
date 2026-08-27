/**
 * SLICE R4-R9B — DOES A FRESH SIMPLIFICATION-B ADOPTION ACTUALLY FILE ITS RECEIPT?
 *
 * MEASURED FIRST, on the Founder's live draft `adb75f6a`: attempt `b31b8ac9` SUCCEEDED, the
 * journey was written whole, and the claim was refused `proposal_mismatch` with `applied_at`
 * left null. The route withheld the mixed-authorship evidence because a fresh draft has no
 * pre-adoption journey, so the strict digest rule compared BTY's rendered journey against the
 * digest of what the server composed at generation time.
 *
 * This drives the REAL authority with a REAL validated proposal and the REAL apply, so it can
 * answer the only question that matters before deploying: does supplying the reference on an
 * initial claim file the receipt, without relaxing a single attribution rule?
 */
import { describe, it, expect } from "vitest";
import { decideAdoptionReceipt } from "./adoption-authority";
import { proposalDigest, sectionDigest } from "./proposal-digest";
import {
  applyProgramProposal,
  requiredProgramKinds,
  programContext,
  programContextFingerprint,
  contractsFromProposal,
  deriveInstructionalContent,
  readProvenance,
  PROGRAM_AUTHORSHIP_VERSION,
  type ProgramProposal,
  type SectionChoice,
} from "./program-authorship";
import { effectiveFollowUpDays, type BuilderAnswers } from "./module-builder";
import type { JourneyElementKind, RealityGroundedJourneyV1 } from "./journey";

/** The Founder's own answers, verbatim — the shape a Simplification-B Builder collects. */
const ANSWERS = {
  title: "업무 인계 확인하기",
  problem: "업무를 인계한 뒤 서로 확인하지 않아 중요한 일이 빠진다.",
  audienceType: "leaders",
  recurringMoment: "업무를 다른 사람에게 넘길 때",
  observableBehavior: "업무를 넘길 때 해야 할 일과 완료 시점을 분명히 말하고, 상대가 이해한 내용을 한 번 확인한다.",
  successEvidence: "업무를 받은 사람이 해야 할 일과 완료 시점을 정확히 설명할 수 있고, 정한 시점에 완료 여부가 확인된다.",
  evidenceType: "seen",
  materialIntent: "written",
  materialText: "인계 기준 한 장.",
} as unknown as BuilderAnswers;

const REQUIRED = requiredProgramKinds(ANSWERS);
const FINGERPRINT = programContextFingerprint(programContext(ANSWERS)!);
const ATTEMPT = "b31b8ac9-0000-4000-8000-000000000001";

const el = (kind: string, content: string) => ({ kind, content, rationale: "grounded in the host's answers" });

/**
 * A proposal shaped as the SERVER returns one.
 *
 * The instructional kinds carry the sentence the server COMPOSED — `deriveInstructionalContent`
 * over the contracts, with the design's follow-up (7). That is what the durable digest is taken
 * over, and modelling it any other way would test a proposal the API cannot produce, which is
 * exactly how the first version of this file misled me.
 */
const RAW_PROPOSAL = {
  displayTitle: "업무를 넘길 때 서로 확인하기",
  elements: REQUIRED.map((k) =>
    el(
      k,
      k === "observable_standard" ? (ANSWERS.observableBehavior as string)
        : k === "evidence" ? (ANSWERS.successEvidence as string)
        : `BTY가 ${k}에 대해 쓴 문장으로, 길이 기준을 넘기기에 충분합니다.`,
    ),
  ),
  assumptions: [],
  warnings: [],
  evidenceLanguage: "",
  behaviorContract: {
    actor: "the facilitator",
    trigger: ANSWERS.recurringMoment as string,
    observableAction: "말하다 해야 할 일과 완료 시점을 분명히 말한다",
    completion: { criterion: ANSWERS.successEvidence as string },
  },
  scenarioContract: { frame: "others_are_waiting" },
  applicationContract: { applicationMoment: "다음에 이런 일이 생길 때" },
  completionContract: { verificationTarget: "the_behaviour", responseMode: "name_the_moment" },
  followUpContract: { reviewFocus: "what_you_said", confirmer: "self_report" },
  operationalConstruct: null,
} as unknown as ProgramProposal;

/** The server's composition: the same re-derivation, with the DESIGN's follow-up days. */
const SERVER_CONTRACTS = contractsFromProposal(
  RAW_PROPOSAL, effectiveFollowUpDays(ANSWERS), ANSWERS.problem as string, null, ANSWERS, [], "ko",
)!;
const PROPOSAL = {
  ...RAW_PROPOSAL,
  elements: RAW_PROPOSAL.elements.map((e) => ({
    ...e,
    content: deriveInstructionalContent(e.kind as JourneyElementKind, SERVER_CONTRACTS) ?? e.content,
  })),
} as unknown as ProgramProposal;

/** What the CLIENT adopts: BTY's re-derived sentence per kind, exactly as the surface does. */
function adoptFresh(followUpDaysSeenByClient: number): { journey: RealityGroundedJourneyV1; choices: SectionChoice[] } {
  const contracts = contractsFromProposal(
    PROPOSAL, followUpDaysSeenByClient, ANSWERS.problem as string, null, ANSWERS, [], "ko",
  )!;
  const choices: SectionChoice[] = PROPOSAL.elements.map((e) => ({
    kind: e.kind as JourneyElementKind,
    decision: "use",
    // R4-R5C13-R1 — the surface adopts what it RENDERED, which for seven kinds is not the
    // sentence the server composed. This is the whole reason the digests can differ.
    editedContent: deriveInstructionalContent(e.kind as JourneyElementKind, contracts) ?? e.content,
  }));
  const journey = applyProgramProposal(undefined, PROPOSAL, choices, {
    titleDecision: "use",
    editedTitle: PROPOSAL.displayTitle,
  });
  return { journey, choices };
}

const claimFor = (journey: RealityGroundedJourneyV1, choices: SectionChoice[], withReference: boolean) => ({
  draftId: "d-fresh",
  mode: "initial",
  journeyInSamePatch: true,
  currentFingerprint: FINGERPRINT,
  currentAuthorityVersion: PROGRAM_AUTHORSHIP_VERSION,
  receiptAlreadyStamped: false,
  latestSuccessfulAttemptId: ATTEMPT,
  attempt: {
    id: ATTEMPT,
    draftId: "d-fresh",
    outcome: "success",
    proposalVersion: PROGRAM_AUTHORSHIP_VERSION,
    contextFingerprint: FINGERPRINT,
    proposalDigest: proposalDigest(PROPOSAL, REQUIRED),
    receiptAlreadyStamped: false,
  },
  adoptedJourneyDigest: sectionDigest(
    journey.displayTitle,
    Object.fromEntries(journey.elements.map((e) => [e.kind, e.content])),
    REQUIRED,
  ),
  mixedAuthorship: {
    requiredKinds: REQUIRED,
    adoptedTitle: journey.displayTitle,
    adoptedByKind: Object.fromEntries(journey.elements.map((e) => [e.kind, e.content])),
    adoptedProvenanceByKind: Object.fromEntries(journey.elements.map((e) => [e.kind, readProvenance(e) ?? undefined])),
    declarations: Object.fromEntries(choices.map((c) => [c.kind, c.decision])),
    // The literal truth about a draft that had no journey.
    preAdoptionTitle: null,
    preAdoptionByKind: {},
    preservableKinds: [],
    reference: withReference
      ? {
          displayTitle: PROPOSAL.displayTitle,
          contentByKind: Object.fromEntries(PROPOSAL.elements.map((e) => [e.kind, e.content])),
        }
      : null,
  },
} as never);

describe("R4-R9B — a fresh adoption files its receipt", () => {
  it("PRE-FIX — a client composing with the RAW field (0) is refused proposal_mismatch", () => {
    /*
      THE MEASURED DEFECT, reproduced exactly. Slice R4-R8B made the follow-up derived, so a fresh
      draft stores no `followUpDays`; `ProgramAuthorship` read the raw field and got 0 while the
      server composed with 7. WHAT HAPPENS NEXT then differed between the two sides, the adopted
      journey was not the proposal the digest was taken over, and the authority — correctly —
      refused it. This is the differential: it must FAIL against the old reader.
    */
    const { journey, choices } = adoptFresh(0);
    const verdict = decideAdoptionReceipt(claimFor(journey, choices, false));
    expect(verdict.ok).toBe(false);
    expect((verdict as { reason: string }).reason).toBe("proposal_mismatch");
  });

  it("T1/T2/T3/T4 — composing with the DESIGN's follow-up, the receipt is ACCEPTED", () => {
    const { journey, choices } = adoptFresh(effectiveFollowUpDays(ANSWERS));
    const verdict = decideAdoptionReceipt(claimFor(journey, choices, false));
    expect(verdict.ok, verdict.ok ? "" : `refused: ${(verdict as { reason: string }).reason}`).toBe(true);
  });

  it("and the fix is the accessor every other reader already uses", () => {
    expect(effectiveFollowUpDays(ANSWERS)).toBe(7);
    expect((ANSWERS as Record<string, unknown>).followUpDays, "a fresh draft stores none").toBeUndefined();
  });
});

describe("R4-R9B — T6/T7/T8 the integrity guards are untouched", () => {
  it("T6 — a moved fingerprint is still refused, reference or not", () => {
    const { journey, choices } = adoptFresh(effectiveFollowUpDays(ANSWERS));
    const claim = { ...(claimFor(journey, choices, true) as Record<string, unknown>), currentFingerprint: "moved" };
    const verdict = decideAdoptionReceipt(claim as never);
    expect(verdict.ok).toBe(false);
    expect((verdict as { reason: string }).reason).toBe("context_moved");
  });

  it("T7 — a journey that is NOT the proposal is still refused", () => {
    /*
      The guard that matters for a fresh claim. With no pre-adoption journey there is nothing to
      preserve and nothing to declare, so the strict digest rule IS the authority: substitute one
      section and the receipt must not be filed. Retargeted from the reference path, which this
      slice measured to be unnecessary and reverted.
    */
    const { journey, choices } = adoptFresh(effectiveFollowUpDays(ANSWERS));
    const tampered = {
      ...journey,
      elements: journey.elements.map((e) =>
        e.kind === "why_it_matters" ? { ...e, content: "어떤 다른 제안에서 온 문장입니다." } : e,
      ),
    } as RealityGroundedJourneyV1;
    const verdict = decideAdoptionReceipt(claimFor(tampered, choices, false));
    expect(verdict.ok).toBe(false);
    expect((verdict as { reason: string }).reason).toBe("proposal_mismatch");
  });

  it("T8 — an attempt belonging to another draft is refused", () => {
    const { journey, choices } = adoptFresh(effectiveFollowUpDays(ANSWERS));
    const claim = claimFor(journey, choices, false) as Record<string, unknown>;
    (claim.attempt as { draftId: string }).draftId = "someone-elses-draft";
    const verdict = decideAdoptionReceipt(claim as never);
    expect(verdict.ok).toBe(false);
    expect((verdict as { reason: string }).reason).toBe("attempt_other_draft");
  });

  it("T8b — a superseded attempt is refused", () => {
    const { journey, choices } = adoptFresh(effectiveFollowUpDays(ANSWERS));
    const claim = claimFor(journey, choices, false) as Record<string, unknown>;
    claim.latestSuccessfulAttemptId = "a-newer-attempt-0000-4000-8000-000000000009";
    const verdict = decideAdoptionReceipt(claim as never);
    expect(verdict.ok).toBe(false);
    expect((verdict as { reason: string }).reason).toBe("superseded_attempt");
  });
});
