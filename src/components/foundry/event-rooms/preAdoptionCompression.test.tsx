/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { ProgramAuthorship } from "./ProgramAuthorship";
import { writeCachedProposal } from "./proposalContinuity";
import { PROGRAM_AUTHORSHIP_VERSION } from "@/domain/foundry/module/program-authorship";
import type { RealityGroundedJourneyV1 } from "@/domain/foundry/module/journey";

/**
 * SLICE R4-R2E-R4 — PRE-ADOPTION REVIEW COMPRESSION.
 *
 * MEASURED at 390x844 before the change: the review was 2332px, "Add this program to my training"
 * sat at y=2240 — 2.7 screens of scrolling — and the six section bodies were 1866px of it, 80%.
 * The Host had to read a whole document to approve a draft they mostly agreed with.
 *
 * AFTER: the primary action sits at y=796, inside the first screen, and the page is 1612px.
 *
 * These tests hold the MEANING of that compression, not its pixels: nothing was deleted, the
 * decision each section carries is still legible without opening it, and — the point of the whole
 * slice — a Host who opens nothing still adopts exactly what the defaults decided.
 */
const DRAFT = "cc11dd22-ee33-4f44-8055-667788990011";
const ATTEMPT = "dd22ee33-ff44-4055-9166-778899001122";
const FINGERPRINT = "fp-current";

const el = (kind: string, content: string) => ({ kind, content, rationale: "because it fits" });
const PROPOSAL = {
  displayTitle: "Making confirmation calls",
  elements: [
    el("why_it_matters", "BTY: a booking without a confirmation call quietly becomes a no-show."),
    el("observable_standard", "BTY: the employee calls and works through the checklist."),
    el("action_decision", "The next time this happens, I will make a confirmation call."),
    el("field_application", "At your next booking, you make the confirmation call."),
    el("completion_check", "BTY: which question do you most often forget?"),
    el("follow_up", "In seven days you will be asked what happened after you called."),
  ],
  assumptions: [], warnings: [], evidenceLanguage: "",
  behaviorContract: {
    actor: "the employee",
    trigger: "after each new patient booking",
    observableAction: "make a confirmation call and follow the checklist",
    completion: { criterion: "A checklist is completed after each call." },
  },
  scenarioContract: null,
  applicationContract: { applicationMoment: "The next time this happens" },
  completionContract: { verificationTarget: "the_behaviour", responseMode: "name_the_moment" },
  followUpContract: { reviewFocus: "what_you_said", confirmer: "self_report" },
  operationalConstruct: null,
} as never;

const ANSWERS = {
  title: "Confirmation calls",
  problem: "No confirmation calls are made after a new booking.",
  audienceType: "everyone",
  recurringMoment: "after each new patient booking",
  observableBehavior: "Employees make a confirmation call and follow a checklist.",
  successEvidence: "A checklist is completed and submitted after each call.",
  evidenceType: "seen",
  learningNeeds: ["decide", "shared_standard"],
  materialIntent: "youtube", materialText: "https://youtu.be/x",
  completionPrompt: "Describe how you will use the checklist.",
  arenaRecommended: false, followUpDays: 7,
} as never;

/** The Host already owns two of the required sections — so KEEP is the default for those. */
const JOURNEY = {
  version: 1,
  displayTitle: "Making Confirmation Calls",
  displayTitleStatus: "grounded",
  elements: [
    { id: "el_why_it_matters", kind: "why_it_matters", content: "No confirmation calls made today",
      grounding: [{ sourceType: "host_statement", field: "problem" }], confirmationStatus: "grounded" },
    { id: "el_completion_check", kind: "completion_check", content: "Describe how you will use the checklist.",
      grounding: [{ sourceType: "host_statement", field: "completionPrompt" }], confirmationStatus: "grounded" },
  ],
} as unknown as RealityGroundedJourneyV1;

function mount(onApply = vi.fn(async () => ({ status: "adopted" }))) {
  writeCachedProposal(DRAFT, {
    attemptId: ATTEMPT, contextFingerprint: FINGERPRINT, proposal: PROPOSAL,
    evidenceCeiling: "", authorityVersion: PROGRAM_AUTHORSHIP_VERSION,
  } as never);
  render(
    <ProgramAuthorship
      draftId={DRAFT} answers={ANSWERS} journey={JOURNEY} ready
      onGenerate={vi.fn()} onCheckResume={vi.fn(async () => true)}
      currentContextFingerprint={FINGERPRINT}
      adoptionRefusal={null}
      onApply={onApply as never}
      onPendingChange={vi.fn()}
    />,
  );
  return onApply;
}

const isCollapsed = (kind: string) =>
  screen.getByTestId(`program-section-body-${kind}`).className.includes("hidden");

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

