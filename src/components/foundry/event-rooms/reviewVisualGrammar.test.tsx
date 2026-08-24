/** @vitest-environment jsdom */
/**
 * SLICE R4-R2E — READ-ONLY MUST LOOK READ-ONLY, EDITABLE MUST LOOK EDITABLE, AND ADOPTION
 * MUST END WHERE EDITING BEGINS.
 *
 * THE MEASURED DEFECT, at `30311d96`. On Review, the sentence BTY renders and the sentence the
 * Host types into carried the SAME class string, character for character:
 *
 *   `rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-sm leading-6 text-white/85`
 *
 * — a read-only `<p>` in the program review, and the editable `<textarea>` in the Learner Preview.
 * The only way to find out which was which was to tap one. And after "Add this program to my
 * training", the long review collapsed to a short confirmation panel while the place the adopted
 * words had actually landed sat below, unremarked and usually off screen.
 *
 * These tests pin SEMANTICS, not appearance: which elements are real form controls, which are not,
 * that the two grammars are deliberately different and that only the editable one carries a focus
 * treatment, and that adoption raises a real destination cue on the real destination.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react";
import { useState } from "react";
import { ModuleBuilderShell } from "./ModuleBuilderShell";
import { JourneyPreview } from "./JourneyPreview";
import { writeCachedProposal } from "./proposalContinuity";
import { EDITABLE_FIELD, EDITABLE_FIELD_FRAME, READONLY_TEXT } from "./reviewSurfaceStyles";
import {
  PROGRAM_AUTHORSHIP_VERSION,
  programContext,
  programContextFingerprint,
} from "@/domain/foundry/module/program-authorship";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";
import type { RealityGroundedJourneyV1 } from "@/domain/foundry/module/journey";

const DRAFT = "d-r4r2e";
const ATTEMPT = "0f5a6f4a-7d4f-4a52-9a0d-9c0a1a6b2f11";

/** A complete draft with NO journey yet — the case where adoption itself mounts the preview. */
const ANSWERS = {
  title: "Close the Loop on One Commitment",
  problem: "Team huddles sometimes end with agreement, but no one clearly owns the next action.",
  audienceType: "everyone",
  recurringMoment: "At the end of a team huddle when there are open action items",
  observableBehavior: "Before the huddle ends, name one owner and one deadline for each open action item.",
  successEvidence: "The huddle notes show a named owner and deadline.",
  evidenceType: "seen",
  learningNeeds: ["decide", "shared_standard"],
  materialIntent: "youtube",
  materialText: "https://youtu.be/x",
  completionPrompt: "What two things should be clear before a huddle ends?",
  capabilityCandidate: "Accountability",
  arenaRecommended: false,
  followUpDays: 7,
} as unknown as BuilderAnswers;

/** The fingerprint the shell will compute for ANSWERS — asked of the domain, never hand-written. */
const FINGERPRINT = programContextFingerprint(programContext(ANSWERS)!);

const el = (kind: string, content: string) => ({ kind, content, rationale: "because it fits" });

const PROPOSAL = {
  displayTitle: "Close the loop on one commitment",
  elements: [
    el("why_it_matters", "When an action leaves a huddle without an owner, the work stalls."),
    /*
      THE SERVER PUTS THE HOST'S OWN SENTENCE HERE (Slice R4-R5C14A). This carried the model's
      paraphrase, which the review surface used to discard in favour of the composed standard.
      Neither happens now: the element IS the Host's `observableBehavior`, and the review shows
      and adopts exactly that.
    */
    el("observable_standard", ANSWERS.observableBehavior as string),
    el("action_decision", "I will name one owner and one deadline before the huddle ends."),
    el("field_application", "At your next huddle, you name one owner and one deadline."),
    el("completion_check", "What two things should be clear before a huddle ends?"),
    el("follow_up", "In seven days you will be asked what you actually said."),
  ],
  assumptions: [],
  warnings: [],
  evidenceLanguage: "",
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

const jsonRes = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

/** Draft parked on Review, a resumable attempt, and a PATCH that accepts the adoption. */
function server() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/assets")) return jsonRes({ assets: [] });
    if (u.includes("/program-draft")) return jsonRes({ eligible: true, attempt: null });
    if (u.includes(`/modules/${DRAFT}`)) {
      if (init?.method === "PATCH") return jsonRes({ ok: true });
      return jsonRes({
        draft: {
          id: DRAFT, status: "draft", current_step: 9, answers: ANSWERS,
          module_version: 1, parent_module_id: null,
          document_asset_ref_present: false, created_at: "t", updated_at: "t",
        },
      });
    }
    return jsonRes({ ok: true });
  });
}

function seedCache() {
  writeCachedProposal(DRAFT, {
    attemptId: ATTEMPT,
    contextFingerprint: FINGERPRINT,
    proposal: PROPOSAL,
    evidenceCeiling: "",
    authorityVersion: PROGRAM_AUTHORSHIP_VERSION,
  } as never);
}

