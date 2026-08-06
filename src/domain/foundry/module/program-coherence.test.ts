import { describe, it, expect } from "vitest";
import {
  validateBehaviorContract,
  renderStandardSentence,
  isMetaStandardText,
  validateProgramDependencies,
  validateScenarioContract,
  renderScenarioSentence,
  deriveOperationalConstruct,
  isNarrativeKind,
  isInstructionalKind,
  renderDecisionSentence,
  renderApplicationSentence,
  renderCompletionQuestion,
  renderFollowUpSentence,
  validateApplicationContract,
  nounStem,
  VERIFICATION_TARGETS,
  RESPONSE_MODES,
  definiteConstructs,
  ungroundedExistingEntity,
  ARTIFACT_NOUNS,
  CONSTRUCT_NOUNS,
  type BehaviorContract,
  type ProgramSection,
  type ScenarioContract,
} from "./program-coherence";

/**
 * Slice 3.2L-R4 — the gates the fifth live window proved were missing.
 *
 * The window returned a structurally perfect program (7/7 elements, strict schema, no
 * fabricated artifact) that was not a usable training program. Every fixture below marked
 * LIVE is the exact text a Founder read on a physical iPhone, not an invented example.
 */

/** LIVE — the standard the Host was actually shown. */
const LIVE_STANDARD =
  "A shared handoff standard is created and utilized by team members during all relevant transitions of work.";
/** LIVE — the closing question that arrived after the participant was told to use it. */
const LIVE_COMPLETION_CHECK =
  "What specific elements will you include in the shared handoff standard to ensure all team members are informed and aligned?";
/** LIVE — the application step that depended on a standard nobody had defined. */
const LIVE_APPLY =
  "During the next project handoff meeting, I will actively use the shared handoff standard to ensure all necessary information is communicated clearly.";

/** A contract that satisfies all four roles — synthetic, never written to any draft. */
const GOOD: BehaviorContract = {
  actor: "the outgoing team member",
  trigger: "At the end of every shift, before leaving the floor",
  observableAction: "states each unfinished task, its deadline and its risk out loud to the person taking over",
  completionSignal: "the person taking over repeats the list back and confirms they have it",
};

const raw = (c: Partial<Record<string, unknown>> = {}) => ({
  actor: GOOD.actor,
  trigger: GOOD.trigger,
  observable_action: GOOD.observableAction,
  completion_signal: GOOD.completionSignal,
  ...c,
});

describe("[3.2L-R4] G2 — a complete behavioral contract is accepted", () => {
  it("accepts actor + trigger + observable action + completion signal", () => {
    const r = validateBehaviorContract(raw());
    expect(r.ok, r.ok ? "" : `${r.defect.field}:${r.defect.reason}`).toBe(true);
  });

  it("renders one sentence that carries all four fields", () => {
    const s = renderStandardSentence(GOOD);
    expect(s).toContain("the outgoing team member");
    expect(s).toContain("out loud to the person taking over");
    expect(s).toContain("It is complete when");
    expect(s).toContain("confirms they have it");
    // The rendered standard can never overflow the 700-character element ceiling.
    expect(s.length).toBeLessThanOrEqual(700);
  });

  it("the rendered sentence is not itself meta", () => {
    expect(isMetaStandardText(renderStandardSentence(GOOD))).toBe(false);
  });
});

