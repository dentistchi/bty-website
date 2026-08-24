/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ProgramAuthorship } from "./ProgramAuthorship";
import { writeCachedProposal } from "./proposalContinuity";
import { PROGRAM_AUTHORSHIP_VERSION } from "@/domain/foundry/module/program-authorship";

/**
 * SLICE R4-R2E-R3-R1 — POST-ADOPTION REVIEW COLLAPSE.
 *
 * MEASURED FIRST, in real Chromium at 390x844, because the brief's premise turned out not to
 * match the product:
 *
 *   before adoption   program-review 1859px tall, Learner Preview at y=1875
 *   after adoption    program-review ABSENT, Learner Preview at y=58, whole page 844px
 *
 * The collapse already happened. What the measurement exposed instead is that the BTY draft
 * became UNREACHABLE once adopted — the Founder's G2 ("can I easily reopen them?") had no
 * answer at all. So the compact row gains a disclosure, closed by default so the screen it is
 * meant to keep short stays short.
 *
 * These tests pin the state machine, not the pixels: which surface exists in which adoption
 * outcome, and that only a CONFIRMED success collapses.
 */
const DRAFT = "aa11bb22-cc33-4d44-8e55-ff6677889900";
const ATTEMPT = "bb22cc33-dd44-4e55-9f66-001122334455";
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

function mount(outcome: unknown) {
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
      adoptionRefusal={null}
      onApply={vi.fn(async () => outcome) as never}
      onPendingChange={vi.fn()}
    />,
  );
}

const adopt = async () => fireEvent.click(await screen.findByTestId("program-apply"));

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

describe("[R4-R2E-R3-R1] the long draft area collapses only on a confirmed adoption", () => {
  it("1 — before adoption the full Program Review is expanded, exactly as before", async () => {
    mount({ status: "adopted" });
    expect(await screen.findByTestId("program-review")).toBeTruthy();
    // The long surface is all there: editable title, per-section content, the Apply action.
    expect(screen.getByTestId("program-title-input")).toBeTruthy();
    expect(screen.getByTestId("program-apply")).toBeTruthy();
    expect(screen.queryByTestId("program-applied")).toBeNull();
  });

  it("2 — a successful adoption collapses it to the compact row", async () => {
    mount({ status: "adopted" });
    await adopt();
    expect(await screen.findByTestId("program-applied")).toBeTruthy();
    expect(screen.queryByTestId("program-review")).toBeNull();
    // …and the long surface's controls are gone with it.
    expect(screen.queryByTestId("program-apply")).toBeNull();
    expect(screen.queryByTestId("program-title-input")).toBeNull();
  });

  it("3 — a REFUSED adoption does not collapse to a success row", async () => {
    mount({ status: "refused" });
    await adopt();
    expect(await screen.findByTestId("program-apply-refused")).toBeTruthy();
    expect(screen.queryByTestId("program-applied")).toBeNull();
    expect(screen.queryByTestId("program-applied-toggle")).toBeNull();
  });

  it("3 — nor does a save that never landed", async () => {
    mount({ status: "save_failed" });
    await adopt();
    expect(await screen.findByTestId("program-apply-save-failed")).toBeTruthy();
    expect(screen.queryByTestId("program-applied")).toBeNull();
    expect(screen.queryByTestId("program-applied-toggle")).toBeNull();
  });

  it("3 — a receipt-pending adoption keeps its own honest surface, with no draft toggle", async () => {
    // Durable, but still finishing: it must not be dressed as the settled success row.
    mount({ status: "adopted_receipt_pending" });
    await adopt();
    expect(await screen.findByTestId("program-applied-pending")).toBeTruthy();
    expect(screen.queryByTestId("program-applied-toggle")).toBeNull();
  });

  it("4 — the compact row says the program was added", async () => {
    mount({ status: "adopted" });
    await adopt();
    const row = await screen.findByTestId("program-applied");
    expect(row.textContent).toMatch(/added to your training/i);
    // Compact: the confirmation and the way back, and nothing else until asked.
    expect(screen.queryByTestId("program-applied-draft")).toBeNull();
  });

  it("5/6 — the BTY draft reopens on tap and closes again", async () => {
    mount({ status: "adopted" });
    await adopt();
    const toggle = await screen.findByTestId("program-applied-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const draft = screen.getByTestId("program-applied-draft");
    // What BTY actually wrote, section by section.
    expect(draft.textContent).toContain("When an action leaves a huddle without an owner");
    expect(screen.getByTestId("program-adopted-section-observable_standard")).toBeTruthy();

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("program-applied-draft")).toBeNull();
  });

  it("the reopened draft is READ-ONLY — it cannot start a second adoption", async () => {
    mount({ status: "adopted" });
    await adopt();
    fireEvent.click(await screen.findByTestId("program-applied-toggle"));
    const draft = screen.getByTestId("program-applied-draft");
    expect(draft.querySelector("textarea, input, select")).toBeNull();
    expect(screen.queryByTestId("program-apply")).toBeNull();
    expect(screen.queryByTestId("program-reset")).toBeNull();
    expect(screen.queryByTestId("program-discard")).toBeNull();
    // Everything inside carries the read-only grammar, not the editable one.
    for (const p of draft.querySelectorAll("[data-surface]")) {
      expect(p.getAttribute("data-surface")).toBe("readonly");
    }
  });
});
