import { describe, it, expect } from "vitest";
import {
  BOUNDARY_GROUNDING_JSON_SCHEMA,
  DECISION_STAGES,
  boundaryTokenKey,
  learnerFacingSurfaces,
  validateBoundaryGrounding,
  type ProviderBoundaryGrounding,
} from "./boundaryGrounding";
import { PROVIDER_SCENARIO_JSON_SCHEMA, canonicalizeProviderScenario, validateProviderScenario } from "./providerDto";
import { toProviderDto } from "./providerDto.fixture";
import type { ArenaScenarioDraft } from "./types";
import type { BoundaryConstraint } from "./boundary";

/**
 * CONFIRMED-BOUNDARY GROUNDING — deterministic gate (Slice 3.2I-R5B1A.1-R2.21).
 *
 * Every case here reproduces the MEASURED c18 defect: the Manager confirmed "Two identifiers must
 * be verified before treatment", the generated scenario never mentioned it, no choice violated it
 * because no choice touched the subject, and everything downstream reported compliance. Silence
 * about a boundary is not compliance.
 *
 * This file covers what a pure function CAN decide: coverage, id fidelity, statement fidelity, a
 * declared effect at a real decision stage, and whether the rule's vocabulary reaches the scenario
 * at all. Whether the rule genuinely CONSTRAINS the judgment is the independent reviewer's call and
 * is tested in `semanticReview.test.ts` — lexical evidence is never sufficient on its own.
 */

const VERIFY: BoundaryConstraint = {
  id: "c1_verify",
  statement: "Two identifiers must be verified before treatment",
  provenance: "manager_entered",
};
const PRIVACY: BoundaryConstraint = {
  id: "c2_privacy",
  statement: "Private employee information cannot be disclosed",
  provenance: "manager_entered",
};

/** A c18-shaped draft in which the confirmed rule is established AND decided about. */
const groundedDraft: ArenaScenarioDraft = {
  title: "A backed-up ward and a waiting family",
  opening:
    "Three patients are waiting past their slot and a family is asking why. Two identifiers must be verified before treatment begins, and the nurse who normally does it is covering another bay.",
  primary: {
    choices: [
      { id: "p1", label: "Verify both identifiers yourself now and let the queue grow behind you" },
      { id: "p2", label: "Pull a second nurse in to verify both identifiers so the queue keeps moving" },
    ],
  },
  tradeoff: {
    escalationText: "A fourth patient arrives and the charge nurse asks for an estimate you cannot yet give.",
    choices: [
      { id: "ft1", label: "Give the charge nurse a conservative estimate and hold the current staffing" },
      { id: "ft2", label: "Ask to reassign a colleague from the discharge lounge and accept the gap it leaves" },
    ],
  },
  actionDecision: {
    prompt: "What will you do now?",
    choices: [
      { id: "fa1", label: "Tell the waiting family the expected delay and why the checks take time", isActionCommitment: true },
      { id: "fa2", label: "Wait for the charge nurse's decision before saying anything, accepting the family waits longer", isActionCommitment: false },
    ],
  },
  branches: {
    p1: {
      resultingWorldState: "You are doing the verification yourself and the queue has lengthened.",
      escalationText: "The charge nurse asks you to take a second bay while you are mid-check.",
      tradeoffChoices: [
        { id: "p1-t1", label: "Finish verifying both identifiers before taking the second bay, accepting the wait" },
        { id: "p1-t2", label: "Hand the check to a colleague and brief them fully before moving on" },
      ],
      actionDecision: {
        prompt: "What will you do now?",
        choices: [
          { id: "p1-a1", label: "Escalate the staffing shortfall to the charge nurse in writing now", isActionCommitment: true },
          { id: "p1-a2", label: "Absorb both bays this shift and raise it at handover instead", isActionCommitment: false },
        ],
      },
    },
    p2: {
      resultingWorldState: "A second nurse is verifying identifiers and the discharge lounge is short.",
      escalationText: "The discharge lounge reports a delay caused by the nurse you moved.",
      tradeoffChoices: [
        { id: "p2-t1", label: "Keep the second nurse verifying identifiers here and own the lounge delay" },
        { id: "p2-t2", label: "Send the nurse back and slow this queue instead, accepting the family waits" },
      ],
      actionDecision: {
        prompt: "What will you do now?",
        choices: [
          { id: "p2-a1", label: "Tell the lounge lead now what you moved and why", isActionCommitment: true },
          { id: "p2-a2", label: "Wait until the current checks finish before explaining, accepting the friction", isActionCommitment: false },
        ],
      },
    },
  },
};