describe("[3.2L-R4] G1 — the exact live meta-standard is refused", () => {
  it("refuses it as free text, passive voice and all", () => {
    expect(isMetaStandardText(LIVE_STANDARD)).toBe(true);
  });

  it("a time marker does not redeem it", () => {
    // The live sentence carried "during all relevant transitions of work" and was still
    // meta. Saying WHEN a standard gets created adds no observable behavior.
    expect(LIVE_STANDARD).toMatch(/during/i);
    expect(isMetaStandardText(LIVE_STANDARD)).toBe(true);
  });

  it("refuses the same meaning expressed as a contract", () => {
    const r = validateBehaviorContract(
      raw({
        actor: "team members",
        trigger: "during all relevant transitions of work",
        observable_action: "a shared handoff standard is created and utilized",
        completion_signal: "the standard is created and utilized",
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.defect.field).toBe("observableAction");
  });

  it("the old word-count bar would have passed it — this one does not", () => {
    expect(LIVE_STANDARD.split(/\s+/).filter(Boolean).length).toBeGreaterThanOrEqual(4);
    expect(isMetaStandardText(LIVE_STANDARD)).toBe(true);
  });
});

describe("[3.2L-R4] G3 — meta creation only", () => {
  it("refuses 'Create and implement a shared process.'", () => {
    const r = validateBehaviorContract(raw({ observable_action: "Create and implement a shared process." }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.defect).toEqual({ field: "observableAction", reason: "meta_only" });
  });

  it("refuses a bare instruction to use the construct", () => {
    for (const bare of ["uses the shared handoff standard", "will follow the agreed process", "applies the new framework"]) {
      const r = validateBehaviorContract(raw({ observable_action: bare }));
      expect(r.ok, `expected refusal for: ${bare}`).toBe(false);
    }
  });

  it("refuses a completion signal that is only the construct existing", () => {
    const r = validateBehaviorContract(raw({ completion_signal: "the shared standard has been established" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.defect.field).toBe("completionSignal");
  });
});

describe("[3.2L-R4] each contract role is checked for a DIFFERENT property", () => {
  it("a missing field is a defect, whichever it is", () => {
    for (const f of ["actor", "trigger", "observable_action", "completion_signal"]) {
      const r = validateBehaviorContract(raw({ [f]: "" }));
      expect(r.ok, `expected refusal for empty ${f}`).toBe(false);
      if (!r.ok) expect(r.defect.reason).toBe("missing");
    }
  });

  it("the actor must be a person, not the construct performing itself", () => {
    const r = validateBehaviorContract(raw({ actor: "the shared handoff standard" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.defect).toEqual({ field: "actor", reason: "not_a_role" });
  });

  it("the trigger must place the behavior in time", () => {
    const r = validateBehaviorContract(raw({ trigger: "in a professional manner" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.defect).toEqual({ field: "trigger", reason: "no_moment" });
  });

  it("the completion signal must be something a second person could witness", () => {
    const r = validateBehaviorContract(raw({ completion_signal: "the handoff feels smoother for everyone" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.defect).toEqual({ field: "completionSignal", reason: "no_confirmation" });
  });

  it("an over-long field is bounded", () => {
    const r = validateBehaviorContract(raw({ actor: "x".repeat(400) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.defect.reason).toBe("too_long");
  });

  it("no single weak proxy decides it — the live sentence passes all four", () => {
    // word count, an action verb, non-passive vocabulary and keyword overlap with the
    // Host's own words are each individually satisfied by the sentence that shipped.
    expect(LIVE_STANDARD.split(/\s+/).length).toBeGreaterThan(4);
    expect(/\b(created|utilized)\b/.test(LIVE_STANDARD)).toBe(true);
    expect(LIVE_STANDARD.toLowerCase()).toContain("handoff");
    expect(isMetaStandardText(LIVE_STANDARD)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Operational construct lifecycle
// ---------------------------------------------------------------------------

/** The canonical draft's own grounding corpus, lower-cased as the validator builds it. */
const CORPUS = "our handoffs are inconsistent. create a shared handoff standard. handoff record";

describe("[3.2L-R4] G8/G9/G10 — construct lifecycle", () => {
  it("G8: an unprovided existing artifact is still a fabrication", () => {
    expect(ungroundedExistingEntity("I will use the handoff record template at the next meeting.", CORPUS)).toBe("template");
  });

  it("G8: an availability claim is still a fabrication", () => {
    // The greedy matcher reports the HEAD noun of the phrase — "tools and templates"
    // resolves to `template`. Both are ungrounded; naming the head is what stops the R2
    // live miss, where a lazy match stopped at a grounded modifier and never looked further.
    expect(ungroundedExistingEntity("There is access to the necessary tools and templates.", CORPUS)).toBe("template");
  });

  it("G9: proposing a new construct is allowed", () => {
    expect(ungroundedExistingEntity("Create a shared handoff standard with the team.", CORPUS)).toBeNull();
    expect(ungroundedExistingEntity("Agree on a new process for handovers.", CORPUS)).toBeNull();
  });

  it("G9: a construct is NOT treated as an existing resource merely for being definite", () => {
    // "the shared handoff standard" presupposes no file, no tool and no policy — it is a
    // way of working the program may propose. This is why the construct nouns were kept
    // OUT of ARTIFACT_NOUNS.
    expect(ungroundedExistingEntity("The team follows the shared handoff standard.", CORPUS)).toBeNull();
    for (const n of ["standard", "process", "workflow", "guideline", "framework", "criteria", "agreement", "norm", "rubric"]) {
      expect(ARTIFACT_NOUNS as readonly string[]).not.toContain(n);
      expect(CONSTRUCT_NOUNS as readonly string[]).toContain(n);
    }
  });

  it("a construct asserted to ALREADY EXIST is a fabrication", () => {
    expect(ungroundedExistingEntity("Follow the existing escalation process.", CORPUS)).toBe("process");
    expect(ungroundedExistingEntity("Use the approved review criteria.", CORPUS)).toBe("criterion");
  });

  it("G10: a Host-grounded resource remains usable in its grounded scope", () => {
    // The Host's own successEvidence names a handoff record.
    expect(ungroundedExistingEntity("Complete the handoff record before you leave.", CORPUS)).toBeNull();
  });

  it("G10: a verified upload grounds the artifact it actually is", () => {
    const withUpload = `${CORPUS} handoff checklist.pdf`;
    expect(ungroundedExistingEntity("Work through the handoff checklist.", withUpload)).toBeNull();
    // …and grounds nothing else.
    expect(ungroundedExistingEntity("Open the escalation dashboard.", withUpload)).toBe("dashboard");
  });

  it("a conditional reference is not an existence claim", () => {
    expect(ungroundedExistingEntity("If your team has one, bring the checklist.", CORPUS)).toBeNull();
  });

  it("definite construct references are found; proposals are not", () => {
    expect(definiteConstructs("I will use the shared handoff standard tomorrow.")).toEqual(["standard"]);
    expect(definiteConstructs("I will help create a shared handoff standard.")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Whole-program dependency graph
// ---------------------------------------------------------------------------

const S = (kind: ProgramSection["kind"], content: string): ProgramSection => ({ kind, content });

/** A contract that NAMES the construct while defining its behavior. */
const DEFINING: BehaviorContract = {
  ...GOOD,
  observableAction: "follows the shared handoff standard by stating each unfinished task out loud to the person taking over",
};

describe("[3.2L-R4] G4–G7 — the program is an ordered dependency graph", () => {
  it("G4: a construct defined by the standard may be used later", () => {
    const d = validateProgramDependencies(
      [
        S("observable_standard", renderStandardSentence(DEFINING)),
        S("field_application", LIVE_APPLY),
      ],
      DEFINING,
      null,
    );
    expect(d).toBeNull();
  });

  it("G5: a construct that was never behaviorally defined may NOT be used", () => {
    const d = validateProgramDependencies(
      [
        // GOOD defines a behavior but never names a standard.
        S("observable_standard", renderStandardSentence(GOOD)),
        S("field_application", LIVE_APPLY),
      ],
      GOOD,
      null,
    );
    expect(d).not.toBeNull();
    expect(d).toMatchObject({ kind: "field_application", construct: "standard", branch: "used_before_defined" });
  });

  it("G5: the Host naming the topic does NOT count as defining it", () => {
    // The canonical draft's observableBehavior is "Create a shared handoff standard" —
    // that authorises BTY to PROPOSE the standard and says nothing about its steps. This
    // is precisely how the live program justified telling someone to use it.
    const d = validateProgramDependencies(
      [S("observable_standard", renderStandardSentence(GOOD)), S("action_decision", "I will apply the shared handoff standard on Monday.")],
      GOOD,
      null,
    );
    expect(d).toMatchObject({ branch: "used_before_defined" });
  });

  it("G6: the EXACT live inversion is refused as a whole program", () => {
    const d = validateProgramDependencies(
      [
        S("observable_standard", renderStandardSentence(DEFINING)),
        S("action_decision", "I will contribute to creating and implementing a shared handoff standard for our team."),
        S("field_application", LIVE_APPLY),
        S("completion_check", LIVE_COMPLETION_CHECK),
      ],
      DEFINING,
      null,
    );
    expect(d).not.toBeNull();
    expect(d).toMatchObject({ kind: "completion_check", construct: "standard", branch: "defined_after_use" });
  });

  it("G7: a completion check that verifies something already established is fine", () => {
    for (const ok of [
      "What will you say aloud at your next handoff that you did not say before?",
      "Which handoff this week will you use to practise stating the unfinished task first?",
      "How will you know the person taking over actually heard you?",
    ]) {
      const d = validateProgramDependencies(
        [
          S("observable_standard", renderStandardSentence(DEFINING)),
          S("field_application", LIVE_APPLY),
          S("completion_check", ok),
        ],
        DEFINING,
      );
      expect(d, `expected acceptance for: ${ok}`).toBeNull();
    }
  });

  it("a definition-seeking question is fine when nothing earlier required using it", () => {
    // Design work is legitimate. It is only inverted when an earlier section already told
    // the participant to use the thing.
    const d = validateProgramDependencies(
      [S("observable_standard", renderStandardSentence(DEFINING)), S("completion_check", LIVE_COMPLETION_CHECK)],
      DEFINING,
      null,
    );
    expect(d).toBeNull();
  });

  it("a scenario may not assume a construct nothing defined", () => {
    const d = validateProgramDependencies(
      [S("observable_standard", renderStandardSentence(GOOD)), S("scenario", "The shift ends and the agreed escalation process is already in dispute.")],
      GOOD,
      null,
    );
    expect(d).toMatchObject({ kind: "scenario", branch: "used_before_defined" });
  });

  it("with no validated contract, nothing is defined", () => {
    const d = validateProgramDependencies([S("field_application", LIVE_APPLY)], null, null);
    expect(d).toMatchObject({ branch: "used_before_defined" });
  });

  it("evaluates order, not array position", () => {
    // completion_check supplied BEFORE field_application in the array is still later in
    // the program, and must still be caught.
    const d = validateProgramDependencies(
      [
        S("completion_check", LIVE_COMPLETION_CHECK),
        S("field_application", LIVE_APPLY),
        S("observable_standard", renderStandardSentence(DEFINING)),
      ],
      DEFINING,
      null,
    );
    expect(d).toMatchObject({ kind: "completion_check", branch: "defined_after_use" });
  });
});

// ---------------------------------------------------------------------------
// Behavior-grounded scenario contract (Slice 3.2L-R5)
// ---------------------------------------------------------------------------

const GOOD_SCENARIO: ScenarioContract = {
  pressureOrConstraint: "two people are already waiting to ask you something else and the shift ran late",
  contextDetail: "the last ten minutes of a busy evening shift",
};

const rawScenario = (c: Partial<Record<string, unknown>> = {}) => ({
  pressure_or_constraint: GOOD_SCENARIO.pressureOrConstraint,
  context_detail: GOOD_SCENARIO.contextDetail,
  ...c,
});

describe("[3.2L-R5] G1 — the exact live false negative cannot recur", () => {
  it("a scenario written as a handover is relevant without saying handoff or standard", () => {
    const derived = renderScenarioSentence(GOOD, GOOD_SCENARIO);
    // The R4 gate demanded one shared >3-character token with the Host's own words.
    // These are the six tokens it had to choose from for the canonical draft.
    for (const token of ["handoff", "handoffs", "standard", "create", "shared", "inconsistent"]) {
      expect(derived.toLowerCase()).not.toContain(token);
    }
    // And yet it is unambiguously about the trained behaviour, because it was BUILT from it.
    expect(derived).toContain(GOOD.actor);
    expect(derived).toContain("out loud to the person taking over");
    expect(derived).toContain("confirms they have it");
  });

  it("relevance is structural, so an unrelated word choice cannot make it irrelevant", () => {
    const r = validateScenarioContract(rawScenario(), GOOD);
    expect(r.ok).toBe(true);
  });
});

describe("[3.2L-R5] G2/G3 — the situation must contain a real difficulty", () => {
  it("G3: a pressure that merely restates the required action is refused", () => {
    const r = validateScenarioContract(
      rawScenario({ pressure_or_constraint: "states each unfinished task out loud to the person taking over" }),
      GOOD,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.defect).toEqual({ field: "pressureOrConstraint", reason: "restates_action" });
  });

  it("G3: a generic difficulty is refused", () => {
    for (const generic of ["it is difficult", "There is pressure.", "time pressure", "a busy day"]) {
      const r = validateScenarioContract(rawScenario({ pressure_or_constraint: generic }), GOOD);
      expect(r.ok, `expected refusal for: ${generic}`).toBe(false);
    }
  });

  it("G2: a context that names no actual moment or place is refused", () => {
    for (const generic of ["at work", "in the workplace", "the team", "day-to-day work"]) {
      const r = validateScenarioContract(rawScenario({ context_detail: generic }), GOOD);
      expect(r.ok, `expected refusal for: ${generic}`).toBe(false);
      if (!r.ok) expect(r.defect.field).toBe("contextDetail");
    }
  });

  it("a pressure with no constraint in it at all is refused", () => {
    const r = validateScenarioContract(
      rawScenario({ pressure_or_constraint: "the room is painted a pleasant shade of blue" }),
      GOOD,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.defect.reason).toBe("no_pressure");
  });

  it("empty and over-long fields are bounded", () => {
    expect(validateScenarioContract(rawScenario({ pressure_or_constraint: "" }), GOOD).ok).toBe(false);
    expect(validateScenarioContract(rawScenario({ context_detail: "x".repeat(400) }), GOOD).ok).toBe(false);
  });
});

describe("[3.2L-R5] G4 — the displayed scenario cannot drift from its grounding", () => {
  it("every rendered clause comes from one of the two contracts", () => {
    const derived = renderScenarioSentence(GOOD, GOOD_SCENARIO);
    expect(derived).toContain(GOOD_SCENARIO.pressureOrConstraint);
    expect(derived).toContain(GOOD_SCENARIO.contextDetail);
    expect(derived).toContain(GOOD.completionSignal);
    expect(derived.length).toBeLessThanOrEqual(700);
  });

  it("changing the behaviour contract changes the scenario", () => {
    const other: BehaviorContract = { ...GOOD, actor: "the incoming supervisor" };
    expect(renderScenarioSentence(other, GOOD_SCENARIO)).toContain("the incoming supervisor");
    expect(renderScenarioSentence(other, GOOD_SCENARIO)).not.toBe(renderScenarioSentence(GOOD, GOOD_SCENARIO));
  });

  it("the derived scenario is not itself a meta standard", () => {
    expect(isMetaStandardText(renderScenarioSentence(GOOD, GOOD_SCENARIO))).toBe(false);
  });
});

describe("[3.2L-R5] G7 — the derived scenario enters the dependency graph", () => {
  it("a scenario built from a defining contract uses a defined construct", () => {
    const d = validateProgramDependencies(
      [
        S("observable_standard", renderStandardSentence(DEFINING)),
        S("scenario", renderScenarioSentence(DEFINING, GOOD_SCENARIO)),
        S("field_application", LIVE_APPLY),
      ],
      DEFINING,
      null,
    );
    expect(d).toBeNull();
  });

  it("a completion check still cannot retroactively define it", () => {
    const d = validateProgramDependencies(
      [
        S("observable_standard", renderStandardSentence(DEFINING)),
        S("scenario", renderScenarioSentence(DEFINING, GOOD_SCENARIO)),
        S("field_application", LIVE_APPLY),
        S("completion_check", LIVE_COMPLETION_CHECK),
      ],
      DEFINING,
      null,
    );
    expect(d).toMatchObject({ kind: "completion_check", branch: "defined_after_use" });
  });

  it("a scenario contract that smuggles in an undefined construct is caught", () => {
    const d = validateProgramDependencies(
      [
        S("observable_standard", renderStandardSentence(GOOD)),
        S("scenario", renderScenarioSentence(GOOD, { ...GOOD_SCENARIO, contextDetail: "the middle of the agreed escalation process" })),
      ],
      GOOD,
      null,
    );
    expect(d).toMatchObject({ kind: "scenario", branch: "used_before_defined" });
  });
});

// ---------------------------------------------------------------------------
// Canonical construct identity + semantic roles (Slice 3.2L-R6)
// ---------------------------------------------------------------------------

describe("[3.2L-R6] the construct has ONE system-derived identity", () => {
  it("G4: the canonical Host input yields a PROPOSED construct", () => {
    const c = deriveOperationalConstruct({ observableBehavior: "Create a shared handoff standard." });
    expect(c).toEqual({ label: "shared handoff standard", noun: "standard", authorityMode: "proposed" });
  });

  it("determiners and existence adjectives are not part of the identity", () => {
    for (const src of ["Create a shared handoff standard.", "Create the new shared handoff standard."]) {
      expect(deriveOperationalConstruct({ observableBehavior: src })?.label).toBe("shared handoff standard");
    }
  });

  it("a Host who says it already exists is believed — they are authoritative, BTY is not", () => {
    const c = deriveOperationalConstruct({ observableBehavior: "Follow the existing escalation process." });
    expect(c).toMatchObject({ noun: "process", authorityMode: "host_grounded_existing" });
  });

  it("a verified upload outranks both", () => {
    const c = deriveOperationalConstruct({ observableBehavior: "Create a shared handoff standard." }, ["Handoff Standard v2.pdf"]);
    expect(c?.authorityMode).toBe("verified_resource");
  });

  it("G4: a behaviour-only program legitimately has NO construct", () => {
    expect(deriveOperationalConstruct({ observableBehavior: "Hand over unfinished work out loud." })).toBeNull();
    expect(deriveOperationalConstruct({ problem: "Our handoffs are inconsistent." })).toBeNull();
  });

  it("the model cannot assert authority — nothing here reads model output", () => {
    // deriveOperationalConstruct's only inputs are Host answers and verified artifacts.
    const fromHost = deriveOperationalConstruct({ observableBehavior: "Create a shared handoff standard." });
    expect(fromHost?.authorityMode).toBe("proposed");
    // There is no argument through which a proposal could be marked as existing.
    expect(Object.keys(fromHost ?? {})).toEqual(["label", "noun", "authorityMode"]);
  });
});

describe("[3.2L-R6] semantic roles decide who can bear a dependency", () => {
  it("narrative and instructional kinds are disjoint and complete for the canonical design", () => {
    for (const k of ["why_it_matters", "evidence", "reflection"] as const) {
      expect(isNarrativeKind(k)).toBe(true);
      expect(isInstructionalKind(k)).toBe(false);
    }
    for (const k of ["observable_standard", "scenario", "action_decision", "field_application", "completion_check", "follow_up"] as const) {
      expect(isInstructionalKind(k)).toBe(true);
      expect(isNarrativeKind(k)).toBe(false);
    }
  });

  it("G1: the EXACT R5 false positive is gone — narrative may name the construct", () => {
    const construct = deriveOperationalConstruct({ observableBehavior: "Create a shared handoff standard." })!;
    const d = validateProgramDependencies(
      [
        // The exact shape that was refused live: narrative naming the Host's own construct.
        S("why_it_matters", "When a handoff misses a step the next person starts blind, which is why the shared handoff standard matters."),
        S("observable_standard", renderStandardSentence(GOOD)),
      ],
      GOOD,
      construct,
    );
    expect(d).toBeNull();
  });

  it("G2: a narrative mention does NOT satisfy an instructional dependency", () => {
    const d = validateProgramDependencies(
      [
        S("why_it_matters", "This is why the escalation process matters to everyone here."),
        S("observable_standard", renderStandardSentence(GOOD)),
        S("field_application", "At your next shift you follow the escalation process."),
      ],
      GOOD,
      null,
    );
    expect(d).toMatchObject({ kind: "field_application", construct: "process", branch: "used_before_defined" });
  });

  it("G3: the canonical construct is defined once the behaviour contract is valid", () => {
    const construct = deriveOperationalConstruct({ observableBehavior: "Create a shared handoff standard." })!;
    // GOOD's wording never repeats the word "standard" — the R5 gap.
    expect(renderStandardSentence(GOOD).toLowerCase()).not.toContain("standard");
    const d = validateProgramDependencies(
      [S("observable_standard", renderStandardSentence(GOOD)), S("field_application", "You follow the shared handoff standard at the next handover.")],
      GOOD,
      construct,
    );
    expect(d).toBeNull();
  });

  it("with no behaviour contract the construct is named but not defined", () => {
    const construct = deriveOperationalConstruct({ observableBehavior: "Create a shared handoff standard." })!;
    const d = validateProgramDependencies([S("field_application", "You follow the shared handoff standard.")], null, construct);
    expect(d).toMatchObject({ branch: "used_before_defined" });
  });

  it("a defect carries branch and counterpart, not prose", () => {
    const construct = deriveOperationalConstruct({ observableBehavior: "Create a shared handoff standard." })!;
    const d = validateProgramDependencies(
      [
        S("observable_standard", renderStandardSentence(GOOD)),
        S("field_application", LIVE_APPLY),
        S("completion_check", LIVE_COMPLETION_CHECK),
      ],
      GOOD,
      construct,
    );
    expect(d).toMatchObject({ kind: "completion_check", construct: "standard", branch: "defined_after_use", counterpartKind: "field_application" });
    // The construct is a closed-vocabulary noun, never a generated phrase.
    expect(CONSTRUCT_NOUNS.map(nounStem)).toContain(d!.construct);
  });
});

describe("[3.2L-R6] derived instructional renderers share one authority", () => {
  const APP = { applicationMoment: "at your next shift change", evidenceOrConfirmation: "the person taking over repeats it back" };

  it("G6: a decision commits to the DEFINED behaviour, not to creating a construct", () => {
    const d = renderDecisionSentence(GOOD, APP);
    expect(d.startsWith("I will ")).toBe(true);
    // First person, so the agreement -s is dropped: "I will state", never "I will states".
    expect(d).toContain("I will state each unfinished task");
    expect(d).not.toContain("I will states");
    // The exact old live sentence is not expressible: creation is not a rendered option.
    expect(d).not.toMatch(/contribute to creating|implementing a shared/i);
  });

  it("G7: an application names the moment, the inherited actor and the confirmation", () => {
    const a = renderApplicationSentence(GOOD, APP, null);
    expect(a).toContain(GOOD.actor);
    expect(a).toContain("at your next shift change".replace(/^a/, "A"));
    expect(a).toContain("repeats it back");
  });

  it("G8: a completion check verifies; it cannot ask what the construct contains", () => {
    for (const target of VERIFICATION_TARGETS) {
      for (const mode of RESPONSE_MODES) {
        const q = renderCompletionQuestion(GOOD, { verificationTarget: target, responseMode: mode });
        expect(q).toMatch(/\?$/);
        expect(q).not.toMatch(/what (specific )?(elements|fields|steps)/i);
        expect(q).not.toMatch(/will you include/i);
      }
    }
  });

  it("G9: a follow-up uses the canonical window and introduces no new action", () => {
    const f = renderFollowUpSentence(GOOD, { reviewFocus: "what_you_said", confirmer: "self_report" }, 7);
    expect(f).toContain("In 7 days");
    expect(f).toContain("states each unfinished task");
    expect(f).toContain("your own account");
  });

  it("G10: changing ONE contract field changes every dependent section", () => {
    const other: BehaviorContract = { ...GOOD, observableAction: "writes the unfinished items on the shared board" };
    for (const render of [
      (b: BehaviorContract) => renderStandardSentence(b),
      (b: BehaviorContract) => renderScenarioSentence(b, GOOD_SCENARIO),
      (b: BehaviorContract) => renderDecisionSentence(b, APP),
      (b: BehaviorContract) => renderApplicationSentence(b, APP, null),
      (b: BehaviorContract) => renderCompletionQuestion(b, { verificationTarget: "the_behaviour", responseMode: "name_the_moment" }),
      (b: BehaviorContract) => renderFollowUpSentence(b, { reviewFocus: "what_you_said", confirmer: "self_report" }, 7),
    ]) {
      expect(render(other)).not.toBe(render(GOOD));
      expect(render(other)).toContain("shared board");
    }
  });

  it("an application moment must be a moment", () => {
    expect(validateApplicationContract({ application_moment: "soon", evidence_or_confirmation: "someone notices" }).ok).toBe(false);
    expect(validateApplicationContract({ application_moment: "at your next shift change", evidence_or_confirmation: "the person taking over repeats it back" }).ok).toBe(true);
  });
});
