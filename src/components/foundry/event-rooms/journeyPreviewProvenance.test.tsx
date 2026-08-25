/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { JourneyPreview } from "./JourneyPreview";
import {
  attributionKind,
  contractsFromProposal,
  deriveInstructionalContent,
  groundingAfterPreviewEdit,
  groundingFieldFor,
  isPreservableHostSection,
  readProvenance,
} from "@/domain/foundry/module/program-authorship";
import { mapAnswersToJourney, type JourneyElement, type JourneyElementKind, type RealityGroundedJourneyV1 } from "@/domain/foundry/module/journey";
import { renderCompletionQuestion, type BehaviorContract } from "@/domain/foundry/module/program-coherence";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

/**
 * SLICE R4-R5C18A — A HOST TYPING IS NOT A HOST AUTHORING.
 *
 * MEASURED ON A COMPLETED NATURAL TRAINING. The published journey of "리더십 신뢰 구축을 위한
 * 행동 변화" carries a completion_check stamped `host_statement` / field `problem`, while its
 * source draft's `answers.completionPrompt` is `undefined`. No domain path can produce that pair:
 * `groundingFieldFor("completion_check")` has returned `"completionPrompt"` since the function
 * existed, and `mapAnswersToJourney` reads the same map.
 *
 * THE ONLY WRITER THAT COULD was the preview's own editor, which issued provenance inline:
 *
 *     grounding: content.trim().length > 0
 *       ? [{ sourceType: "host_statement", field: e.grounding[0]?.field ?? "problem" }]
 *       : []
 *
 * `onChange` fires per keystroke, so clearing a textarea persists `grounding: []`, and the next
 * character reads `undefined?.field ?? "problem"`. Two separate untruths in one expression: BTY's
 * sentence relabelled as the Host's own, and an authoritative grounding field invented.
 *
 * IT WAS NOT COSMETIC. `isPreservableHostSection` reads provenance, and `defaultDecisions` opens
 * the authorship review on `keep` for anything it calls the Host's — so a false `host_statement`
 * silently discards the next BTY proposal for that section without asking.
 *
 * WHAT THIS SLICE DOES NOT DO: it does not decide authorship itself. `provenanceAfterHostEdit`
 * already owns "what a Host edit does to authorship" and `groundingFieldFor` already owns "which
 * Builder field grounds this kind". The repair routes the preview through both instead of
 * carrying a second opinion.
 */

const FIXTURE: BuilderAnswers = {
  problem: "During huddles people leave without naming who will act or when.",
  recurringMoment: "at each handoff point",
  observableBehavior: "The owner repeats the action and deadline aloud before the huddle ends.",
  successEvidence: "The huddle note records one owner and one deadline per action.",
} as BuilderAnswers;

/** An adopted journey: BTY wrote every sentence, and says so. */
const adopted = (over: Partial<Record<JourneyElementKind, Partial<JourneyElement>>> = {}): RealityGroundedJourneyV1 => ({
  version: 1,
  displayTitle: "Owning the next step",
  displayTitleStatus: "grounded",
  elements: (
    [
      ["why_it_matters", "ai_proposed", "problem", "Things get dropped after huddles."],
      ["observable_standard", "host_statement", "observableBehavior", FIXTURE.observableBehavior!],
      ["action_decision", "ai_proposed", "problem", "When is the next time this will come up for you, and what will you do then?"],
      ["field_application", "ai_proposed", "problem", "The next time this happens is the first real chance to try it."],
      ["evidence", "host_statement", "successEvidence", FIXTURE.successEvidence!],
      ["completion_check", "ai_proposed", "completionPrompt", "What might make this difficult to do in real work?"],
      ["follow_up", "ai_proposed", "followUpDays", "In 7 days we will ask how it went."],
    ] as const
  ).map(([kind, sourceType, field, content]) => ({
    id: `el_${kind}`,
    kind,
    content,
    grounding: [{ sourceType, field }],
    confirmationStatus: "grounded",
    ...(over[kind] ?? {}),
  })) as JourneyElement[],
});

/** Render the preview over an already-adopted journey and return the latest persisted journey. */
function mountAdopted(journey: RealityGroundedJourneyV1 = adopted()) {
  const onPatch = vi.fn();
  const answers = { ...FIXTURE, realityGroundedJourneyV1: journey } as BuilderAnswers;
  render(<JourneyPreview locale="en" answers={answers} onPatch={onPatch} onApprovableChange={vi.fn()} />);
  const latest = (): RealityGroundedJourneyV1 => {
    const calls = onPatch.mock.calls.filter((c) => (c[0] as BuilderAnswers).realityGroundedJourneyV1);
    return (calls[calls.length - 1][0] as BuilderAnswers).realityGroundedJourneyV1!;
  };
  const el = (kind: JourneyElementKind) => latest().elements.find((e) => e.kind === kind)!;
  const type = (kind: JourneyElementKind, value: string) =>
    fireEvent.change(screen.getByTestId(`journey-edit-${kind}`), { target: { value } });
  return { el, type, latest };
}