/**
 * jsdom has no layout and no `scrollIntoView`. Both are STUBBED rather than skipped, because
 * "was the destination brought into view" is exactly the question G4 asks — and with the default
 * all-zero rect the section would always measure as already visible, which would prove nothing.
 */
let scrollSpy: ReturnType<typeof vi.fn>;
function stubViewport({ top }: { top: number }) {
  scrollSpy = vi.fn();
  Element.prototype.scrollIntoView = scrollSpy as unknown as Element["scrollIntoView"];
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    top, bottom: top + 400, left: 0, right: 390, width: 390, height: 400, x: 0, y: top,
    toJSON: () => ({}),
  } as DOMRect);
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
}

async function openReview() {
  seedCache();
  vi.stubGlobal("fetch", server());
  render(<ModuleBuilderShell draftId={DRAFT} locale="en" initialView="review" onExit={() => {}} />);
  return await screen.findByTestId("program-review");
}

/** Adopt the reviewed program and wait for the confirmation the server established. */
async function adopt() {
  fireEvent.click(await screen.findByTestId("program-apply"));
  await screen.findByTestId("program-applied");
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

/* ------------------------------------------------------------------------ *
 * TEST A — editable and read-only are different KINDS of thing
 * ------------------------------------------------------------------------ */
describe("[R4-R2E] A — the two grammars are not interchangeable", () => {
  it("the learner-facing field is a real form control; the program-review equivalent is not", async () => {
    await openReview();

    /*
      The program review's read-only grammar, on a section BTY actually renders. THE STANDARD is
      the Host's own sentence since Slice R4-R5C14A, so it is an editable field on BOTH surfaces
      now — the contrast this test is about lives between BTY's derived sentences and the Host's
      fields, and YOUR DECISION is one of BTY's.
    */
    const readOnly = screen.getByTestId("program-derived-action_decision");
    expect(readOnly.tagName).toBe("P");
    expect(readOnly.getAttribute("data-surface")).toBe("readonly");
    // Not a disabled control dressed as prose — no form control anywhere inside it.
    expect(readOnly.querySelector("textarea, input, select")).toBeNull();

    await adopt();

    // The Learner Preview's version of the same standard: the Host's, to CHANGE.
    const editable = (await screen.findByTestId("journey-edit-observable_standard")) as HTMLTextAreaElement;
    expect(editable.tagName).toBe("TEXTAREA");
    expect(editable.getAttribute("data-surface")).toBe("editable");
    expect(editable.disabled).toBe(false);
    expect(editable.readOnly).toBe(false);

    /*
      THE MEASURED DEFECT ITSELF. Pre-fix these two rendered with byte-identical class strings.
      Compared as rendered, so the guarantee holds however either surface is later restyled.
    */
    expect(editable.className).not.toBe(readOnly.className);
    expect(editable.className).toMatch(/focus:/);
    expect(readOnly.className).not.toMatch(/focus:/);
  });

  it("every editable control on Review carries an accessible name", async () => {
    await openReview();
    // Program review — the title, and the contract fields behind "Edit details".
    expect(screen.getByLabelText("Program title")).toBeTruthy();

    await adopt();
    // Learner preview — the title and each learner-facing line.
    expect(await screen.findByLabelText("Learner title")).toBeTruthy();
    expect(screen.getByLabelText(/The standard — the learner reads this/)).toBeTruthy();
  });

  it("the two grammars are deliberately different, and only the editable one has a focus state", () => {
    /*
      Asserted against the SHARED CONSTANTS, not a rendered class string. The defect was that these
      two were identical; the guarantee is that they cannot become identical again, and that the
      distinction is not carried by colour alone — the editable one is a bordered field with hover
      and focus responses, the read-only one has no field boundary at all.
    */
    expect(EDITABLE_FIELD).not.toBe(READONLY_TEXT);
    expect(EDITABLE_FIELD).toMatch(/focus:/);
    expect(EDITABLE_FIELD).toMatch(/hover:/);
    expect(READONLY_TEXT).not.toMatch(/focus:/);
    // The read-only grammar must not carry a full field boundary — that is what made it a decoy.
    expect(READONLY_TEXT).not.toMatch(/(^|\s)border(\s|$)/);
    expect(EDITABLE_FIELD_FRAME).toMatch(/(^|\s)border(\s|$)/);
  });
});

/* ------------------------------------------------------------------------ *
 * TEST B — adoption lands somewhere, and says where
 * ------------------------------------------------------------------------ */
describe("[R4-R2E] B — adopting BTY's draft leads to where it can be edited", () => {
  it("the adopted content is in the learner-facing editable field, and the destination says so", async () => {
    stubViewport({ top: 1200 }); // the preview is below the fold when the program is adopted
    await openReview();
    await adopt();

    /*
      WAIT FOR THE CUE, NOT FOR SOMETHING NEAR IT. The confirmation panel appearing is not the
      handoff: adoption has to travel from `ProgramAuthorship`'s effect, through the parent's
      counter, into a `JourneyPreview` that the adoption itself mounts — two further commits. A
      loaded full-suite run resolved between them, and reading the cue there measured `null`.
      The note's APPEARANCE is the honest signal; once it is on screen the rest is synchronous.
    */
    await screen.findByTestId("journey-handoff-note");
    const section = screen.getByTestId("journey-preview");
    expect(section.getAttribute("data-handoff")).toBe("lit");
    expect(screen.getByTestId("journey-handoff-note").textContent).toMatch(/change any line below/i);
    expect(scrollSpy).toHaveBeenCalled();
    // Focus lands on the SECTION, never inside a text box — no keyboard raised over the content,
    // and the next Tab continues into the fields rather than being trapped.
    expect(document.activeElement).toBe(section);
    expect(section.getAttribute("tabindex")).toBe("-1");

    /*
      The adopted sentence is IN the editable control — not merely somewhere on the page.

      IT IS THE SENTENCE THE HOST WAS SHOWN (Slice R4-R5C13-R1). THE STANDARD is one of the seven
      RENDERED kinds, so the review surface never displayed the proposal's own prose for it; this
      used to assert that prose because adoption persisted the payload rather than the rendering.
      Asserting the rendered sentence is the stronger check, and it is what a Host who pressed Add
      without editing anything actually gets.
    */
    const field = (await screen.findByTestId("journey-edit-observable_standard")) as HTMLTextAreaElement;
    // The Host's own behaviour sentence, carried verbatim (Slice R4-R5C14A) — no composed frame
    // and no evidence tail, which is what made a Korean standard read as evidence.
    expect(field.value).toBe(ANSWERS.observableBehavior);
    expect(field.value).not.toContain("Completion evidence:");
  });

  it("a destination already in view is emphasised but NOT scrolled", async () => {
    stubViewport({ top: 40 });
    await openReview();
    await adopt();

    // Same rule as above: wait for the cue itself, then read synchronously.
    await screen.findByTestId("journey-handoff-note");
    expect(screen.getByTestId("journey-preview").getAttribute("data-handoff")).toBe("lit");
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("the emphasis is temporary — it orients, then gets out of the way", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      stubViewport({ top: 1200 });
      await openReview();
      await adopt();
      await screen.findByTestId("journey-handoff-note");

      await act(async () => { vi.advanceTimersByTime(5000); });
      await waitFor(() => expect(screen.queryByTestId("journey-handoff-note")).toBeNull());
      expect(screen.getByTestId("journey-preview").getAttribute("data-handoff")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

/* ------------------------------------------------------------------------ *
 * TEST C — the handoff is an invitation, not a lock
 * ------------------------------------------------------------------------ */
describe("[R4-R2E] C — after adoption the Host can still change the words", () => {
  it("editing the adopted learner-facing line keeps the edit and persists it", async () => {
    stubViewport({ top: 1200 });
    await openReview();
    await adopt();

    const field = () => screen.getByTestId("journey-edit-observable_standard") as HTMLTextAreaElement;
    fireEvent.change(field(), { target: { value: "Say the owner's name out loud before anyone leaves." } });

    expect(field().value).toBe("Say the owner's name out loud before anyone leaves.");

    // And it reached the save path — an edit that only lives in the DOM is not an edit.
    await waitFor(() => {
      const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
      const wrote = calls.some(
        (c) => (c[1] as RequestInit | undefined)?.method === "PATCH" &&
          String((c[1] as RequestInit).body).includes("Say the owner"),
      );
      expect(wrote).toBe(true);
    });
  });

  it("the handoff signal never overwrites what the Host is typing", () => {
    /*
      The counter fires an orientation, and orientation must not touch content. Driven directly so
      the sequence is exact: type, then raise a second handoff.
    */
    const JOURNEY = {
      version: 1,
      displayTitle: "Adopted",
      displayTitleStatus: "grounded",
      elements: [
        {
          id: "el_observable_standard", kind: "observable_standard", content: "BTY's sentence.",
          grounding: [{ sourceType: "host_statement" as const, field: "problem" }],
          confirmationStatus: "grounded" as const,
        },
      ],
    } as unknown as RealityGroundedJourneyV1;

    function Host({ controls }: { controls: { bump?: () => void } }) {
      const [answers, setAnswers] = useState<BuilderAnswers>({ ...ANSWERS, realityGroundedJourneyV1: JOURNEY });
      const [signal, setSignal] = useState(1);
      controls.bump = () => setSignal((n) => n + 1);
      return (
        <JourneyPreview
          answers={answers}
          onPatch={(partial) => setAnswers((prev) => ({ ...prev, ...partial }))}
          onApprovableChange={() => {}}
          handoffSignal={signal}
        />
      );
    }

    const controls: { bump?: () => void } = {};
    render(<Host controls={controls} />);
    const box = () => screen.getByTestId("journey-edit-observable_standard") as HTMLTextAreaElement;

    fireEvent.change(box(), { target: { value: "My own wording." } });
    expect(box().value).toBe("My own wording.");

    act(() => controls.bump!());
    expect(box().value).toBe("My own wording.");
  });
});
