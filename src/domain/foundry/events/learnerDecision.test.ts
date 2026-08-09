import { describe, it, expect } from "vitest";
import { resolveDecisionResponse, validateDecisionResponse } from "./foundry-training";
import { journeyActionDecision } from "@/domain/foundry/module/journey";
import type { RealityGroundedJourneyV1 } from "@/domain/foundry/module/journey";

/**
 * SLICE 3.2M-1 — a decision someone READ is not a decision they MADE.
 *
 * The gate is driven by the frozen published journey, so a client cannot invent the
 * requirement and cannot escape it.
 */
const el = (kind: string, content: string, status: "grounded" | "needs_confirmation" = "grounded") => ({
  id: `el_${kind}`,
  kind,
  content,
  confirmationStatus: status,
  grounding: [{ field: "problem", sourceType: "host_statement" }],
});

const journey = (elements: unknown[]) =>
  ({ version: 1, displayTitle: "T", displayTitleStatus: "grounded", elements } as unknown as RealityGroundedJourneyV1);

describe("[3.2M-1] which trainings ask for a decision", () => {
  it("a grounded action_decision asks for one", () => {
    expect(journeyActionDecision(journey([el("action_decision", "I will state each open item.")]))).toBe(
      "I will state each open item.",
    );
  });

  it("no action_decision asks for none — legacy trainings are untouched", () => {
    expect(journeyActionDecision(journey([el("why_it_matters", "x")]))).toBeNull();
    expect(journeyActionDecision(undefined)).toBeNull();
  });

  it("an UNCONFIRMED or empty section asks for none — never demand a decision for text nobody saw", () => {
    expect(journeyActionDecision(journey([el("action_decision", "draft", "needs_confirmation")]))).toBeNull();
    expect(journeyActionDecision(journey([el("action_decision", "   ")]))).toBeNull();
  });
});

describe("[3.2M-1] the gate", () => {
  it("required when the program asks: empty, blank and missing all refuse", () => {
    for (const raw of [undefined, null, "", "   ", 42]) {
      const r = resolveDecisionResponse("I will state each open item.", raw);
      expect(r.ok, JSON.stringify(raw)).toBe(false);
      if (!r.ok) expect(r.reason).toBe("decision_required");
    }
  });

  it("a real decision passes, trimmed", () => {
    const r = resolveDecisionResponse("ctx", "  I will say the two open items before I leave.   ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("I will say the two open items before I leave.");
  });

  it("not asked → nothing stored, and any client-sent value is ignored", () => {
    for (const ctx of [null, undefined, "   "]) {
      const r = resolveDecisionResponse(ctx, "I tried to submit a decision anyway");
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value, "an unasked decision must not be stored").toBeNull();
    }
  });

  it("its refusal is its own, never the reflection's", () => {
    const r = validateDecisionResponse(undefined);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("decision_required");
  });

  it("nothing a learner types can carry a higher rung — the gate returns text and only text", () => {
    const r = resolveDecisionResponse("ctx", "I practiced it and my manager observed me doing it.");
    expect(r.ok).toBe(true);
    if (r.ok) expect(typeof r.value).toBe("string");
  });
});