const CONTRACT: BehaviorContract = {
  actor: "you",
  trigger: "Whenever you are about to ask the team for a standard",
  observableAction: "check that you already do what you are asking for",
  completion: { criterion: "A team member can name a recent time you did it first." },
};
const COMPLETION = { verificationTarget: "the_behaviour", responseMode: "name_the_moment" } as never;

const contractsFor = (completionPrompt: string | null) =>
  contractsFromProposal(
    {
      displayTitle: "t",
      elements: [
        { kind: "observable_standard" as JourneyElementKind, content: "x", rationale: "" },
        { kind: "action_decision" as JourneyElementKind, content: "x", rationale: "" },
      ],
      behaviorContract: CONTRACT,
      scenarioContract: null,
      applicationContract: { applicationMoment: CONTRACT.trigger },
      completionContract: COMPLETION,
      followUpContract: null,
      operationalConstruct: null,
    } as never,
    7, "Leaders ask for what they do not do.", completionPrompt,
    { ...FIXTURE, learningNeeds: ["shared_standard", "decide"] } as never, [], "en",
  )!;

afterEach(() => cleanup());

// ---------------------------------------------------------------------------
// T14 · THE DIFFERENTIAL — the exact natural sequence
// ---------------------------------------------------------------------------

describe("[R4-R5C18A · differential] clear then retype does not invent Host authorship", () => {
  it("BTY's completion question, cleared and retyped, becomes host_edited | completionPrompt", () => {
    const { el, type } = mountAdopted();
    expect(readProvenance(el2(el, "completion_check"))).toBe("ai_proposed");

    type("completion_check", "What might make this difficult to do in real work");   // 1. edit
    type("completion_check", "");                                                      // 2. clear
    type("completion_check", "W");                                                     // 3. retype
    type("completion_check", "What gets in the way on a busy day?");

    const after = el("completion_check");
    expect(readProvenance(after)).toBe("host_edited");
    expect(after.grounding[0]?.field).toBe("completionPrompt");
    // The exact pair the natural snapshot carries must be unreachable.
    expect(after.grounding[0]?.field).not.toBe("problem");
    expect(readProvenance(after)).not.toBe("host_statement");
  });
});

/** The element as it stands before any interaction (the mount patch is not fired for adopted journeys). */
function el2(el: (k: JourneyElementKind) => JourneyElement, kind: JourneyElementKind): JourneyElement {
  try {
    return el(kind);
  } catch {
    return adopted().elements.find((e) => e.kind === kind)!;
  }
}

// ---------------------------------------------------------------------------
// T1-T7 · the authorship contract the domain already owns
// ---------------------------------------------------------------------------