describe("[R4-R2E-R4] Review opens as a summary, not a document", () => {
  it("every section starts collapsed, and the primary action is reachable without opening any", async () => {
    mount();
    await screen.findByTestId("program-review");
    for (const kind of ["why_it_matters", "observable_standard", "action_decision", "field_application", "completion_check", "follow_up"]) {
      expect(isCollapsed(kind), `${kind} should start collapsed`).toBe(true);
    }
    const apply = screen.getByTestId("program-apply") as HTMLButtonElement;
    expect(apply).toBeTruthy();
    expect(apply.disabled).toBe(false);
  });

  it("each collapsed row still says what will happen to that section", async () => {
    mount();
    await screen.findByTestId("program-review");
    // The Host's own settled sections default to KEEP (R4-R2A-R1), and the row says so.
    expect(screen.getByTestId("program-section-state-why_it_matters").textContent).toBe("Keep yours");
    expect(screen.getByTestId("program-section-state-completion_check").textContent).toBe("Keep yours");
    // Everything else is BTY's draft.
    expect(screen.getByTestId("program-section-state-action_decision").textContent).toBe("Use BTY");
    expect(screen.getByTestId("program-section-state-follow_up").textContent).toBe("Use BTY");
  });

  it("each collapsed row previews the text that will actually be applied", async () => {
    mount();
    await screen.findByTestId("program-review");
    // A KEEP row previews the HOST's sentence, not BTY's — the preview must not contradict the state.
    expect(screen.getByTestId("program-section-preview-why_it_matters").textContent).toContain("No confirmation calls made today");
    /*
      A — the preview must still show the sentence that will ACTUALLY be applied, which is the
      property this test exists for (Slice R4-R5C11). YOUR DECISION no longer supplies the
      learner's commitment, so what is applied — and previewed — is the question that asks for it.
    */
    expect(screen.getByTestId("program-section-preview-action_decision").textContent)
      .toContain("The next time this happens, what will you do differently?");
  });

  it("nothing was removed — the full comparison is one tap away", async () => {
    mount();
    await screen.findByTestId("program-review");
    fireEvent.click(screen.getByTestId("program-section-toggle-why_it_matters"));
    expect(isCollapsed("why_it_matters")).toBe(false);
    // The Keep/Use comparison, both sentences, and the choice controls are all still there.
    expect(screen.getByTestId("program-keep-choice-why_it_matters")).toBeTruthy();
    expect(screen.getByTestId("program-current-why_it_matters").textContent).toContain("No confirmation calls made today");
    expect(screen.getByTestId("program-derived-why_it_matters")).toBeTruthy();
    expect(screen.getByTestId("program-keep-why_it_matters")).toBeTruthy();
    expect(screen.getByTestId("program-use-why_it_matters")).toBeTruthy();
  });

  it("tapping again collapses it, and only one section is open at a time", async () => {
    mount();
    await screen.findByTestId("program-review");
    const a = screen.getByTestId("program-section-toggle-why_it_matters");
    const b = screen.getByTestId("program-section-toggle-follow_up");

    fireEvent.click(a);
    expect(isCollapsed("why_it_matters")).toBe(false);
    expect(a.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(b);
    expect(isCollapsed("follow_up")).toBe(false);
    expect(isCollapsed("why_it_matters"), "opening a second section must close the first").toBe(true);

    fireEvent.click(b);
    expect(isCollapsed("follow_up")).toBe(true);
    expect(b.getAttribute("aria-expanded")).toBe("false");
  });

  it("changing a choice while open updates the collapsed row's state", async () => {
    mount();
    await screen.findByTestId("program-review");
    fireEvent.click(screen.getByTestId("program-section-toggle-why_it_matters"));
    fireEvent.click(screen.getByTestId("program-use-why_it_matters"));
    expect(screen.getByTestId("program-section-state-why_it_matters").textContent).toBe("Use BTY");
    // …and the preview follows the decision, so the summary can never lie about the detail.
    expect(screen.getByTestId("program-section-preview-why_it_matters").textContent).not.toContain("No confirmation calls made today");
  });

  it("THE POINT: a Host who opens nothing still adopts exactly the defaults", async () => {
    /*
      "Do not make the Host review every section manually. Existing defaults remain authoritative."
      Proven at the seam that matters — what `onApply` receives when the Host taps Add without
      having expanded a single section.
    */
    const onApply = mount();
    await screen.findByTestId("program-review");
    fireEvent.click(screen.getByTestId("program-apply"));
    await waitFor(() => expect(onApply).toHaveBeenCalled());

    const journey = (onApply.mock.calls[0] as unknown[])[0] as RealityGroundedJourneyV1;
    const by = new Map(journey.elements.map((x) => [x.kind, x]));
    // The Host's own two sections were preserved…
    expect(by.get("why_it_matters")!.content).toBe("No confirmation calls made today");
    expect(by.get("completion_check")!.content).toBe("Describe how you will use the checklist.");
    // …and BTY filled the rest.
    expect(by.get("action_decision")!.content).toContain("I will make a confirmation call");
    // The declarations sent alongside match, so R2's authority sees the same decisions.
    const decisions = (onApply.mock.calls[0] as unknown[])[3] as Record<string, string>;
    expect(decisions.why_it_matters).toBe("keep");
    expect(decisions.action_decision).toBe("use");
  });

  it("the summary row is a real disclosure control, at a real touch size", async () => {
    mount();
    await screen.findByTestId("program-review");
    const toggle = screen.getByTestId("program-section-toggle-observable_standard");
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle.getAttribute("aria-controls")).toBe("program-section-body-observable_standard");
    expect(toggle.className).toContain("min-h-[44px]");
  });
});
