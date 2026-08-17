import { describe, it, expect } from "vitest";
import {
  applyProgramProposal,
  initialSectionDecisions,
  isPreservableHostSection,
  readProvenance,
  type ProgramProposal,
  type SectionChoice,
} from "./program-authorship";
import { journeyElementId, type RealityGroundedJourneyV1 } from "./journey";

/**
 * SLICE R4-R2A-R1 — the Host's own sentence survives a program adoption.
 *
 * MEASURED ON THE FIRST CANONICAL OBSERVED SEED, twice. A Host authored
 *
 *   "Before ending a handoff, ask the receiver to state the next action in their own words."
 *
 * the deterministic mapper grounded it as `host_statement`, and adopting a generated program
 * replaced it with the AI composite — silently, because every section defaulted to `use` and no
 * control in the review ever emitted `keep`. The domain could always preserve an element; the
 * review never asked for it. These tests hold the missing half.
 *
 * The rule under test is about PROVENANCE, not about kind: whether THE STANDARD, the reflection
 * or the completion check, "the Host already said this in their own words and it is settled" is
 * the same fact and gets the same answer.
 */

const LOCKED = "Before ending a handoff, ask the receiver to state the next action in their own words.";

/** The AI composite that actually replaced it in production, at full length. */
const AI_STANDARD =
  "When a dentist hands off a patient, task, or follow-up responsibility to another team member, " +
  "you must ask the receiver to state the next action in their own words before the handoff ends. " +
  "Completion evidence: Another team member can hear the learner ask the receiver to state the next " +
  "action in their own words before the handoff ends.";

function el(
  kind: Parameters<typeof journeyElementId>[0],
  content: string,
  sourceType: string,
  confirmationStatus: "grounded" | "needs_confirmation" = "grounded",
) {
  return {
    id: journeyElementId(kind),
    kind,
    content,
    grounding: [{ sourceType, field: "observableBehavior" }],
    confirmationStatus,
  } as RealityGroundedJourneyV1["elements"][number];
}

/** The five deterministic host-authored elements, exactly as `mapAnswersToJourney` grounds them. */
const HOST_JOURNEY: RealityGroundedJourneyV1 = {
  version: 1,
  displayTitle: "Close the Loop — Team Handoff",
  displayTitleStatus: "needs_confirmation",
  elements: [
    el("why_it_matters", "Handoffs end without confirming the receiver understood.", "host_statement"),
    el("observable_standard", LOCKED, "host_statement"),
    el("reflection", "What makes a team handoff complete?", "host_statement"),
    el("evidence", "Another team member can hear the learner ask the receiver.", "host_statement"),
    el("completion_check", "What will you ask before ending your next handoff?", "host_statement"),
  ],
};

/** The eight-kind proposal: it re-drafts what exists AND supplies the four missing kinds. */
const PROPOSAL: ProgramProposal = {
  displayTitle: "Ensuring Clear Handoffs in Patient Care",
  elements: [
    { kind: "why_it_matters", content: "AI why it matters.", rationale: "r" },
    { kind: "observable_standard", content: AI_STANDARD, rationale: "r" },
    { kind: "scenario", content: "AI scenario.", rationale: "r" },
    { kind: "reflection", content: "AI reflection?", rationale: "r" },
    { kind: "action_decision", content: "AI decision.", rationale: "r" },
    { kind: "field_application", content: "AI application.", rationale: "r" },
    { kind: "completion_check", content: "AI completion?", rationale: "r" },
    { kind: "follow_up", content: "AI follow up.", rationale: "r" },
  ],
  assumptions: [],
  warnings: [],
  evidenceLanguage: "",
} as unknown as ProgramProposal;

/** What the review emits once the Host has answered: keep what they wrote, use what they didn't. */
function choicesFrom(decisions: Record<string, string>): SectionChoice[] {
  return PROPOSAL.elements.map((e) => {
    const d = decisions[e.kind] ?? "use";
    return d === "keep"
      ? ({ kind: e.kind, decision: "keep" } as SectionChoice)
      : ({ kind: e.kind, decision: "use" } as SectionChoice);
  });
}

describe("isPreservableHostSection — what earns a preservation choice", () => {
  it("a grounded host_statement element is preservable", () => {
    expect(isPreservableHostSection(el("observable_standard", LOCKED, "host_statement"))).toBe(true);
  });

  it("a grounded host_edited element is preservable — a Host rewrite is still theirs", () => {
    expect(isPreservableHostSection(el("observable_standard", LOCKED, "host_edited"))).toBe(true);
  });

  it("ai_proposed is NOT preservable — keeping it would protect BTY's draft from BTY's draft", () => {
    expect(isPreservableHostSection(el("observable_standard", AI_STANDARD, "ai_proposed"))).toBe(false);
  });

  it("deterministic_derived is NOT preservable — nobody stated it", () => {
    expect(isPreservableHostSection(el("observable_standard", LOCKED, "deterministic_derived"))).toBe(false);
  });

  it("needs_confirmation is NOT preservable — an unsettled sentence is what a proposal is for", () => {
    expect(isPreservableHostSection(el("observable_standard", LOCKED, "host_statement", "needs_confirmation"))).toBe(false);
  });

  it("empty content is NOT preservable — there is nothing to preserve", () => {
    expect(isPreservableHostSection(el("observable_standard", "   ", "host_statement"))).toBe(false);
  });

  it("a missing element is NOT preservable", () => {
    expect(isPreservableHostSection(undefined)).toBe(false);
  });
});