/**
 * The SAME situation with every trace of the rule removed — c18 exactly as measured. Nothing here
 * BREAKS the rule; the scenario simply never engages with it, at any stage.
 */
const silentDraft: ArenaScenarioDraft = {
  ...groundedDraft,
  opening:
    "Three patients are waiting past their slot and a family is asking why. The nurse who normally covers this bay is helping in another one, and the charge nurse wants an estimate.",
  primary: {
    choices: [
      { id: "p1", label: "Take the next patient through yourself and let the queue grow behind you" },
      { id: "p2", label: "Pull a second nurse in so the queue keeps moving" },
    ],
  },
  branches: {
    p1: {
      resultingWorldState: "You are handling the next patient yourself and the queue has lengthened.",
      escalationText: "The charge nurse asks you to take a second bay while you are mid-way through.",
      tradeoffChoices: [
        { id: "p1-t1", label: "Finish the current patient before taking the second bay, accepting the wait" },
        { id: "p1-t2", label: "Hand over to a colleague and brief them fully before moving on" },
      ],
      actionDecision: {
        prompt: "What will you do now?",
        choices: [
          { id: "p1-a1", label: "Escalate the staffing shortfall to the charge nurse in writing now", isActionCommitment: true },
          { id: "p1-a2", label: "Absorb both bays this shift and raise it at handover instead", isActionCommitment: false },
        ],
      },
    },
    p2: {
      resultingWorldState: "A second nurse is covering here and the discharge lounge is short.",
      escalationText: "The discharge lounge reports a delay caused by the nurse you moved.",
      tradeoffChoices: [
        { id: "p2-t1", label: "Keep the second nurse here and own the lounge delay" },
        { id: "p2-t2", label: "Send the nurse back and slow this queue instead, accepting the family waits" },
      ],
      actionDecision: {
        prompt: "What will you do now?",
        choices: [
          { id: "p2-a1", label: "Tell the lounge lead now what you moved and why", isActionCommitment: true },
          { id: "p2-a2", label: "Wait until the current patient finishes before explaining, accepting the friction", isActionCommitment: false },
        ],
      },
    },
  },
};

/** The rule stated in the opening but touching no decision — decorative compliance. */
const decorativeDraft: ArenaScenarioDraft = {
  ...silentDraft,
  opening: `${silentDraft.opening} Two identifiers must be verified before treatment.`,
};

const grounding = (over: Partial<ProviderBoundaryGrounding> = {}): ProviderBoundaryGrounding => ({
  boundaryId: "c1_verify",
  boundaryStatement: "Two identifiers must be verified before treatment",
  scenarioPresence: "The opening establishes that two identifiers are verified before treatment begins.",
  operationalEffect: "No option may begin treatment before both identifiers are verified; the decision is who verifies and what the pause costs.",
  affectedDecisionStages: ["opening", "primary", "branch_tradeoff"],
  prohibitedAlternativeExcluded: "Beginning treatment and verifying afterwards is never offered as a choice.",
  remainingJudgmentDimensions: ["sequencing", "staffing", "notification order"],
  ...over,
});

const run = (g: unknown, cs: BoundaryConstraint[] = [VERIFY], d: ArenaScenarioDraft = groundedDraft) =>
  validateBoundaryGrounding(g, cs, d);

// ---------------------------------------------------------------------------
// 1-3. BOUNDARY TRANSPORT
// ---------------------------------------------------------------------------

