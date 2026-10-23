import { describe, expect, it } from "vitest";
import catalog from "./catalog.json";
import { applyPilotAction, blankAnswers, initialAnswers, publicCase, referenceFor, releasedReference, startPilot, type AuthorCase } from "./pilot";

const c = catalog[22] as AuthorCase;
const reference = referenceFor(c);
const start = () => startPilot("attempt", publicCase(c), "hash", "start", "2026-10-23T10:00:00Z", false);
const answers = { evaluation: "  Check proximal contact.  ", diagnosis: "Open contact; cause uncertain.", plan: "Evaluate #29 restoration.", rationale: "Preserve a functioning crown if appropriate." };
describe("author pilot capture", () => {
  it("has 23 source-attributed drafts with no reference in any public projection", () => {
    expect(new Set(catalog.map(c => c.caseId)).size).toBe(23);
    for (const c of catalog as AuthorCase[]) {
      expect(c.authorOriginal.length).toBeGreaterThan(10);
      expect(c.authorParaphrase.length).toBeGreaterThan(10);
      expect(c.sourceSections.length).toBeGreaterThan(0);
      expect(publicCase(c)).not.toHaveProperty("authorOriginal");
      expect(publicCase(c)).not.toHaveProperty("authorParaphrase");
      expect(referenceFor(c).reviewStatus).toBe("author-paraphrase-awaiting-review");
    }
  });
  it("preserves original whitespace and the raw-event prefix when submitting", () => {
    const draft = applyPilotAction(start(), { operation: "save", answers }, "draft", "2026-10-23T10:01:00Z", reference);
    expect(releasedReference(draft)).toBeNull();
    const submitted = applyPilotAction(draft, { operation: "submit", answers }, "submit", "2026-10-23T10:02:00Z", reference);
    expect(submitted.events.slice(0, draft.events.length)).toEqual(draft.events);
    expect(initialAnswers(submitted)).toEqual(answers);
    expect(releasedReference(submitted)).toEqual(reference);
    expect(submitted.events.map(e => e.type)).toEqual(["case_presented", "draft_saved", "reasoning_submitted", "reference_released"]);
  });
  it("refuses incomplete submissions and cannot expose a reference through a reaction before submission", () => {
    expect(() => applyPilotAction(start(), { operation: "submit", answers: { ...blankAnswers(), evaluation: "  " } }, "s", "now", reference)).toThrow("REASONING_REQUIRED");
    expect(() => applyPilotAction(start(), { operation: "react", reaction: { helpful: "no", comment: "x", revisedPlan: "" } }, "r", "now", reference)).toThrow("IMMUTABLE");
  });
  it("freezes the initial response while keeping a reaction and revised plan separate", () => {
    const submitted = applyPilotAction(start(), { operation: "submit", answers }, "s", "2026-10-23T10:02:00Z", reference);
    expect(() => applyPilotAction(submitted, { operation: "save", answers: blankAnswers() }, "edit", "later", reference)).toThrow("IMMUTABLE");
    const completed = applyPilotAction(submitted, { operation: "react", reaction: { helpful: "partly", comment: "Different priority", revisedPlan: "Assess bite too" } }, "r", "2026-10-23T10:03:00Z", reference);
    expect(initialAnswers(completed)).toEqual(answers);
    expect(completed.events.slice(0, submitted.events.length)).toEqual(submitted.events);
    expect(completed.phase).toBe("completed");
    expect(() => applyPilotAction(completed, { operation: "submit", answers }, "new", "later", reference)).toThrow("IMMUTABLE");
  });
  it("retries the same request without duplicate events or replacement of the first response", () => {
    const submitted = applyPilotAction(start(), { operation: "submit", answers }, "same", "then", reference);
    expect(applyPilotAction(submitted, { operation: "submit", answers: blankAnswers() }, "same", "later", reference)).toBe(submitted);
  });
});
