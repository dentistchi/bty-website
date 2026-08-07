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
  nounStem,
  VERIFICATION_TARGETS,
  RESPONSE_MODES,
  REVIEW_FOCUSES,
  momentCore,
  isRenderableAction,
  baseActionPhrase,
  applicationMatchesTrigger,
  validateApplicationContract,
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
  completion: { confirmedBy: "the person taking over", confirmationAction: "repeat the open items back" },
};

const raw = (c: Partial<Record<string, unknown>> = {}) => ({
  actor: GOOD.actor,
  trigger: GOOD.trigger,
  observable_action: GOOD.observableAction,
  completion: { confirmed_by: GOOD.completion.confirmedBy, confirmation_action: GOOD.completion.confirmationAction },
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
    // R8: one render-safe clause with a named confirmer and an explicit subject.
    expect(s).toContain("you see the person taking over repeat the open items back");
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
        completion: { confirmed_by: "the person taking over", confirmation_action: "repeat the open items back" },
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

  it("refuses a confirming act that is only the construct being established", () => {
    const r = validateBehaviorContract(raw({ completion: { confirmed_by: "the team", confirmation_action: "establish the shared standard" } }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.defect).toEqual({ field: "completionSignal", reason: "meta_only" });
  });
});

describe("[3.2L-R4] each contract role is checked for a DIFFERENT property", () => {
  it("a completion authority with no confirmer is refused — the v5 render defect", () => {
    // "receive a confirmation from the next owner" had no subject; the renderer pasted it
    // after "It is complete when …". A named confirmer is now structural.
    const r = validateBehaviorContract(raw({ completion: { confirmed_by: "", confirmation_action: "receive a confirmation from the next owner" } }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.defect).toEqual({ field: "completionSignal", reason: "missing" });
  });

  it("a missing field is a defect, whichever it is", () => {
    for (const f of ["actor", "trigger", "observable_action"]) {
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

  it("the confirming act must be something a second person could witness", () => {
    const r = validateBehaviorContract(raw({ completion: { confirmed_by: "the next owner", confirmation_action: "feel better about the handoff" } }));
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

/**
 * v7 shape (Slice 3.2L-R8.1): pressure only. The scenario has no moment of its own — the
 * one moment in a program is the behaviour trigger.
 */
const GOOD_SCENARIO: ScenarioContract = {
  pressureCondition: "two people are already waiting to ask you something else and the shift ran late",
  pressureDetail: "",
};

const rawScenario = (c: Partial<Record<string, unknown>> = {}) => ({
  pressure_condition: GOOD_SCENARIO.pressureCondition,
  pressure_detail: GOOD_SCENARIO.pressureDetail,
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
    expect(true).toBe(true); // completion is asserted via the shared clause below
  });

  it("relevance is structural, so an unrelated word choice cannot make it irrelevant", () => {
    const r = validateScenarioContract(rawScenario(), GOOD);
    expect(r.ok).toBe(true);
  });
});

describe("[3.2L-R5] G2/G3 — the situation must contain a real difficulty", () => {
  it("G3: a pressure that merely restates the required action is refused", () => {
    const r = validateScenarioContract(
      rawScenario({ pressure_condition: "states each unfinished task out loud to the person taking over" }),
      GOOD,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.defect).toEqual({ field: "pressureCondition", reason: "restates_action" });
  });

  it("G3: a generic difficulty is refused", () => {
    for (const generic of ["it is difficult", "There is pressure.", "time pressure", "a busy day"]) {
      const r = validateScenarioContract(rawScenario({ pressure_condition: generic }), GOOD);
      expect(r.ok, `expected refusal for: ${generic}`).toBe(false);
    }
  });

  it("G2: a pressure that names nothing actual is refused", () => {
    for (const generic of ["at work", "in the workplace", "the team", "day-to-day work"]) {
      const r = validateScenarioContract(rawScenario({ pressure_condition: generic }), GOOD);
      expect(r.ok, `expected refusal for: ${generic}`).toBe(false);
      if (!r.ok) expect(r.defect.field).toBe("pressureCondition");
    }
  });

  it("a pressure with no constraint in it at all is refused", () => {
    const r = validateScenarioContract(
      rawScenario({ pressure_condition: "the room is painted a pleasant shade of blue" }),
      GOOD,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.defect.reason).toBe("no_pressure");
  });

  it("empty and over-long fields are bounded", () => {
    expect(validateScenarioContract(rawScenario({ pressure_condition: "" }), GOOD).ok).toBe(false);
    expect(validateScenarioContract(rawScenario({ pressure_condition: "x".repeat(400) }), GOOD).ok).toBe(false);
  });
});

describe("[3.2L-R5] G4 — the displayed scenario cannot drift from its grounding", () => {
  it("every rendered clause comes from one of the two contracts", () => {
    const derived = renderScenarioSentence(GOOD, GOOD_SCENARIO);
    expect(derived).toContain(GOOD_SCENARIO.pressureCondition);
    // The MOMENT is the trigger's, never the scenario's (Slice 3.2L-R8.1).
    expect(derived.toLowerCase()).toContain(GOOD.trigger.toLowerCase().replace(/^at\s+/, ""));
    expect(derived).toContain(GOOD.completion.confirmationAction);
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
        S("scenario", renderScenarioSentence(GOOD, { ...GOOD_SCENARIO, pressureCondition: "the agreed escalation process is already running late" })),
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
    // R6.2: the moment leads, in FIRST-PERSON possessive, and the action follows the modal
    // in base form — "I will states" and "…at your next shift change" are both impossible.
    expect(d).toContain("I will state each unfinished task");
    expect(d).not.toContain("I will states");
    expect(d).toContain("At my next shift change");
    expect(d).not.toContain("your");
    // The exact old live sentence is not expressible: creation is not a rendered option.
    expect(d).not.toMatch(/contribute to creating|implementing a shared/i);
  });

  it("G7: an application names the moment, the inherited actor and the confirmation", () => {
    const a = renderApplicationSentence(GOOD, APP, null);
    expect(a).toContain(GOOD.actor);
    // Actor-neutral possessive here, because the sentence names a third-party actor.
    expect(a).toContain("At the next shift change");
    expect(a).toContain("must state each unfinished task");
    expect(a).toContain("you see the person taking over repeat the open items back");
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
    // Tense-safe: past question, base-form action, never "said when you states".
    expect(f).toContain("what you actually said when you were expected to state each unfinished task");
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

// ---------------------------------------------------------------------------
// Grammar authority (Slice 3.2L-R6.2) — the physical iPhone defects
// ---------------------------------------------------------------------------

describe("[3.2L-R6.2] no rendered sentence guesses the actor's number", () => {
  const APP2 = { applicationMoment: "at your next shift change", evidenceOrConfirmation: "the person taking over repeats it back" };
  const forActor = (actor: string, action = "states each unfinished task aloud") => ({ ...GOOD, actor, observableAction: action });

  /** Every derived sentence, for one actor. */
  const allSections = (actor: string, action?: string) => {
    const b = forActor(actor, action);
    return [
      renderStandardSentence(b),
      renderScenarioSentence(b, GOOD_SCENARIO),
      renderDecisionSentence(b, APP2),
      renderApplicationSentence(b, APP2, null),
      renderCompletionQuestion(b, { verificationTarget: "the_behaviour", responseMode: "name_the_moment" }),
      renderFollowUpSentence(b, { reviewFocus: "what_you_said", confirmer: "self_report" }, 7),
    ];
  };

  it("G1: a PLURAL actor never produces 'doctors faces' or 'doctors states'", () => {
    // The exact strings the Founder read on the physical iPhone.
    const sections = allSections("Doctors");
    for (const s of sections) {
      expect(s.toLowerCase()).not.toContain("doctors faces");
      expect(s.toLowerCase()).not.toContain("doctors states");
    }
    expect(sections[0]).toContain("doctors must state each unfinished task");
    expect(sections[1]).toContain("doctors must state each unfinished task");
    expect(sections[3]).toContain("doctors must state each unfinished task");
  });

  it("G2: a SINGULAR actor reads naturally from the same authority", () => {
    const sections = allSections("the outgoing team member");
    expect(sections[0]).toContain("the outgoing team member must state");
    for (const s of sections) expect(s).not.toMatch(/member states|member faces/);
  });

  it("G3: a GROUP actor produces no number-guessing defect either", () => {
    const sections = allSections("everyone on the closing team");
    expect(sections[0]).toContain("everyone on the closing team must state");
    for (const s of sections) expect(s).not.toMatch(/team states|team faces/);
  });

  it("the modal is what removes the bet — no renderer inflects for the actor", () => {
    for (const actor of ["Doctors", "the outgoing team member", "everyone on the closing team", "I"]) {
      for (const s of allSections(actor)) {
        expect(s, `${actor}: ${s}`).not.toMatch(/\b(faces|states)\b/);
      }
    }
  });
});

describe("[3.2L-R6.2] perspective never collides", () => {
  const APP2 = { applicationMoment: "at your next shift change", evidenceOrConfirmation: "the person taking over repeats it back" };

  it("G4: a first-person decision never carries a second-person possessive", () => {
    const d = renderDecisionSentence(GOOD, APP2);
    expect(d).toContain("At my next shift change");
    expect(d).toContain("I will state");
    // The exact live collision: "I will … starting at your next shift change."
    expect(d).not.toMatch(/\byour\b/);
  });

  it("G5: the SAME semantic moment renders actor-neutral in the instruction", () => {
    const a = renderApplicationSentence(GOOD, APP2, null);
    expect(a).toContain("At the next shift change");
    expect(a).not.toMatch(/\bmy\b/);
  });

  it("G13: moments that carry their own preposition are left alone", () => {
    for (const [moment, expected] of [
      ["during the Monday huddle", "During the Monday huddle"],
      ["before closing the case", "Before closing the case"],
      ["when the next escalation arrives", "When the next escalation arrives"],
      ["next shift change", "At my next shift change"],
    ] as const) {
      const d = renderDecisionSentence(GOOD, { ...APP2, applicationMoment: moment });
      expect(d.startsWith(expected), `${moment} → ${d}`).toBe(true);
    }
  });

  it("the possessive strip is anchored — it never rewrites inside the Host's prose", () => {
    const m = "before your team closes your last case";
    // Only a LEADING "at/in/on + possessive" is removed; this has neither.
    expect(momentCore(m)).toBe(m);
    expect(renderDecisionSentence(GOOD, { ...APP2, applicationMoment: m })).toContain("your team closes your last case");
  });
});

describe("[3.2L-R6.2] follow-up tense and Host phrasing", () => {
  it("G6: no retrospective/present collision", () => {
    for (const focus of REVIEW_FOCUSES) {
      const f = renderFollowUpSentence(GOOD, { reviewFocus: focus, confirmer: "self_report" }, 7);
      expect(f).not.toMatch(/said when you say|did when you do|said when you states/);
    }
  });

  it("G7: a colloquial Host phrase keeps its meaning and its sentence stays grammatical", () => {
    const blunt = { ...GOOD, observableAction: "Say it blunt" };
    const standard = renderStandardSentence(blunt);
    const followUp = renderFollowUpSentence(blunt, { reviewFocus: "what_you_said", confirmer: "self_report" }, 7);
    // Meaning preserved — not rewritten into BTY's preferred style.
    expect(standard).toContain("say it blunt");
    expect(followUp).toContain("were expected to say it blunt");
    // …and the surrounding grammar is valid.
    expect(standard).toContain("must say it blunt");
    expect(followUp).not.toMatch(/said when you say it blunt/);
  });

  it("the evidence ceiling survives every combination", () => {
    for (const focus of REVIEW_FOCUSES) {
      const f = renderFollowUpSentence(GOOD, { reviewFocus: focus, confirmer: "self_report" }, 7);
      expect(f).toContain("your own account of it, not an observation");
      expect(f).not.toMatch(/proves|verified|sustained|permanently/i);
    }
  });

  it("G8: a long action stays renderable and within the element ceiling", () => {
    const long = `states ${"each unfinished task, its deadline and what could go wrong with it, ".repeat(6)}out loud`;
    const b = { ...GOOD, observableAction: long };
    expect(isRenderableAction(long)).toBe(true);
    expect(renderStandardSentence(b)).toContain("must state each unfinished task");
    expect(renderStandardSentence(b).length).toBeLessThanOrEqual(700);
  });

  it("an action with no verb-shaped head is refused rather than rendered broken", () => {
    for (const bad of ["", "  ", "!!!", "12345"]) expect(isRenderableAction(bad)).toBe(false);
    for (const ok of ["Say it blunt", "state each open item aloud", "hand over"]) expect(isRenderableAction(ok)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Canonical action-phrase casing (Slice 3.2L-R6.3)
// ---------------------------------------------------------------------------

describe("[3.2L-R6.3] one canonical action phrase reaches every grammatical context", () => {
  const APP3 = { applicationMoment: "at your next shift change", evidenceOrConfirmation: "they repeat it back" };
  const withAction = (action: string) => ({ ...GOOD, actor: "Doctors", observableAction: action });

  /** Every context that inserts the action after must / will / to / when. */
  const contexts = (action: string) => {
    const b = withAction(action);
    return {
      standard: renderStandardSentence(b),
      scenario: renderScenarioSentence(b, GOOD_SCENARIO),
      decision: renderDecisionSentence(b, APP3),
      application: renderApplicationSentence(b, APP3, null),
      completion: renderCompletionQuestion(b, { verificationTarget: "the_behaviour", responseMode: "name_the_moment" }),
      followUp: renderFollowUpSentence(b, { reviewFocus: "what_you_said", confirmer: "self_report" }, 7),
    };
  };

  it("G1: the exact physical failure — no capitalised action after 'expected to'", () => {
    const c = contexts("Say it blunt");
    expect(c.followUp).toContain("expected to say it blunt");
    expect(c.followUp).not.toContain("expected to Say it blunt");
  });

  it("G2: every action-bearing section uses the SAME canonical phrase", () => {
    const canonical = baseActionPhrase("Say it blunt");
    expect(canonical).toBe("say it blunt");
    const c = contexts("Say it blunt");
    for (const [name, sentence] of Object.entries(c)) {
      expect(sentence, name).toContain(canonical);
      // The raw Host casing must never survive into participant text.
      expect(sentence, name).not.toContain("Say it blunt");
    }
    expect(c.standard).toContain("must say it blunt");
    expect(c.decision).toContain("I will say it blunt");
    expect(c.application).toContain("must say it blunt");
    expect(c.completion).toContain("you say it blunt");
  });

  it("G3: an acronym is preserved wherever it sits in the phrase", () => {
    // After the head verb…
    const after = contexts("Use SBAR for the handoff");
    for (const [name, s] of Object.entries(after)) {
      expect(s, name).toContain("use SBAR for the handoff");
      // Checked on the ORIGINAL string: lowercasing it first would make this vacuous.
      expect(s, name).not.toContain("use sbar");
    }
    // …and AS the head verb, where a naive lowercase would have destroyed it.
    const asHead = contexts("SBAR the handoff");
    expect(baseActionPhrase("SBAR the handoff")).toBe("SBAR the handoff");
    for (const [name, s] of Object.entries(asHead)) expect(s, name).toContain("SBAR the handoff");
  });

  it("G3: an acronym is never de-inflected into nonsense", () => {
    // "SOS" ends in -s; a blind agreement-strip would emit "SO".
    expect(baseActionPhrase("SOS the duty lead")).toBe("SOS the duty lead");
    expect(baseActionPhrase("Send an SOS")).toBe("send an SOS");
  });

  it("G4: a proper name keeps its capitals", () => {
    const c = contexts("Call Dr. Lee");
    for (const [name, s] of Object.entries(c)) {
      expect(s, name).toContain("call Dr. Lee");
      expect(s, name).not.toContain("dr. lee");
    }
  });

  it("only the head verb is ever touched — the rest of the phrase is the Host's", () => {
    for (const [raw, expected] of [
      ["states each item aloud", "state each item aloud"],
      ["Say it blunt", "say it blunt"],
      ["Use SBAR for the handoff", "use SBAR for the handoff"],
      ["Call Dr. Lee", "call Dr. Lee"],
      ["hand over to the McKinsey team", "hand over to the McKinsey team"],
    ] as const) {
      expect(baseActionPhrase(raw), raw).toBe(expected);
    }
  });

  it("G5: the plural-actor repair still holds with a colloquial action", () => {
    for (const s of Object.values(contexts("Say it blunt"))) {
      expect(s.toLowerCase()).not.toMatch(/doctors (faces|states|does)\b/);
    }
  });

  it("G6: perspective stays separated", () => {
    const c = contexts("Say it blunt");
    expect(c.decision).toBe("At my next shift change, I will say it blunt.");
    expect(c.application.startsWith("At the next shift change, doctors must say it blunt.")).toBe(true);
    expect(c.decision).not.toMatch(/\byour\b/);
    expect(c.application).not.toMatch(/\bmy\b/);
  });

  it("G7: the follow-up tense repair still holds", () => {
    for (const focus of REVIEW_FOCUSES) {
      const b = withAction("Say it blunt");
      const f = renderFollowUpSentence(b, { reviewFocus: focus, confirmer: "self_report" }, 7);
      expect(f).not.toMatch(/said when you say|did when you do/);
    }
  });

  it("an unrenderable action is still refused rather than rendered", () => {
    for (const bad of ["", "!!!", "123"]) expect(isRenderableAction(bad)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Inflection precedence (Slice 3.2L-R6.4)
// ---------------------------------------------------------------------------

describe("[3.2L-R6.4] a shouted verb is normalised; a shouted acronym is not", () => {
  const APP4 = { applicationMoment: "at your next shift change", evidenceOrConfirmation: "they repeat it back" };
  const sections = (action: string) => {
    const b = { ...GOOD, actor: "Doctors", observableAction: action };
    return [
      renderStandardSentence(b),
      renderScenarioSentence(b, GOOD_SCENARIO),
      renderDecisionSentence(b, APP4),
      renderApplicationSentence(b, APP4, null),
      renderCompletionQuestion(b, { verificationTarget: "the_behaviour", responseMode: "name_the_moment" }),
      renderFollowUpSentence(b, { reviewFocus: "what_you_said", confirmer: "self_report" }, 7),
    ];
  };

  it("G1: ALL-CAPS INFLECTED verbs normalise to their base form", () => {
    for (const [raw, expected] of [
      ["STATES each item aloud", "state each item aloud"],
      ["SAYS it blunt", "say it blunt"],
      ["USES SBAR", "use SBAR"],
      ["CALLS Dr. Lee", "call Dr. Lee"],
      // Outside any curated list — the rule decides, not a lookup table.
      ["DELEGATES to the duty lead", "delegate to the duty lead"],
    ] as const) {
      expect(baseActionPhrase(raw), raw).toBe(expected);
    }
  });

  it("G2: true acronyms survive as the head token", () => {
    expect(baseActionPhrase("SBAR the handoff")).toBe("SBAR the handoff");
    expect(baseActionPhrase("SOS the duty lead")).toBe("SOS the duty lead");
  });

  it("the rule, not a verb list, is what separates them", () => {
    // "SBAR" is preserved because de-inflection is a NO-OP; "STATES" normalises because it
    // is not. Only S-final acronyms need naming, because they alone defeat that test.
    expect(baseActionPhrase("SBAR the handoff").startsWith("SBAR")).toBe(true);
    expect(baseActionPhrase("STATES each item aloud").startsWith("state")).toBe(true);
  });

  it("G3/G4: embedded acronyms and proper names are untouched either way", () => {
    expect(baseActionPhrase("Use SBAR for the handoff")).toBe("use SBAR for the handoff");
    expect(baseActionPhrase("USES SBAR for the handoff")).toBe("use SBAR for the handoff");
    expect(baseActionPhrase("Call Dr. Lee")).toBe("call Dr. Lee");
    expect(baseActionPhrase("CALLS Dr. Lee")).toBe("call Dr. Lee");
  });

  it("G5: the exact physical case still holds", () => {
    const f = sections("Say it blunt")[5];
    expect(f).toContain("expected to say it blunt");
    expect(f).not.toContain("expected to Say it blunt");
  });

  it("G6: known-malformed output is now impossible", () => {
    const malformed = [/must STATES/, /will STATES/, /expected to STATES/, /must SAYS/, /expected to USES/, /must CALLS/];
    for (const action of ["STATES each item aloud", "SAYS it blunt", "USES SBAR", "CALLS Dr. Lee"]) {
      for (const s of sections(action)) {
        for (const bad of malformed) expect(s, `${action}: ${s}`).not.toMatch(bad);
      }
    }
  });

  it("lower-case behaviour is unchanged", () => {
    expect(baseActionPhrase("states each item aloud")).toBe("state each item aloud");
    expect(baseActionPhrase("say it blunt")).toBe("say it blunt");
    expect(baseActionPhrase("hand over to the McKinsey team")).toBe("hand over to the McKinsey team");
  });
});

// ---------------------------------------------------------------------------
// Single completion authority + render-safe language (Slice 3.2L-R8)
// ---------------------------------------------------------------------------

describe("[3.2L-R8] the live v5 program's defects cannot recur", () => {
  const APP8 = { applicationMoment: "at the end of the next project" };

  it("G1: a subject-less completion phrase can no longer be rendered", () => {
    // The exact v5 value: a bare infinitive, which produced
    // "It is complete when receive a confirmation from the next owner…".
    const r = validateBehaviorContract({
      actor: GOOD.actor,
      trigger: GOOD.trigger,
      observable_action: GOOD.observableAction,
      completion: { confirmed_by: "", confirmation_action: "receive a confirmation from the next owner" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.defect).toEqual({ field: "completionSignal", reason: "missing" });
  });

  it("G2: every rendered completion clause has an explicit subject and a named confirmer", () => {
    for (const confirmedBy of ["the next owner", "both people", "the incoming team member"]) {
      const b = { ...GOOD, completion: { confirmedBy, confirmationAction: "repeat back who owns the next step" } };
      const s = renderStandardSentence(b);
      expect(s).toContain(`It is complete when you see ${confirmedBy} repeat back who owns the next step.`);
      // "you see X do Y" takes a bare infinitive, so plural and singular both render.
      expect(s).not.toMatch(/see (?:the next owner|both people|the incoming team member) repeats/);
    }
  });

  it("G3/G4: ONE completion authority reaches every section", () => {
    const b = { ...GOOD, completion: { confirmedBy: "the next owner", confirmationAction: "confirm the next action" } };
    const clause = "you see the next owner confirm the next action";
    expect(renderStandardSentence(b)).toContain(clause);
    expect(renderScenarioSentence(b, GOOD_SCENARIO)).toContain(clause);
    expect(renderApplicationSentence(b, APP8, null)).toContain(clause);
    expect(renderCompletionQuestion(b, { verificationTarget: "the_confirmation_step", responseMode: "name_the_moment" })).toContain(clause);
    expect(renderFollowUpSentence(b, { reviewFocus: "the_confirmation", confirmer: "self_report" }, 7)).toContain(clause);

    // Changing it moves all of them together.
    const other = { ...b, completion: { confirmedBy: "the duty lead", confirmationAction: "sign the handover" } };
    for (const s of [renderStandardSentence(other), renderScenarioSentence(other, GOOD_SCENARIO), renderApplicationSentence(other, APP8, null)]) {
      expect(s).toContain("you see the duty lead sign the handover");
      expect(s).not.toContain(clause);
    }
  });

  it("G4: APPLY IT can no longer state a second, different completion", () => {
    // v5's application_contract carried its own evidence field; there is nowhere left to
    // put a competing answer to "how will we know it happened".
    expect(Object.keys(APP8)).toEqual(["applicationMoment"]);
    const a = renderApplicationSentence(GOOD, APP8, null);
    expect(a).toContain("You will know it happened when you see");
  });

  it("G5/G6: a context fragment never receives a doubled preposition", () => {
    for (const [context, expected] of [
      ["during a team meeting just before a project deadline", "During a team meeting"],
      ["at the end of the evening shift", "At the end of the evening shift"],
      ["when the escalation lands", "When the escalation lands"],
      ["while the ward is at capacity", "While the ward is at capacity"],
      ["before the case closes", "Before the case closes"],
      ["after the last patient leaves", "After the last patient leaves"],
      ["the last ten minutes of a busy shift", "At the last ten minutes"],
    ] as const) {
      // The leading moment is now the TRIGGER's, so the no-doubled-preposition property is
      // asserted where the moment actually lives (Slice 3.2L-R8.1).
      const s = renderScenarioSentence({ ...GOOD, trigger: context }, GOOD_SCENARIO);
      expect(s.startsWith(expected), `${context} → ${s}`).toBe(true);
      for (const doubled of ["In during", "At at", "When when", "In while", "In before", "In after"]) {
        expect(s, context).not.toContain(doubled);
      }
    }
  });

  it("G7: IN CONTEXT always anchors to the canonical trigger", () => {
    const s = renderScenarioSentence(GOOD, GOOD_SCENARIO);
    // v5 discarded the trigger entirely and R8 re-attached it with an "Even then" bridge
    // after the scenario's OWN moment. v7 opens on the trigger, so there is no bridge and
    // no second moment to bridge to (Slice 3.2L-R8.1).
    expect(s.startsWith("At the end of every shift")).toBe(true);
    expect(s).not.toContain("Even then");
  });

  it("G8: the first application moment must be an instance of the trigger", () => {
    const trigger = "at the end of each project or task";
    expect(applicationMatchesTrigger("at the next project handoff", trigger)).toBe(true);
    expect(applicationMatchesTrigger("at the end of the next task", trigger)).toBe(true);
    // The live v5 mismatch: a meeting is not an instance of "the end of each project".
    expect(applicationMatchesTrigger("during a team meeting before a deadline", trigger)).toBe(false);
    expect(validateApplicationContract({ application_moment: "during the weekly social" }, trigger).ok).toBe(false);
    expect(validateApplicationContract({ application_moment: "at the next project handoff" }, trigger).ok).toBe(true);
  });

  it("the alignment check never invents a fault when there is nothing to compare", () => {
    // No content tokens on one side — determiners and time words only. Silence beats a
    // guess: the check exists to catch an unrelated EVENT, not to police phrasing.
    expect(applicationMatchesTrigger("the next one", "when asked")).toBe(true);
    expect(applicationMatchesTrigger("at the next handover", "every handover")).toBe(true);
  });
});
