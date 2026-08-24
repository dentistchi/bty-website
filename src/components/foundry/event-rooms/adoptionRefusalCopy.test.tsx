/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ProgramAuthorship } from "./ProgramAuthorship";
import { ADOPTION_REFUSAL_COPY, resolveAdoptionRefusalCopy } from "./programRefusalCopy";
import { writeCachedProposal } from "./proposalContinuity";
import { PROGRAM_AUTHORSHIP_VERSION } from "@/domain/foundry/module/program-authorship";

/**
 * SLICE R4-R2E-R1 TEST G — a refusal must say the thing that actually happened.
 *
 * MEASURED: on production draft `d04d48e1` the adoption was refused `proposal_mismatch` while the
 * context fingerprint was byte-identical — and the Host was shown "Your training moved on since
 * BTY wrote this draft." The surface had two sentences for eight closed reasons, so every reason
 * but one inherited a sentence about the Host's answers changing. They had not changed. That copy
 * sent the Founder to re-answer questions that were never the problem.
 */
const DRAFT = "b1e0e5b6-6c1f-4d55-9a44-7d0f2a1c9e31";
const ATTEMPT = "c2f1f6c7-7d2f-4e66-8b55-8e1f3b2daf42";
const FINGERPRINT = "fp-current";

const el = (kind: string, content: string) => ({ kind, content, rationale: "because it fits" });
const PROPOSAL = {
  displayTitle: "Close the loop",
  elements: [
    el("why_it_matters", "When an action leaves a huddle without an owner, the work stalls."),
    el("observable_standard", "Before the huddle ends, the facilitator names one owner."),
    el("action_decision", "I will name one owner before the huddle ends."),
    el("field_application", "At your next huddle, you name one owner."),
    el("completion_check", "What two things should be clear before a huddle ends?"),
    el("follow_up", "In seven days you will be asked what you actually said."),
  ],
  assumptions: [], warnings: [], evidenceLanguage: "",
  behaviorContract: {
    actor: "the facilitator",
    trigger: "At the end of a team huddle when there are open action items",
    observableAction: "name one owner and one deadline for each open action item",
    completion: { criterion: "The huddle notes show a named owner and deadline." },
  },
  scenarioContract: null,
  applicationContract: { applicationMoment: "The next time this happens" },
  completionContract: { verificationTarget: "the_behaviour", responseMode: "name_the_moment" },
  followUpContract: { reviewFocus: "what_you_said", confirmer: "self_report" },
  operationalConstruct: null,
} as never;

const ANSWERS = {
  title: "Close the Loop",
  problem: "Team huddles end with agreement, but no one clearly owns the next action.",
  audienceType: "everyone",
  recurringMoment: "At the end of a team huddle when there are open action items",
  observableBehavior: "Before the huddle ends, name one owner and one deadline.",
  successEvidence: "The huddle notes show a named owner and deadline.",
  evidenceType: "seen",
  learningNeeds: ["decide", "shared_standard"],
  materialIntent: "youtube", materialText: "https://youtu.be/x",
  completionPrompt: "What two things should be clear before a huddle ends?",
  arenaRecommended: false, followUpDays: 7,
} as never;

function mountRefusedWith(reason: string) {
  writeCachedProposal(DRAFT, {
    attemptId: ATTEMPT, contextFingerprint: FINGERPRINT, proposal: PROPOSAL,
    evidenceCeiling: "", authorityVersion: PROGRAM_AUTHORSHIP_VERSION,
  } as never);
  return render(
    <ProgramAuthorship
      draftId={DRAFT}
      locale="en" answers={ANSWERS} journey={undefined} ready
      onGenerate={vi.fn()} onCheckResume={vi.fn(async () => true)}
      currentContextFingerprint={FINGERPRINT}
      adoptionRefusal={reason}
      onApply={vi.fn(async () => ({ status: "refused" })) as never}
      onPendingChange={vi.fn()}
    />,
  );
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

describe("[R4-R2E-R1] G — every refusal reason has its own true sentence", () => {
  it("proposal_mismatch does NOT claim the training moved on", async () => {
    mountRefusedWith("proposal_mismatch");
    fireEvent.click(await screen.findByTestId("program-apply"));
    const explanation = (await screen.findByTestId("program-refused-explanation")).textContent ?? "";
    // The measured falsehood, pinned so it cannot come back.
    expect(explanation).not.toMatch(/training moved on/i);
    expect(explanation).toMatch(/isn’t the program that record refers to/i);
    /*
      R4-R2E-R2 — the refusal may never tell the Host to stop rewriting. Rewriting is invited by
      the Learner Preview and is now a valid final program state, so the old sentence ("add it
      without rewriting the sections") contradicted the product and is pinned out.
    */
    expect(explanation).not.toMatch(/without rewriting/i);
  });

  it("context_moved is the ONE reason allowed to say the training moved on", async () => {
    mountRefusedWith("context_moved");
    fireEvent.click(await screen.findByTestId("program-apply"));
    const explanation = (await screen.findByTestId("program-refused-explanation")).textContent ?? "";
    expect(explanation).toMatch(/training moved on/i);
  });

  it("proposal_no_longer_valid describes the RULES changing, not the training", async () => {
    mountRefusedWith("proposal_no_longer_valid");
    fireEvent.click(await screen.findByTestId("program-apply"));
    const explanation = (await screen.findByTestId("program-refused-explanation")).textContent ?? "";
    expect(explanation).toMatch(/rules for writing programs changed/i);
    expect(explanation).not.toMatch(/training moved on/i);
  });

  it("the two reasons render DISTINCT explanations", async () => {
    expect(ADOPTION_REFUSAL_COPY.proposal_mismatch.explanation).not.toBe(
      ADOPTION_REFUSAL_COPY.proposal_no_longer_valid.explanation,
    );
  });

  it("every reason is distinct — no reason silently inherits another's meaning", () => {
    const seen = new Set<string>();
    for (const [reason, copy] of Object.entries(ADOPTION_REFUSAL_COPY)) {
      expect(copy.explanation.length, `${reason} has no explanation`).toBeGreaterThan(0);
      expect(seen.has(copy.explanation), `${reason} reuses another reason's sentence`).toBe(false);
      seen.add(copy.explanation);
    }
    // Only one reason may make the claim that the Host's answers changed.
    const movedOn = Object.entries(ADOPTION_REFUSAL_COPY).filter(([, c]) => /training moved on/i.test(c.explanation));
    expect(movedOn.map(([r]) => r)).toEqual(["context_moved"]);
  });

  it("an unrecognised reason gets an honest fallback, never a guess", () => {
    const copy = resolveAdoptionRefusalCopy("something_this_build_has_never_heard_of");
    expect(copy.explanation).not.toMatch(/training moved on/i);
    expect(copy.explanation).not.toMatch(/rules for writing programs changed/i);
    expect(copy.explanation).toMatch(/draft the program again/i);
  });
});
