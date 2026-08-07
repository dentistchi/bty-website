import { describe, it, expect } from "vitest";
import { validateDraftPatch } from "./module-builder";
import { SNAPSHOT_ANSWER_KEYS, buildModuleSnapshot } from "./module-publish";

/**
 * SLICE 3.2L-R11.1 — the durable adoption marker.
 *
 * The receipt (`applied_at`) lives in another table, written by a second statement with no
 * transaction. This marker is what makes the adoption fact recoverable exactly rather than
 * guessed, so its validation and its exclusion from the published snapshot are load-bearing.
 */
const ATTEMPT = "15108cf3-0c72-4dea-ba1f-aa54f98ca0e1";

describe("[3.2L-R11.1] adoption marker", () => {
  it("G6: only a real attempt id survives validation — nothing arbitrary can be stamped", () => {
    const ok = validateDraftPatch({ answers: { programAdoptionV1: { attemptId: ATTEMPT } } });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.answers?.programAdoptionV1).toEqual({ attemptId: ATTEMPT });

    for (const bad of [
      { attemptId: "not-a-uuid" },
      { attemptId: "" },
      { attemptId: 42 },
      { attemptId: `${ATTEMPT}' or 1=1--` },
      {},
      null,
      "string",
    ]) {
      const r = validateDraftPatch({ answers: { programAdoptionV1: bad } as never });
      expect(r.ok, JSON.stringify(bad)).toBe(false);
      if (!r.ok) expect(r.errors).toContain("program_adoption_invalid");
    }
  });

  it("an unknown answers key still cannot reach the draft", () => {
    const r = validateDraftPatch({ answers: { somethingElse: "x" } as never });
    if (r.ok) expect(Object.keys(r.value.answers ?? {})).not.toContain("somethingElse");
  });

  it("the marker is an audit link, never participant content", () => {
    expect(SNAPSHOT_ANSWER_KEYS).not.toContain("programAdoptionV1" as never);
    const snap = buildModuleSnapshot({ problem: "p", programAdoptionV1: { attemptId: ATTEMPT } });
    expect(JSON.stringify(snap)).not.toContain(ATTEMPT);
    expect(JSON.stringify(snap)).not.toContain("programAdoptionV1");
  });

  it("it travels on the SAME row update as the journey", () => {
    // One patch, both facts — so a partial write cannot separate them.
    const r = validateDraftPatch({
      answers: {
        programAdoptionV1: { attemptId: ATTEMPT },
        realityGroundedJourneyV1: {
          version: 1,
          displayTitle: "T",
          displayTitleStatus: "grounded",
          elements: [
            { id: "el_why_it_matters", kind: "why_it_matters", content: "c", grounding: [{ sourceType: "ai_proposed", field: "problem" }], confirmationStatus: "grounded" },
            { id: "el_observable_standard", kind: "observable_standard", content: "c", grounding: [{ sourceType: "ai_proposed", field: "observableBehavior" }], confirmationStatus: "grounded" },
            { id: "el_completion_check", kind: "completion_check", content: "c", grounding: [{ sourceType: "ai_proposed", field: "completionPrompt" }], confirmationStatus: "grounded" },
          ],
        },
      } as never,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.answers?.programAdoptionV1?.attemptId).toBe(ATTEMPT);
      expect(r.value.answers?.realityGroundedJourneyV1).toBeDefined();
    }
  });
});
