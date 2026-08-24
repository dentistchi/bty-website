/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProgramAuthorship } from "./ProgramAuthorship";
import { journeyElementId, type RealityGroundedJourneyV1 } from "@/domain/foundry/module/journey";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";
import type { ProgramProposal } from "@/domain/foundry/module/program-authorship";

/**
 * SLICE R4-R2A-R1 — the review must be able to say "keep mine", and must open on it.
 *
 * The domain could always preserve an element. What production proved missing was any control
 * that ASKED: `applyProgramProposal` supports `use | keep | edit`, and the review emitted only
 * `use | edit`, so a Host's grounded standard was replaced by the AI composite twice without
 * anyone choosing it. These tests hold the surface, not the derivation — the derivation has its
 * own tests in `programSectionPreservation.test.ts`.
 */

const FINGERPRINT = "fp-1";
const LOCKED = "Before ending a handoff, ask the receiver to state the next action in their own words.";
const AI_STANDARD = "When a dentist hands off a patient, you must ask the receiver to state the next action. Completion evidence: heard.";

vi.mock("./proposalContinuity", async () => {
  const actual = await vi.importActual<typeof import("./proposalContinuity")>("./proposalContinuity");
  return { ...actual, readCachedProposal: vi.fn(), clearCachedProposal: vi.fn(), writeCachedProposal: vi.fn() };
});
import { readCachedProposal } from "./proposalContinuity";

const ANSWERS: BuilderAnswers = {
  title: "Close the Loop — Team Handoff",
  problem: "Handoffs end without confirming the receiver understood.",
  audienceType: "specific_role",
  audienceDetail: "GENERAL_DENTIST",
  recurringMoment: "At each team handoff.",
  observableBehavior: LOCKED,
  successEvidence: "Another team member can hear the learner ask the receiver.",
  evidenceType: "heard",
  learningNeeds: ["decide", "practice", "shared_standard"],
  materialIntent: "pdf",
  completionPrompt: "What will you ask before ending your next handoff?",
  sharedQuestion: "What makes a team handoff complete?",
  followUpDays: 7,
};

function hostJourney(): RealityGroundedJourneyV1 {
  return {
    version: 1,
    displayTitle: "Close the Loop — Team Handoff",
    displayTitleStatus: "needs_confirmation",
    elements: [
      {
        id: journeyElementId("observable_standard"),
        kind: "observable_standard",
        content: LOCKED,
        grounding: [{ sourceType: "host_statement", field: "observableBehavior" }],
        confirmationStatus: "grounded",
      },
    ],
  };
}

const PROPOSAL = {
  displayTitle: "Ensuring Clear Handoffs in Patient Care",
  elements: [
    { kind: "observable_standard", content: AI_STANDARD, rationale: "r" },
    { kind: "scenario", content: "AI scenario.", rationale: "r" },
    { kind: "action_decision", content: "AI decision.", rationale: "r" },
    { kind: "field_application", content: "AI application.", rationale: "r" },
    { kind: "follow_up", content: "AI follow up.", rationale: "r" },
  ],
  assumptions: [],
  warnings: [],
  evidenceLanguage: "",
} as unknown as ProgramProposal;

function renderReview(journey: RealityGroundedJourneyV1 | undefined, onApply = vi.fn().mockResolvedValue({ status: "adopted" })) {
  (readCachedProposal as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    attemptId: "11111111-1111-4111-8111-111111111111",
    contextFingerprint: FINGERPRINT,
    proposal: PROPOSAL,
    evidenceCeiling: "",
  });
  render(
    <ProgramAuthorship
      locale="en"
      draftId="draft-1"
      answers={ANSWERS}
      journey={journey}
      ready
      onGenerate={vi.fn()}
      onCheckResume={vi.fn().mockResolvedValue(true)}
      onApply={onApply}
      currentContextFingerprint={FINGERPRINT}
      adoptionRefusal={null}
      onPendingChange={vi.fn()}
    />,
  );
  return onApply;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("the preservation choice is visible and both versions are readable", () => {
  it("shows the Host's current sentence next to BTY's draft", async () => {
    renderReview(hostJourney());
    await screen.findByTestId("program-keep-choice-observable_standard");
    expect(screen.getByTestId("program-current-observable_standard").textContent).toContain(LOCKED);
    expect(screen.getByTestId("program-keep-observable_standard")).toBeTruthy();
    expect(screen.getByTestId("program-use-observable_standard")).toBeTruthy();
  });

  it("opens on KEEP when the existing standard is grounded and Host-authored", async () => {
    renderReview(hostJourney());
    const keep = await screen.findByTestId("program-keep-observable_standard");
    expect(keep.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("program-use-observable_standard").getAttribute("aria-pressed")).toBe("false");
  });

  it("offers NO preservation choice for a kind the journey does not contain", async () => {
    renderReview(hostJourney());
    await screen.findByTestId("program-keep-choice-observable_standard");
    expect(screen.queryByTestId("program-keep-choice-scenario")).toBeNull();
    expect(screen.queryByTestId("program-keep-choice-follow_up")).toBeNull();
  });

  it("offers NO preservation choice when the existing element is BTY's own earlier draft", async () => {
    const ai = hostJourney();
    ai.elements[0]!.grounding = [{ sourceType: "ai_proposed", field: "observableBehavior" }];
    renderReview(ai);
    await screen.findByTestId("program-section-observable_standard");
    expect(screen.queryByTestId("program-keep-choice-observable_standard")).toBeNull();
  });
});