describe("[R4-R5C18A · T1-T7] the domain authorship contract", () => {
  it("T1 no Host completionPrompt → the derived completion_check is not the Host's statement", () => {
    const c = contractsFor(null);
    const derived = deriveInstructionalContent("completion_check", c);
    expect(derived).toBe(renderCompletionQuestion(CONTRACT, COMPLETION, "en", true));
    // Nothing in the journey attributes it to the Host.
    const j = mapAnswersToJourney({ ...FIXTURE, completionPrompt: undefined } as BuilderAnswers);
    const cc = j.elements.find((e) => e.kind === "completion_check")!;
    expect(cc.content).toBe("");
    expect(readProvenance(cc)).toBeNull();
    expect(attributionKind(cc)).toBeNull();
  });

  it("T2 an explicit Host completionPrompt is host_statement on its own field", () => {
    const j = mapAnswersToJourney({ ...FIXTURE, completionPrompt: "What did you commit to?" } as BuilderAnswers);
    const cc = j.elements.find((e) => e.kind === "completion_check")!;
    expect(readProvenance(cc)).toBe("host_statement");
    expect(cc.grounding[0]?.field).toBe("completionPrompt");
    expect(deriveInstructionalContent("completion_check", contractsFor("What did you commit to?"))).toBe("What did you commit to?");
  });

  it("T3 no path produces completion_check with field=problem", () => {
    expect(groundingFieldFor("completion_check")).toBe("completionPrompt");
    const { el, type } = mountAdopted();
    for (const value of ["x", "", "y", "", "a real question?"]) type("completion_check", value);
    expect(el("completion_check").grounding[0]?.field ?? "completionPrompt").toBe("completionPrompt");
  });

  it("T6 the C16B barrier question is BTY's, not the Host's", () => {
    const { el } = mountAdopted();
    const cc = el2(el, "completion_check");
    expect(cc.content).toBe(renderCompletionQuestion(CONTRACT, COMPLETION, "en", true));
    expect(attributionKind(cc)).toBe("bty_authored");
  });

  it("T7 Standard and Evidence keep their Host authority", () => {
    const j = mapAnswersToJourney(FIXTURE);
    for (const [kind, field] of [["observable_standard", "observableBehavior"], ["evidence", "successEvidence"]] as const) {
      const e = j.elements.find((x) => x.kind === kind)!;
      expect(readProvenance(e), kind).toBe("host_statement");
      expect(e.grounding[0]?.field, kind).toBe(field);
    }
    // R4-R5C14A — BTY renders nothing for them, so adoption cannot overwrite the Host's words.
    expect(deriveInstructionalContent("observable_standard", contractsFor(null))).toBeNull();
    expect(deriveInstructionalContent("evidence", contractsFor(null))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T8-T13 · the preview editor, for every kind
// ---------------------------------------------------------------------------

describe("[R4-R5C18A · T8-T13] a preview edit transfers authorship without inventing it", () => {
  it("T8 editing BTY content makes it host_edited, never host_statement", () => {
    const { el, type } = mountAdopted();
    type("completion_check", "What gets in the way?");
    expect(readProvenance(el("completion_check"))).toBe("host_edited");
    expect(attributionKind(el("completion_check"))).toBe("host_edited");
  });

  it("T9 clearing does not erase the grounding identity the next keystroke needs", () => {
    const { el, type } = mountAdopted();
    type("completion_check", "");
    // Empty content is unsettled, but the element still knows whose sentence it was.
    expect(el("completion_check").confirmationStatus).toBe("needs_confirmation");
    expect(el("completion_check").grounding[0]?.field).toBe("completionPrompt");
    type("completion_check", "Something of my own?");
    expect(el("completion_check").grounding[0]?.field).toBe("completionPrompt");
    expect(readProvenance(el("completion_check"))).toBe("host_edited");
  });

  it("T10 'problem' stays valid where it IS the kind's authoritative field", () => {
    const { el, type } = mountAdopted();
    type("action_decision", "When will you try this, and what will you do?");
    expect(readProvenance(el("action_decision"))).toBe("host_edited");
    expect(el("action_decision").grounding[0]?.field).toBe("problem");
    expect(groundingFieldFor("action_decision")).toBe("problem");
  });

  it("T11/T12 reflection and follow_up keep their own fields", () => {
    const withReflection = adopted();
    withReflection.elements.push({
      id: "el_reflection", kind: "reflection", content: "What usually happens today?",
      grounding: [{ sourceType: "ai_proposed", field: "sharedQuestion" }], confirmationStatus: "grounded",
    } as JourneyElement);
    const { el, type } = mountAdopted(withReflection);
    type("reflection", "How does this go for you now?");
    expect(el("reflection").grounding[0]?.field).toBe("sharedQuestion");
    type("follow_up", "In a week we will ask how it went.");
    expect(el("follow_up").grounding[0]?.field).toBe("followUpDays");
    expect(readProvenance(el("follow_up"))).toBe("host_edited");
  });

  it("T13/T14 the Host's own sections stay the Host's own through an edit", () => {
    const { el, type } = mountAdopted();
    type("observable_standard", "The owner repeats the action and the deadline aloud.");
    expect(readProvenance(el("observable_standard"))).toBe("host_statement");
    expect(el("observable_standard").grounding[0]?.field).toBe("observableBehavior");
    type("evidence", "The note records one owner and one deadline.");
    expect(readProvenance(el("evidence"))).toBe("host_statement");
    expect(el("evidence").grounding[0]?.field).toBe("successEvidence");
  });
});

// ---------------------------------------------------------------------------
// The domain rule itself, and what it means downstream
// ---------------------------------------------------------------------------

describe("[R4-R5C18A] the rule lives in the domain, and KEEP follows it", () => {
  it("the preview delegates: one function, no second opinion in the UI", () => {
    const prior = { kind: "completion_check", content: "BTY's question", grounding: [{ sourceType: "ai_proposed", field: "completionPrompt" }] };
    expect(groundingAfterPreviewEdit(prior as never, "completion_check"))
      .toEqual([{ sourceType: "host_edited", field: "completionPrompt" }]);
    // A Host's own sentence stays theirs.
    const own = { kind: "evidence", content: "x", grounding: [{ sourceType: "host_statement", field: "successEvidence" }] };
    expect(groundingAfterPreviewEdit(own as never, "evidence"))
      .toEqual([{ sourceType: "host_statement", field: "successEvidence" }]);
    // An element that never held anything: the Host is originating it, on the kind's own field.
    const fresh = { kind: "completion_check", content: "", grounding: [] };
    expect(groundingAfterPreviewEdit(fresh as never, "completion_check"))
      .toEqual([{ sourceType: "host_statement", field: "completionPrompt" }]);
    // Legacy content with no recorded provenance: unknown stays unknown, never invented.
    const legacy = { kind: "why_it_matters", content: "written by someone", grounding: [] };
    expect(groundingAfterPreviewEdit(legacy as never, "why_it_matters")).toEqual([]);
  });

  it("a Host-EDITED BTY section is still preservable, and a BTY section is not", () => {
    // Measured, not changed: `isPreservableHostSection` accepts host_statement AND host_edited.
    const { el, type } = mountAdopted();
    expect(isPreservableHostSection(el2(el, "completion_check"))).toBe(false);
    type("completion_check", "What gets in the way?");
    expect(isPreservableHostSection(el("completion_check"))).toBe(true);
  });
});