describe("initialSectionDecisions — the default the review opens on", () => {
  it("an existing grounded Host standard opens on KEEP, not use", () => {
    const d = initialSectionDecisions(HOST_JOURNEY, PROPOSAL);
    expect(d.observable_standard).toBe("keep");
  });

  it("kinds the journey does not contain still open on USE, so gaps are filled", () => {
    const d = initialSectionDecisions(HOST_JOURNEY, PROPOSAL);
    expect(d.scenario).toBe("use");
    expect(d.action_decision).toBe("use");
    expect(d.field_application).toBe("use");
    expect(d.follow_up).toBe("use");
  });

  it("a draft with NO journey at all opens every section on USE — unchanged behaviour", () => {
    const d = initialSectionDecisions(undefined, PROPOSAL);
    for (const e of PROPOSAL.elements) expect(d[e.kind]).toBe("use");
  });

  it("an AI-authored existing journey opens on USE — only the Host's words are protected", () => {
    const aiJourney: RealityGroundedJourneyV1 = {
      ...HOST_JOURNEY,
      elements: [el("observable_standard", AI_STANDARD, "ai_proposed")],
    };
    expect(initialSectionDecisions(aiJourney, PROPOSAL).observable_standard).toBe("use");
  });
});

describe("adoption with the defaults the repair installs", () => {
  const adopted = applyProgramProposal(HOST_JOURNEY, PROPOSAL, choicesFrom(initialSectionDecisions(HOST_JOURNEY, PROPOSAL)), {
    titleDecision: "edit",
    editedTitle: "Close the Loop — Team Handoff",
  });
  const standard = adopted.elements.find((e) => e.kind === "observable_standard")!;

  it("preserves the Host standard BYTE-FOR-BYTE", () => {
    expect(standard.content).toBe(LOCKED);
    expect(standard.content).toHaveLength(LOCKED.length);
  });

  it("keeps its Host provenance — never reflagged as BTY's", () => {
    expect(readProvenance(standard)).toBe("host_statement");
  });

  it("keeps it grounded", () => {
    expect(standard.confirmationStatus).toBe("grounded");
  });

  it("still adopts the four missing kinds from BTY in the SAME operation", () => {
    for (const kind of ["scenario", "action_decision", "field_application", "follow_up"] as const) {
      const e = adopted.elements.find((x) => x.kind === kind)!;
      expect(e.content).toBe(PROPOSAL.elements.find((p) => p.kind === kind)!.content);
      expect(readProvenance(e)).toBe("ai_proposed");
    }
  });

  it("leaves every required kind present after adoption", () => {
    const kinds = adopted.elements.filter((e) => (e.content ?? "").trim().length > 0).map((e) => e.kind);
    for (const k of [
      "why_it_matters",
      "observable_standard",
      "scenario",
      "reflection",
      "action_decision",
      "field_application",
      "evidence",
      "completion_check",
      "follow_up",
    ]) {
      expect(kinds).toContain(k);
    }
  });

  it("title editing is untouched by the repair", () => {
    expect(adopted.displayTitle).toBe("Close the Loop — Team Handoff");
    expect(adopted.displayTitleStatus).toBe("grounded");
  });
});

describe("the Host may still choose BTY's version", () => {
  it("an explicit USE on an existing Host standard adopts the AI composite", () => {
    const decisions = { ...initialSectionDecisions(HOST_JOURNEY, PROPOSAL), observable_standard: "use" };
    const adopted = applyProgramProposal(HOST_JOURNEY, PROPOSAL, choicesFrom(decisions), { titleDecision: "use" });
    const standard = adopted.elements.find((e) => e.kind === "observable_standard")!;
    expect(standard.content).toBe(AI_STANDARD);
    expect(readProvenance(standard)).toBe("ai_proposed");
  });

  it("MIXED keep/use is honoured per section, not all-or-nothing", () => {
    const decisions = {
      ...initialSectionDecisions(HOST_JOURNEY, PROPOSAL),
      // keep the standard, take BTY's reflection
      reflection: "use",
    };
    const adopted = applyProgramProposal(HOST_JOURNEY, PROPOSAL, choicesFrom(decisions), { titleDecision: "use" });
    expect(adopted.elements.find((e) => e.kind === "observable_standard")!.content).toBe(LOCKED);
    expect(adopted.elements.find((e) => e.kind === "reflection")!.content).toBe("AI reflection?");
  });
});

/**
 * THE REGRESSION ITSELF. Before the repair the review emitted `use` for every section, so this
 * is what production actually did — and it is what must never happen again by default.
 */
describe("the pre-repair default, held as a regression", () => {
  it("all-use adoption is what silently replaced the locked sentence", () => {
    const allUse: SectionChoice[] = PROPOSAL.elements.map((e) => ({ kind: e.kind, decision: "use", editedContent: e.content }));
    const adopted = applyProgramProposal(HOST_JOURNEY, PROPOSAL, allUse, { titleDecision: "use" });
    expect(adopted.elements.find((e) => e.kind === "observable_standard")!.content).toBe(AI_STANDARD);
    // …and the repaired default does not.
    const repaired = applyProgramProposal(HOST_JOURNEY, PROPOSAL, choicesFrom(initialSectionDecisions(HOST_JOURNEY, PROPOSAL)), {
      titleDecision: "use",
    });
    expect(repaired.elements.find((e) => e.kind === "observable_standard")!.content).toBe(LOCKED);
  });
});