describe("what the choice actually emits to applyProgramProposal", () => {
  it("the default adoption preserves the Host standard and still fills the missing kinds", async () => {
    const onApply = renderReview(hostJourney());
    const add = await screen.findByTestId("program-apply");
    await userEvent.click(add);
    await waitFor(() => expect(onApply).toHaveBeenCalled());

    const journey = onApply.mock.calls[0]![0] as RealityGroundedJourneyV1;
    const standard = journey.elements.find((e) => e.kind === "observable_standard")!;
    expect(standard.content).toBe(LOCKED);
    expect(standard.grounding[0]?.sourceType).toBe("host_statement");
    expect(standard.confirmationStatus).toBe("grounded");
    for (const kind of ["scenario", "action_decision", "field_application", "follow_up"] as const) {
      expect(journey.elements.find((e) => e.kind === kind)?.content).toBe(
        PROPOSAL.elements.find((p) => p.kind === kind)!.content,
      );
    }
  });

  it("tapping 'Use BTY draft' is an explicit, honoured replacement", async () => {
    const onApply = renderReview(hostJourney());
    await userEvent.click(await screen.findByTestId("program-use-observable_standard"));
    await userEvent.click(screen.getByTestId("program-apply"));
    await waitFor(() => expect(onApply).toHaveBeenCalled());

    const journey = onApply.mock.calls[0]![0] as RealityGroundedJourneyV1;
    expect(journey.elements.find((e) => e.kind === "observable_standard")!.content).toBe(AI_STANDARD);
  });

  it("tapping 'Keep current' after 'Use BTY draft' returns to the Host's sentence", async () => {
    const onApply = renderReview(hostJourney());
    await userEvent.click(await screen.findByTestId("program-use-observable_standard"));
    await userEvent.click(screen.getByTestId("program-keep-observable_standard"));
    await userEvent.click(screen.getByTestId("program-apply"));
    await waitFor(() => expect(onApply).toHaveBeenCalled());

    const journey = onApply.mock.calls[0]![0] as RealityGroundedJourneyV1;
    expect(journey.elements.find((e) => e.kind === "observable_standard")!.content).toBe(LOCKED);
  });

  it("a draft with NO existing journey adopts BTY's proposal exactly as before", async () => {
    const onApply = renderReview(undefined);
    await userEvent.click(await screen.findByTestId("program-apply"));
    await waitFor(() => expect(onApply).toHaveBeenCalled());

    const journey = onApply.mock.calls[0]![0] as RealityGroundedJourneyV1;
    expect(journey.elements.find((e) => e.kind === "observable_standard")!.content).toBe(AI_STANDARD);
  });
});

describe("title behaviour is unchanged by this repair", () => {
  it("the title input still starts on BTY's proposed title", async () => {
    renderReview(hostJourney());
    const input = (await screen.findByTestId("program-title-input")) as HTMLInputElement;
    expect(input.value).toBe("Ensuring Clear Handoffs in Patient Care");
  });

  it("typing a title still adopts the Host's title, grounded", async () => {
    const onApply = renderReview(hostJourney());
    const input = await screen.findByTestId("program-title-input");
    await userEvent.clear(input);
    await userEvent.type(input, "Close the Loop — Team Handoff");
    await userEvent.click(screen.getByTestId("program-apply"));
    await waitFor(() => expect(onApply).toHaveBeenCalled());

    const journey = onApply.mock.calls[0]![0] as RealityGroundedJourneyV1;
    expect(journey.displayTitle).toBe("Close the Loop — Team Handoff");
    expect(journey.displayTitleStatus).toBe("grounded");
  });
});