describe("boundary transport", () => {
  it("1. every confirmed boundary reaches the provider DTO and survives canonicalization", () => {
    const dto = toProviderDto(groundedDraft, undefined, [grounding(), grounding({ boundaryId: "c2_privacy", boundaryStatement: PRIVACY.statement })]);
    const v = validateProviderScenario(dto);
    expect(v.ok).toBe(true);
    const canonical = canonicalizeProviderScenario((v as { value: typeof dto }).value);
    expect(canonical.boundaryGrounding).toHaveLength(2);
    expect(canonical.boundaryGrounding.map((g) => g.boundaryId)).toEqual(["c1_verify", "c2_privacy"]);
  });

  it("2. exact boundary ids are preserved — never renamed, reordered away or slugged", () => {
    const dto = toProviderDto(groundedDraft, undefined, [grounding()]);
    const v = validateProviderScenario(dto);
    const canonical = canonicalizeProviderScenario((v as { value: typeof dto }).value);
    expect(canonical.boundaryGrounding[0].boundaryId).toBe(VERIFY.id);
    expect(canonical.boundaryGrounding[0].boundaryStatement).toBe(VERIFY.statement);
  });

  it("2b. grounding rides OUTSIDE the canonical draft, so it can never be persisted or rendered", () => {
    const dto = toProviderDto(groundedDraft, undefined, [grounding()]);
    const v = validateProviderScenario(dto);
    const { draft } = canonicalizeProviderScenario((v as { value: typeof dto }).value);
    expect(JSON.stringify(draft)).not.toContain("boundaryGrounding");
    expect(JSON.stringify(draft)).not.toContain("operationalEffect");
    expect(JSON.stringify(draft)).not.toContain("c1_verify");
  });

  it("3. an id the Manager never confirmed is rejected", () => {
    expect(run([grounding({ boundaryId: "c9_invented" })]).errors).toContain("unknown_boundary_reference");
  });

  it("3b. a grounding declaration when NO boundary was confirmed is rejected", () => {
    expect(run([grounding()], []).errors).toContain("unknown_boundary_reference");
  });

  it("3c. a confirmed boundary with no declaration at all is rejected", () => {
    expect(run([]).errors).toContain("missing_boundary_reference");
    expect(run(undefined).errors).toContain("grounding_missing");
  });

  it("3d. one of two confirmed boundaries left undeclared is rejected", () => {
    expect(run([grounding()], [VERIFY, PRIVACY]).errors).toContain("missing_boundary_reference");
  });

  it("3e. the same boundary declared twice is rejected", () => {
    expect(run([grounding(), grounding()]).errors).toContain("grounding_duplicate_boundary");
  });

  it("3f. a weakened restatement of the confirmed rule is rejected", () => {
    // "where practical" is exactly how a non-negotiable rule quietly becomes advisory.
    expect(run([grounding({ boundaryStatement: "Follow the usual checks where practical" })]).errors).toContain("grounding_statement_altered");
  });
});

// ---------------------------------------------------------------------------
// 6-13. GROUNDING
// ---------------------------------------------------------------------------

describe("grounding", () => {
  it("6. THE c18 DEFECT — a rule absent from the scenario is rejected even though nothing violates it", () => {
    const r = run([grounding()], [VERIFY], silentDraft);
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("confirmed_boundary_absent");
  });

  it("7/13. a rule mentioned in the opening but touching no decision is VACUOUS", () => {
    const r = run([grounding()], [VERIFY], decorativeDraft);
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("vacuous_boundary_compliance");
    expect(r.errors).not.toContain("confirmed_boundary_absent"); // it IS present — just inert
  });

  it("8/12. a rule that materially constrains the choices across stages is ACCEPTED", () => {
    expect(run([grounding()])).toEqual({ ok: true, errors: [] });
  });

  it("declaring only the opening as affected is not operationalization", () => {
    expect(run([grounding({ affectedDecisionStages: ["opening"] })]).errors).toContain("boundary_not_operationalized");
    expect(run([grounding({ affectedDecisionStages: [] })]).errors).toContain("boundary_not_operationalized");
  });

  it("a declaration with no named effect or no excluded alternative is not operationalization", () => {
    expect(run([grounding({ operationalEffect: "" })]).errors).toContain("boundary_not_operationalized");
    expect(run([grounding({ prohibitedAlternativeExcluded: "" })]).errors).toContain("boundary_not_operationalized");
    expect(run([grounding({ scenarioPresence: "  " })]).errors).toContain("boundary_not_operationalized");
  });

  it("a rule that leaves NO judgment should have been a no-safe result, not a scenario", () => {
    expect(run([grounding({ remainingJudgmentDimensions: [] })]).errors).toContain("grounding_missing_remaining_judgment");
  });

  it("fails closed on a malformed declaration rather than skipping it", () => {
    expect(run([null]).errors).toContain("grounding_malformed");
    expect(run([{ boundaryId: "" }]).errors).toContain("grounding_malformed");
    expect(run("not-an-array").errors).toContain("grounding_missing");
  });

  it("no confirmed boundary and no declaration is simply nothing to ground", () => {
    expect(validateBoundaryGrounding([], [], groundedDraft)).toEqual({ ok: true, errors: [] });
  });
});

