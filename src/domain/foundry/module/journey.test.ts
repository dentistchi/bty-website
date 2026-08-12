import { describe, it, expect } from "vitest";
import type { BuilderAnswers } from "./module-builder";
import {
  mapAnswersToJourney,
  validateJourney,
  isJourneyApprovable,
  unresolvedJourneyElements,
  journeyCompletionCheck,
  toPublicJourney,
  journeyElementId,
  REQUIRED_JOURNEY_KINDS,
  type RealityGroundedJourneyV1,
} from "./journey";

// The Commander B3A fixture — a concrete workplace reality (no technical title).
const FIXTURE: BuilderAnswers = {
  problem:
    "During morning huddles, team members report problems but leave without naming who will act or when the next step will happen.",
  audienceType: "everyone",
  recurringMoment: "During morning huddles",
  observableBehavior: "Before the huddle ends, the owner of each next step repeats the action and deadline aloud.",
  successEvidence: "The huddle note records one owner and one deadline for every agreed action.",
  completionPrompt: "After your next huddle, what one action had a named owner and deadline?",
};

describe("mapAnswersToJourney — deterministic, grounded, no fabrication", () => {
  it("emits required elements grounded to the exact Host fields, in canonical order", () => {
    const j = mapAnswersToJourney(FIXTURE);
    expect(j.version).toBe(1);
    const kinds = j.elements.map((e) => e.kind);
    // why → standard → (evidence) → completion, canonical order preserved
    expect(kinds).toEqual(["why_it_matters", "observable_standard", "evidence", "completion_check"]);
    const why = j.elements.find((e) => e.kind === "why_it_matters")!;
    expect(why.content).toBe(FIXTURE.problem); // exact Host words, no generic substitution
    expect(why.grounding).toEqual([{ sourceType: "host_statement", field: "problem" }]);
    expect(why.confirmationStatus).toBe("grounded");
    expect(why.id).toBe(journeyElementId("why_it_matters"));
    expect(j.elements.find((e) => e.kind === "observable_standard")!.content).toBe(FIXTURE.observableBehavior);
    expect(j.elements.find((e) => e.kind === "evidence")!.content).toBe(FIXTURE.successEvidence);
    expect(j.elements.find((e) => e.kind === "completion_check")!.content).toBe(FIXTURE.completionPrompt);
  });

  it("NEVER invents scenario / action_decision / field_application (no grounded source)", () => {
    const j = mapAnswersToJourney(FIXTURE);
    const kinds = j.elements.map((e) => e.kind);
    expect(kinds).not.toContain("scenario");
    expect(kinds).not.toContain("action_decision");
    expect(kinds).not.toContain("field_application");
  });

  it("OMITS optional elements when the Host left them empty (never fabricated)", () => {
    const j = mapAnswersToJourney({ ...FIXTURE, successEvidence: "", sharedQuestion: "" });
    expect(j.elements.map((e) => e.kind)).not.toContain("evidence");
    expect(j.elements.map((e) => e.kind)).not.toContain("reflection");
  });

  it("includes reflection ONLY when a shared question is grounded", () => {
    const withRef = mapAnswersToJourney({ ...FIXTURE, sharedQuestion: "What made the owner easy or hard to name?" });
    const ref = withRef.elements.find((e) => e.kind === "reflection");
    expect(ref?.content).toBe("What made the owner easy or hard to name?");
    expect(ref?.grounding).toEqual([{ sourceType: "host_statement", field: "sharedQuestion" }]);
  });

  it("marks a missing REQUIRED element needs_confirmation with empty content (no generic default)", () => {
    const j = mapAnswersToJourney({ ...FIXTURE, completionPrompt: "" });
    const cc = j.elements.find((e) => e.kind === "completion_check")!;
    expect(cc.content).toBe("");
    expect(cc.confirmationStatus).toBe("needs_confirmation");
    expect(cc.grounding).toEqual([]);
  });

  it("derives a provisional displayTitle from the problem's first line, marked needs_confirmation", () => {
    const j = mapAnswersToJourney(FIXTURE);
    expect(j.displayTitle).toBe((FIXTURE.problem ?? "").split(/\r?\n/)[0]);
    expect(j.displayTitleStatus).toBe("needs_confirmation"); // Host must approve the learner title
  });
});

describe("validateJourney", () => {
  it("accepts a well-formed journey and rejects bad shapes", () => {
    const j = mapAnswersToJourney(FIXTURE);
    expect(validateJourney(j)).toEqual([]);
    expect(validateJourney(null)).toContain("journey_missing");
    expect(validateJourney({ ...j, version: 2 })).toContain("bad_version");
    expect(validateJourney({ ...j, elements: [{ id: "x", kind: "why_it_matters", content: "", confirmationStatus: "grounded" }] })).toContain("bad_element_id");
  });

  it("flags a missing required kind", () => {
    const j = mapAnswersToJourney(FIXTURE);
    const stripped = { ...j, elements: j.elements.filter((e) => e.kind !== "completion_check") };
    expect(validateJourney(stripped)).toContain("missing_required:completion_check");
  });
});

describe("approval gate + completion + public projection", () => {
  const grounded = (): RealityGroundedJourneyV1 => {
    const j = mapAnswersToJourney(FIXTURE);
    return { ...j, displayTitle: "Owning the next step", displayTitleStatus: "grounded" };
  };

  it("is NOT approvable while the title or any element needs confirmation", () => {
    expect(isJourneyApprovable(mapAnswersToJourney(FIXTURE))).toBe(false); // title needs_confirmation
    expect(unresolvedJourneyElements(mapAnswersToJourney({ ...FIXTURE, completionPrompt: "" }))).toContain("completion_check");
  });

  it("is approvable once title is confirmed and all elements are grounded", () => {
    expect(isJourneyApprovable(grounded())).toBe(true);
    expect(unresolvedJourneyElements(grounded())).toEqual([]);
  });

  it("exposes the approved completion check", () => {
    expect(journeyCompletionCheck(grounded())).toBe(FIXTURE.completionPrompt);
    expect(journeyCompletionCheck({ ...grounded(), elements: [] })).toBeNull();
  });

  it("public projection exposes ordered grounded content only — no grounding/status/needs_confirmation", () => {
    const pub = toPublicJourney(grounded())!;
    expect(pub.displayTitle).toBe("Owning the next step");
    expect(pub.elements.map((e) => e.kind)).toEqual(["why_it_matters", "observable_standard", "evidence", "completion_check"]);
    for (const e of pub.elements) {
      expect(Object.keys(e).sort()).toEqual(["content", "id", "kind"]); // no grounding, no confirmationStatus
    }
    // a needs_confirmation element is never projected
    const withUnresolved = mapAnswersToJourney({ ...FIXTURE, completionPrompt: "" });
    expect(toPublicJourney({ ...withUnresolved, displayTitleStatus: "grounded" })!.elements.map((e) => e.kind)).not.toContain("completion_check");
  });

  it("required kinds are exactly the coherent-journey minimum", () => {
    expect([...REQUIRED_JOURNEY_KINDS]).toEqual(["why_it_matters", "observable_standard", "completion_check"]);
  });
});
