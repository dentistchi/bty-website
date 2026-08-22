import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyRealityIntentReadiness, hasRealityIntentGap } from "./reality-intent";
import type { RealityGroundedJourneyV1 } from "./journey";
import type { BuilderAnswers } from "./module-builder";

/**
 * R4-R7A — declared Host intent vs delivered capability.
 *
 * Measured on production before this slice: 30 of 32 module-bearing trainings scheduled a
 * follow-up, 4 had a real-work action, and publish validated none of it because the check sat
 * inside `if (journeyEnabled)`. The rule below is the repair — and, just as importantly, the
 * 24 knowledge-oriented trainings it must leave completely alone.
 */

const el = (kind: string, content: string, status: "grounded" | "needs_confirmation" = "grounded") =>
  ({ id: `e-${kind}`, kind, content, grounding: [], confirmationStatus: status }) as unknown as
    RealityGroundedJourneyV1["elements"][number];
const J = (...elements: RealityGroundedJourneyV1["elements"]) =>
  ({ elements, displayTitle: "t" }) as unknown as RealityGroundedJourneyV1;
const A = (o: Partial<BuilderAnswers>) => o as BuilderAnswers;

describe("T1/T2/T3 — legitimate learning-only training is untouched", () => {
  it("T1 — know-only, no follow-up → nothing requested, nothing missing", () => {
    const r = classifyRealityIntentReadiness(A({ learningNeeds: ["know"], followUpDays: 0 }), undefined);
    expect(r.followUpRequested).toBe(false);
    expect(r.decisionRequested).toBe(false);
    expect(r.missing).toEqual([]);
    expect(hasRealityIntentGap(r)).toBe(false);
  });

  it("T2 — shared_standard-only with NO journey at all → still nothing missing", () => {
    const r = classifyRealityIntentReadiness(A({ learningNeeds: ["shared_standard"], followUpDays: 0 }), undefined);
    expect(r.missing).toEqual([]);
  });

  it("T3 — practice-only: no field_application is invented for it", () => {
    const r = classifyRealityIntentReadiness(
      A({ learningNeeds: ["practice"], arenaRecommended: true, followUpDays: 0 }),
      undefined,
    );
    expect(r.missing).toEqual([]);
  });

  it("a journey may be absent entirely without that being a fault", () => {
    expect(classifyRealityIntentReadiness(A({}), undefined).missing).toEqual([]);
    expect(classifyRealityIntentReadiness(undefined, undefined).missing).toEqual([]);
  });
});

describe("T4–T8 — follow-up intent vs a real-work action", () => {
  it("T4 — follow-up + grounded field_application → ready", () => {
    const r = classifyRealityIntentReadiness(
      A({ followUpDays: 7 }),
      J(el("field_application", "Ask the next patient to say it back")),
    );
    expect(r.followUpRequested).toBe(true);
    expect(r.fieldActionReady).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it("T5 — follow-up + NO journey → the gap is classified (this is the 26-row case)", () => {
    const r = classifyRealityIntentReadiness(A({ followUpDays: 7 }), undefined);
    expect(r.missing).toEqual(["field_action"]);
  });

  it("T5b — follow-up + journey WITHOUT field_application → same gap", () => {
    const r = classifyRealityIntentReadiness(A({ followUpDays: 7 }), J(el("why_it_matters", "x")));
    expect(r.missing).toEqual(["field_action"]);
  });

  it("a needs_confirmation element is not a capability", () => {
    const r = classifyRealityIntentReadiness(
      A({ followUpDays: 7 }),
      J(el("field_application", "drafted", "needs_confirmation")),
    );
    expect(r.fieldActionReady).toBe(false);
    expect(r.missing).toEqual(["field_action"]);
  });

  it("an empty grounded element is not a capability either", () => {
    const r = classifyRealityIntentReadiness(A({ followUpDays: 7 }), J(el("field_application", "   ")));
    expect(r.missing).toEqual(["field_action"]);
  });

  it("T8 — followUpDays 30 obeys the same capability rule, and is NOT Apply's fixed 7", () => {
    expect(classifyRealityIntentReadiness(A({ followUpDays: 30 }), undefined).missing).toEqual(["field_action"]);
    const dom = readFileSync(join(process.cwd(), "src/domain/foundry/apply-window/applyWindow.ts"), "utf8");
    expect(dom).toContain("export const APPLY_WINDOW_DAYS = 7 as const;");
    const src = readFileSync(join(process.cwd(), "src/domain/foundry/module/reality-intent.ts"), "utf8");
    expect(src).not.toMatch(/APPLY_WINDOW_DAYS|\b7\b/); // the classifier never conflates the clocks
  });

  it("followUpDays 0 / absent requests nothing", () => {
    expect(classifyRealityIntentReadiness(A({ followUpDays: 0 }), undefined).followUpRequested).toBe(false);
    expect(classifyRealityIntentReadiness(A({}), undefined).followUpRequested).toBe(false);
  });
});

describe("T9/T10/T13 — decision intent", () => {
  it("T9 — decide + grounded action_decision → ready", () => {
    const r = classifyRealityIntentReadiness(
      A({ learningNeeds: ["decide"], followUpDays: 0 }),
      J(el("action_decision", "Decide who confirms understanding")),
    );
    expect(r.decisionReady).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it("T10 — decide declared, none defined → the gap is classified (the 6-row case)", () => {
    const r = classifyRealityIntentReadiness(A({ learningNeeds: ["decide"], followUpDays: 0 }), undefined);
    expect(r.missing).toEqual(["decision"]);
  });

  it("T13 — no decide intent → a missing action_decision is NOT a warning", () => {
    const r = classifyRealityIntentReadiness(
      A({ learningNeeds: ["know", "shared_standard"], followUpDays: 0 }),
      J(el("why_it_matters", "x")),
    );
    expect(r.decisionRequested).toBe(false);
    expect(r.missing).toEqual([]);
  });

  it("both gaps report together, in a stable order", () => {
    const r = classifyRealityIntentReadiness(A({ learningNeeds: ["decide"], followUpDays: 7 }), undefined);
    expect(r.missing).toEqual(["field_action", "decision"]);
  });
});

describe("the rule never demands a Journey, and never demands the always-required kinds", () => {
  it("why_it_matters / observable_standard / completion_check are not this rule's business", () => {
    const src = readFileSync(join(process.cwd(), "src/domain/foundry/module/reality-intent.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/why_it_matters|observable_standard|completion_check|scenario/);
    // It reads exactly the two capability sources.
    expect(code).toContain("journeyFieldApplication");
    expect(code).toContain("journeyActionDecision");
  });

  it("it is pure — no I/O and no UI strings", () => {
    const src = readFileSync(join(process.cwd(), "src/domain/foundry/module/reality-intent.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/supabase|fetch\(|from\(|console\./);
    expect(code).not.toMatch(/"[A-Z][a-z]+ [a-z]/); // no sentence-shaped literals
  });
});