// ---------------------------------------------------------------------------
// 18-22. C18 REGRESSION CONTRACT
// ---------------------------------------------------------------------------

describe("c18 — two-identifier verification", () => {
  it("18. the measured c18 output (rule never mentioned) is REJECTED", () => {
    expect(run([grounding()], [VERIFY], silentDraft).ok).toBe(false);
  });

  it("21. sequencing and staffing choices that preserve verification are ACCEPTED", () => {
    // The rehearsal space c18 was supposed to have: who verifies, when the queue pauses, who covers.
    const r = run([grounding()]);
    expect(r.ok).toBe(true);
    const { decisions } = learnerFacingSurfaces(groundedDraft);
    expect(decisions).toMatch(/verify both identifiers/i);
  });

  it("22. branches keep the rule in play after the primary consequence", () => {
    const branchText = Object.values(groundedDraft.branches!)
      .flatMap((b) => b.tradeoffChoices.map((c) => c.label))
      .join(" ");
    expect(branchText).toMatch(/verif/i);
    expect(run([grounding()]).ok).toBe(true);
  });

  it("difficulty is preserved — no option decides WHETHER to verify", () => {
    const all = [
      ...groundedDraft.primary.choices,
      ...groundedDraft.tradeoff.choices,
      ...groundedDraft.actionDecision.choices,
      ...Object.values(groundedDraft.branches!).flatMap((b) => [...b.tradeoffChoices, ...b.actionDecision.choices]),
    ].map((c) => c.label.toLowerCase());
    for (const label of all) {
      expect(label).not.toMatch(/skip|bypass|without verifying|verify (it )?later|treat first/);
    }
  });
});

// ---------------------------------------------------------------------------
// Lexical matcher — a NECESSARY condition, honestly bounded
// ---------------------------------------------------------------------------

describe("lexical evidence is coarse by design", () => {
  it("equates the morphology a rule actually varies over", () => {
    expect(boundaryTokenKey("verify")).toBe(boundaryTokenKey("verified"));
    expect(boundaryTokenKey("verify")).toBe(boundaryTokenKey("verification"));
    expect(boundaryTokenKey("identity")).toBe(boundaryTokenKey("identifiers"));
  });

  it("does not treat a rule's connective words as evidence", () => {
    // "must ... before ..." appears in every rule; matching on it would make anything look grounded.
    const r = run([grounding({ boundaryStatement: VERIFY.statement })], [VERIFY], {
      ...silentDraft,
      opening: "You must decide before the shift ends and every option has a cost.",
    });
    expect(r.errors).toContain("confirmed_boundary_absent");
  });

  it("separates the stage that ESTABLISHES a rule from the stages it must BITE", () => {
    const s = learnerFacingSurfaces(groundedDraft);
    expect(s.opening).toContain("Two identifiers must be verified");
    expect(s.decisions).not.toContain("Three patients are waiting past their slot");
    expect(s.decisions).toContain("Pull a second nurse in to verify both identifiers");
  });
});

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

describe("strict provider schema", () => {
  it("declares boundaryGrounding as a required array with every field named", () => {
    expect(PROVIDER_SCENARIO_JSON_SCHEMA.required).toContain("boundaryGrounding");
    expect(PROVIDER_SCENARIO_JSON_SCHEMA.properties.boundaryGrounding.type).toBe("array");
    const item = BOUNDARY_GROUNDING_JSON_SCHEMA.items;
    expect(item.additionalProperties).toBe(false);
    expect(item.required).toEqual(Object.keys(item.properties));
  });

  it("constrains affectedDecisionStages to the known stages", () => {
    expect(BOUNDARY_GROUNDING_JSON_SCHEMA.items.properties.affectedDecisionStages.items.enum).toEqual(DECISION_STAGES);
  });
});
