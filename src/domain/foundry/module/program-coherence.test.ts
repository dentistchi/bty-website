import { describe, it, expect } from "vitest";
import {
  validateBehaviorContract,
  renderStandardSentence,
  isMetaStandardText,
  validateProgramDependencies,
  validateScenarioContract,
  renderScenarioSentence,
  renderPressureFrame,
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

/** The Host's own completion evidence — agentless, which v10 could not have accepted. */
/** Server-owned authority: actor from the audience, moment and evidence from the Host (R3.6-R1). */
const SERVER = {
  actor: "you",
  trigger: "at each handoff point",
  criterion: "The handover note lists every open item and who now owns it",
};

/** A contract that satisfies all four roles — synthetic, never written to any draft. */
const GOOD: BehaviorContract = {
  actor: "the outgoing team member",
  trigger: "At the end of every shift, before leaving the floor",
  observableAction: "states each unfinished task, its deadline and its risk out loud to the person taking over",
  completion: { criterion: SERVER.criterion },
};

/*
  SERVER-OWNED SINCE v11 (Slice 3.2P-R3.4-R1). This is a HOST answer, not a model field, so it
  is passed to `validateBehaviorContract` as its own argument and never appears in `raw()` —
  the fixture mirrors the real call, where no response shape can supply it.
*/
/**
 * WHAT THE MODEL RETURNS — one field since Slice 3.2P-R3.6-R1. `actor` and `trigger` left the
 * provider contract with `completion`; overrides may still pass them, which is exactly how the
 * smuggling tests below prove they are ignored rather than merged.
 */
const raw = (c: Partial<Record<string, unknown>> = {}) => ({
  observable_action: GOOD.observableAction,
  ...c,
});

describe("[3.2L-R4] G2 — a complete behavioral contract is accepted", () => {
  it("accepts the model's one field, with the server's three supplied beside it", () => {
    const r = validateBehaviorContract(raw(), SERVER);
    expect(r.ok, r.ok ? "" : `${r.defect.field}:${r.defect.reason}`).toBe(true);
  });

  it("renders one sentence that carries all four fields", () => {
    const s = renderStandardSentence(GOOD);
    expect(s).toContain("the outgoing team member");
    expect(s).toContain("out loud to the person taking over");
    // v11: the completion is the HOST's evidence sentence, stated as its own sentence.
    expect(s).toContain(`Completion evidence: ${SERVER.criterion}.`);
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
      raw({ observable_action: "a shared handoff standard is created and utilized" }),
      SERVER,
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
    const r = validateBehaviorContract(raw({ observable_action: "Create and implement a shared process." }), SERVER);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.defect).toEqual({ field: "observableAction", reason: "meta_only" });
  });

  it("refuses a bare instruction to use the construct", () => {
    for (const bare of ["uses the shared handoff standard", "will follow the agreed process", "applies the new framework"]) {
      const r = validateBehaviorContract(raw({ observable_action: bare }), SERVER);
      expect(r.ok, `expected refusal for: ${bare}`).toBe(false);
    }
  });

  /*
    THE CONFIRMING-ACT RULES ARE GONE WITH THE FIELD (Slice 3.2P-R3.4-R1). `meta_only` on
    `confirmation_action` and `no_confirmation` on its marker word both policed model prose.
    There is no model prose here now — see `completionCriterionAuthority.test.ts` for what the
    criterion is actually held to, and `A` there for why no response can supply one.
  */
});

describe("[3.2L-R4] each contract role is checked for a DIFFERENT property", () => {
  it("an absent completion criterion is still refused — but it is a SOURCE fault now", () => {
    // v5's defect was a subjectless confirming act the renderer pasted after "It is complete
    // when …". v11 has no such field; what can still be empty is the Host's evidence, and the
    // Builder blocks that at its own step long before a generation is legal.
    const r = validateBehaviorContract(raw(), { ...SERVER, criterion: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.defect).toEqual({ field: "completionSignal", reason: "missing" });
  });

  it("an absent Host moment is refused the same way, and named as the trigger", () => {
    // Also a source fault since 3.2P-R3.6-R1 — `programSourceBlocker` stops it before spend, and
    // this is the last line of defence for a caller that bypassed readiness.
    const r = validateBehaviorContract(raw(), { ...SERVER, trigger: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.defect).toEqual({ field: "trigger", reason: "missing" });
  });

  it("the model's one field is still required, and still bounded", () => {
    const empty = validateBehaviorContract(raw({ observable_action: "" }), SERVER);
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.defect).toEqual({ field: "observableAction", reason: "missing" });

    const long = validateBehaviorContract(raw({ observable_action: "x".repeat(400) }), SERVER);
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.defect).toEqual({ field: "observableAction", reason: "too_long" });
  });

  it("a smuggled actor or trigger is IGNORED, not validated and not merged", () => {
    /*
      `not_a_role` and `no_moment` used to live here, policing a model actor and a model trigger.
      Both fields are gone from the provider contract, so an override that would once have been
      refused now simply has nowhere to land — which is a stronger guarantee than refusing it.
    */
    const r = validateBehaviorContract(
      raw({ actor: "the shared handoff standard", trigger: "in a professional manner" }),
      SERVER,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.actor).toBe(SERVER.actor);
      expect(r.value.trigger).toBe(SERVER.trigger);
    }
  });

  it("the Host's own evidence is NOT second-guessed, however it is phrased", () => {
    /*
      R3.4 measured `CONFIRMATION_MARKER` — the old `no_confirmation` rule — refusing real Host
      evidence such as "Feedback forms are completed after role-playing sessions", because it
      knows `record` and `confirm` but not `complete` or `submit`. Turning a rule built for
      model prose on the Host's own words would refuse the corpus.
    */
    for (const host of [
      "Feedback forms are completed after role-playing sessions",
      "Participants submit their daily schedules with meal times marked",
      "바른 자세로 앉기",
    ]) {
      expect(validateBehaviorContract(raw(), { ...SERVER, criterion: host }).ok, host).toBe(true);
    }
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
/*
  v12 shape (Slice 3.2P-A7-R2): ONE frame id. The pressure prose these tests were written
  around does not exist any more — the server writes the clause — so the cases below that
  probed free-text faults (generic, restatement, second occasion) are unreachable by
  construction rather than refused. They are kept as historical narrative where they still
  describe a real rule, and removed where they described a field.
*/
const GOOD_SCENARIO: ScenarioContract = { frame: "others_are_waiting" };

const rawScenario = (c: Partial<Record<string, unknown>> = {}) => ({
  pressure_frame: GOOD_SCENARIO.frame,
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
    /*
      A — SUPERSEDED BY REAL LEARNER EVIDENCE (Slice R4-R5C11). This asserted that the scenario
      CONTAINS the actor and the action, on the reasoning that a section built from the contract
      proves relevance by carrying the contract's words. It did carry them: measured at 85% of
      THE STANDARD as one contiguous token run, which is the standard with a difficulty clause
      wedged in, not a situation to recognise. A real learner read one of these and reported
      being shown the same answer over and over.

      Relevance is still STRUCTURAL, which was the point of this test — it is just proved by the
      grounding that remains. IN CONTEXT is built from the Host's own trigger and a server-chosen
      pressure frame, so it cannot be about a different moment; and it now must NOT restate the
      action, which is the property that replaced the one below.
    */
    expect(derived.toLowerCase()).toContain(GOOD.trigger.toLowerCase().replace(/^at\s+/, ""));
    expect(derived).toContain(renderPressureFrame(GOOD_SCENARIO.frame));
    expect(derived).not.toContain(baseActionPhrase(GOOD.observableAction));
    expect(derived).not.toContain(GOOD.completion.criterion);
  });

  it("relevance is structural, so an unrelated word choice cannot make it irrelevant", () => {
    const r = validateScenarioContract(rawScenario(), GOOD);
    expect(r.ok).toBe(true);
  });
});

describe("[3.2P-A7-R2] G2/G3 — the situation contains a real difficulty BY CONSTRUCTION", () => {
  /*
    WHAT THIS BLOCK USED TO DO. It fed `validateScenarioContract` prose that was generic ("it is
    difficult"), empty, over-long, a restatement of the required action, or simply not a
    difficulty at all — and asserted each was refused. Those were the G2/G3 floors, and they
    were correct for a contract whose pressure was free text.

    A7 (`309c2bb1`) ended free-text pressure: the field now takes one of twelve server-defined
    frame ids. Every case above is unrepresentable rather than refused, and the clause a learner
    reads is written by BTY. So the floors are asserted the only way that is still true — as
    impossibilities — and the phrasings live on in `pressureFrameArchitecture.test.ts`.
  */
  it("only a known frame is accepted; everything the old floors caught is now unsendable", () => {
    expect(validateScenarioContract(rawScenario(), GOOD).ok).toBe(true);
    for (const unsendable of ["", "   ", "it is difficult", "at work", "the room is painted a pleasant shade of blue",
      "states each unfinished task out loud to the person taking over", "after the meeting ends", "x".repeat(200)]) {
      const r = validateScenarioContract(rawScenario({ pressure_frame: unsendable }), GOOD);
      expect(r.ok, unsendable).toBe(false);
      if (!r.ok) expect(r.defect.reason).toBe("missing");
    }
  });

  it("and the frame the model picks is the only thing it contributes", () => {
    const r = validateScenarioContract(rawScenario({ pressure_frame: "fatigue" }), GOOD);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ frame: "fatigue" });
  });
});
describe("[3.2L-R5] G4 — the displayed scenario cannot drift from its grounding", () => {
  it("every rendered clause comes from one of the two contracts", () => {
    const derived = renderScenarioSentence(GOOD, GOOD_SCENARIO);
    expect(derived).toContain(renderPressureFrame(GOOD_SCENARIO.frame));
    // The MOMENT is the trigger's, never the scenario's (Slice 3.2L-R8.1).
    expect(derived.toLowerCase()).toContain(GOOD.trigger.toLowerCase().replace(/^at\s+/, ""));
    /*
      A — the criterion assertion is superseded (Slice R4-R5C11). "Every clause comes from one of
      the two contracts" is unchanged and still asserted above; what changed is WHICH clauses this
      section is entitled to. The Host's completion criterion belongs to THE STANDARD, which
      renders the contract it is a field of, and to WHAT SUCCESS LOOKS LIKE. Repeating it here was
      one of the four occurrences a real learner counted.
    */
    expect(derived).not.toContain(GOOD.completion.criterion);
    expect(derived.length).toBeLessThanOrEqual(700);
  });

  it("changing the behaviour contract changes the scenario", () => {
    /*
      A — RETARGETED, not weakened (Slice R4-R5C11). The drift contract is intact: the displayed
      scenario must still move when its grounding moves. It is the TRIGGER it is grounded in now,
      because the actor and the action left with the restatement.
    */
    const other: BehaviorContract = { ...GOOD, trigger: "before the incoming supervisor arrives" };
    expect(renderScenarioSentence(other, GOOD_SCENARIO)).toContain("Before the incoming supervisor arrives");
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

  it("a scenario can no longer smuggle in an undefined construct — it has no words of its own", () => {
    /*
      This fed a pressure naming a construct ("the agreed escalation process") that no earlier
      element defined, and asserted the dependency graph caught it. At v22 the scenario clause
      comes from `PRESSURE_FRAMES`, which name only generic workplace difficulty — no construct,
      no artifact, nothing to define. The smuggling route is closed rather than policed, and the
      graph correctly finds nothing.
    */
    const d = validateProgramDependencies(
      [
        S("observable_standard", renderStandardSentence(GOOD)),
        S("scenario", renderScenarioSentence(GOOD, { frame: "time_is_short" })),
      ],
      GOOD,
      null,
    );
    expect(d).toBeNull();
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
    /*
      A — THE DECISION IS NO LONGER BTY'S TO COMMIT (Slice R4-R5C11). This asserted the rendered
      sentence CONTAINS "I will <action>" — THE STANDARD in the first person, written by BTY,
      under a heading that says YOUR DECISION. A real learner met that section after reading the
      same clause four times and was then asked to type it back.

      What the test protected is still protected and now stated directly: the section may not
      contain the behaviour, and it may not commit on the learner's behalf.
    */
    expect(d).not.toContain(baseActionPhrase(GOOD.observableAction));
    expect(d).not.toMatch(/\bI will\b/);
    expect(d).toMatch(/\?$/);
    /*
      THE MOMENT NO LONGER LEADS THESE TWO SECTIONS (Slice 3.2P-R3.7). They used to open on a
      folded version of the host's phrase — "At my next shift change" / "At the next shift
      change". W6 shipped "During the next morning huddles" from that fold, and measurement
      showed it also refuses "During the weekly scheduling review" and every Korean moment.
      The host's phrase is now stated verbatim in THE STANDARD and IN CONTEXT above; these
      sections point at the next one, which needs no grammar and works in any language.
    */
    // Slice 3.2R-R2.3 — capitalized, like every sibling renderer. G7 below already expected the
    // capitalized form for APPLY IT; YOUR DECISION was the lone outlier.
    expect(d.startsWith("The next time this happens, ")).toBe(true);
    expect(d).not.toContain("your");
    // The exact old live sentence is not expressible: creation is not a rendered option.
    expect(d).not.toMatch(/contribute to creating|implementing a shared/i);
  });

  it("G7: an application names the next occasion and hands the attempt to the learner", () => {
    const a = renderApplicationSentence(GOOD, APP, null);
    /*
      A — SUPERSEDED (Slice R4-R5C11). The old title said APPLY IT "names the moment, the
      inherited actor and the confirmation", and the third of those was the defect: the section
      restated the behaviour (56% of THE STANDARD as one run) and repeated the Host's criterion
      for the third time, while supplying no actor, trigger or timing the learner did not already
      have. "The next time this happens" was always the only part that was not a repeat, so it is
      the part that stays.
    */
    expect(a.startsWith("The next time this happens")).toBe(true);
    expect(a).not.toContain(baseActionPhrase(GOOD.observableAction));
    expect(a).not.toContain(SERVER.criterion);
  });

  it("G8: a completion check verifies; it cannot ask what the construct contains", () => {
    for (const target of VERIFICATION_TARGETS) {
      for (const mode of RESPONSE_MODES) {
        const q = renderCompletionQuestion(GOOD, { verificationTarget: target, responseMode: mode });
        // GOOD's trigger derives, so every pair renders (Slice 3.2L-R10-A.2).
        expect(q, `${target}/${mode}`).not.toBeNull();
        expect(q!).toMatch(/\?$/);
        expect(q!).not.toMatch(/what (specific )?(elements|fields|steps)/i);
        expect(q!).not.toMatch(/will you include/i);
        // …and none of them asks the participant to invent an occasion.
        expect(q!).not.toMatch(/when is the next time/i);
      }
    }
  });

  it("G9: a follow-up uses the canonical window and introduces no new action", () => {
    const f = renderFollowUpSentence(GOOD, { reviewFocus: "what_you_said", confirmer: "self_report" }, 7);
    expect(f).toContain("In 7 days");
    /*
      A — the window, the tense and the self-report clause are unchanged; the seventh copy of the
      behaviour is gone (Slice R4-R5C11). "introduces no new action" is now literal: it introduces
      no action at all, and points at the attempt the learner made.
    */
    expect(f).toContain("what you actually said at that moment");
    expect(f).not.toContain(baseActionPhrase(GOOD.observableAction));
    expect(f).toContain("your own account");
  });

  it("G10: the action reaches EXACTLY ONE section — the six-views assumption is retired", () => {
    /*
      A — THIS IS THE ASSUMPTION THE LEARNER DISPROVED (Slice R4-R5C11).

      "Changing ONE contract field changes every dependent section" was the strongest statement of
      ONE BEHAVIOURAL AUTHORITY, SIX VIEWS, and it could only pass while all six sections carried
      the action. It was designed to catch drift — six sentences quietly disagreeing — and it did
      that job honestly. What it could not see is that six agreeing sentences are still six
      readings of one sentence, which is what a real learner met and named.

      Drift is now impossible for a stronger reason than agreement: there is only one sentence.
      So the invariant is inverted. The action reaches THE STANDARD and nowhere else.
    */
    const other: BehaviorContract = { ...GOOD, observableAction: "writes the unfinished items on the shared board" };
    expect(renderStandardSentence(other)).toContain("shared board");
    expect(renderStandardSentence(other)).not.toBe(renderStandardSentence(GOOD));
    for (const [name, render] of [
      ["scenario", (b: BehaviorContract) => renderScenarioSentence(b, GOOD_SCENARIO)],
      ["decision", (b: BehaviorContract) => renderDecisionSentence(b, APP)],
      ["application", (b: BehaviorContract) => renderApplicationSentence(b, APP, null)],
      ["completion", (b: BehaviorContract) => renderCompletionQuestion(b, { verificationTarget: "the_behaviour", responseMode: "state_what_you_will_say" })],
      ["follow_up", (b: BehaviorContract) => renderFollowUpSentence(b, { reviewFocus: "what_you_said", confirmer: "self_report" }, 7)],
    ] as const) {
      expect(render(other) ?? "", name).not.toContain("shared board");
      expect(render(other) ?? "", name).not.toContain(baseActionPhrase(GOOD.observableAction));
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
      renderCompletionQuestion(b, { verificationTarget: "the_behaviour", responseMode: "state_what_you_will_say" }),
      renderFollowUpSentence(b, { reviewFocus: "what_you_said", confirmer: "self_report" }, 7),
    ];
  };

  it("G1: a PLURAL actor never produces 'doctors faces' or 'doctors states'", () => {
    // The exact strings the Founder read on the physical iPhone.
    // A completion question can now be null when its trigger does not derive; these
    // fixtures all derive, so filter defensively rather than assert on a possible null.
    const sections = allSections("Doctors").filter((s): s is string => s !== null);
    for (const s of sections) {
      expect(s.toLowerCase()).not.toContain("doctors faces");
      expect(s.toLowerCase()).not.toContain("doctors states");
    }
    /*
      A — RETARGETED (Slice R4-R5C11). The number-guessing contract is unchanged and still the
      point of this test: no renderer may inflect a verb for the actor. It is asserted on the one
      section that still states the actor and the action, because IN CONTEXT and APPLY IT stopped
      restating THE STANDARD. The `not.toContain` sweep above already covers every section.
    */
    expect(sections[0]).toContain("doctors must state each unfinished task");
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

  it("G4: the decision section carries neither perspective's possessive, and no prewritten answer", () => {
    const d = renderDecisionSentence(GOOD, APP2);
    /*
      A — the perspective-collision contract is intact; the first-person COMMITMENT is not
      (Slice R4-R5C11). "I will <action>" was BTY answering under a heading that says YOUR
      DECISION. The collision this test exists to prevent — the host's "your" leaking into a
      first-person sentence — cannot occur in a sentence that is neither.
    */
    expect(d).not.toMatch(/\bI will\b/);
    expect(d).not.toMatch(/\byour\b/);
  });

  it("G5: the instruction stays actor-neutral", () => {
    const a = renderApplicationSentence(GOOD, APP2, null);
    expect(a).not.toMatch(/\bmy\b/);
  });

  it("G13 — RETIRED BY 3.2P-R3.7: no host moment is transformed at all now", () => {
    /*
      This asserted that a moment carrying its own preposition was left alone while a bare one
      gained "At my next …". Both halves were the same mechanism, and the mechanism is gone: the
      application sections never touch the host's phrase. The property it protected — BTY does
      not rewrite the host's words — is now total rather than conditional.
    */
    for (const moment of ["during the Monday huddle", "before closing the case", "next shift change", "아침 허들 때마다"]) {
      const d = renderDecisionSentence(GOOD, { ...APP2, applicationMoment: moment });
      expect(d.startsWith("The next time this happens, "), `${moment} → ${d}`).toBe(true);
      expect(d, "the host's phrase is not echoed, edited or re-cased here").not.toContain(moment);
    }
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
    /*
      A — the meaning-preservation contract is unchanged and asserted where the Host's phrase is
      rendered (Slice R4-R5C11). WHAT HAPPENS NEXT no longer restates the action, so the
      retrospective/present collision this guarded against is unreachable there rather than
      merely avoided — asserted as an absence below.
    */
    expect(standard).toContain("say it blunt");
    expect(standard).toContain("must say it blunt");
    expect(followUp).not.toContain("say it blunt");
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
      completion: renderCompletionQuestion(b, { verificationTarget: "the_behaviour", responseMode: "state_what_you_will_say" }),
      followUp: renderFollowUpSentence(b, { reviewFocus: "what_you_said", confirmer: "self_report" }, 7),
    };
  };

  it("G1: the exact physical failure — no capitalised action anywhere it is rendered", () => {
    /*
      A — RETARGETED (Slice R4-R5C11). The physical defect was a raw Host capital surviving into
      participant text after "expected to". WHAT HAPPENS NEXT no longer states the action at all,
      so the casing contract is asserted where the action is actually rendered — and the follow-up
      is additionally held to carrying none of it.
    */
    const c = contexts("Say it blunt");
    expect(c.standard).toContain("must say it blunt");
    expect(c.standard).not.toContain("Say it blunt");
    expect(c.followUp).not.toContain("say it blunt");
  });

  it("G2: exactly ONE section bears the action, and it uses the canonical phrase", () => {
    /*
      A — the canonical-phrase contract is unchanged; the census it ran is inverted
      (Slice R4-R5C11). This asserted that EVERY section contains the canonical phrase, which was
      the six-views assumption stated as a loop. A real learner read a program built that way and
      counted the same clause seven times. One phrase, one section: the canonicalisation still has
      to be right, and now there is exactly one place it can be wrong.
    */
    const canonical = baseActionPhrase("Say it blunt");
    expect(canonical).toBe("say it blunt");
    const c = contexts("Say it blunt");
    expect(c.standard).toContain(`must ${canonical}`);
    // The raw Host casing must never survive into participant text, in any section.
    for (const [name, sentence] of Object.entries(c)) expect(sentence ?? "", name).not.toContain("Say it blunt");
    for (const name of ["scenario", "decision", "application", "completion", "followUp"] as const) {
      expect(c[name] ?? "", name).not.toContain(canonical);
    }
  });

  it("G3: an acronym is preserved wherever it sits in the phrase", () => {
    // After the head verb…
    // A — asserted on the one section that renders the action now (Slice R4-R5C11); the
    // preservation rule itself is untouched, and `baseActionPhrase` is still checked directly.
    const after = contexts("Use SBAR for the handoff");
    expect(after.standard).toContain("use SBAR for the handoff");
    // Checked on the ORIGINAL string: lowercasing it first would make this vacuous.
    for (const [name, s] of Object.entries(after)) expect(s ?? "", name).not.toContain("use sbar");
    // …and AS the head verb, where a naive lowercase would have destroyed it.
    expect(baseActionPhrase("SBAR the handoff")).toBe("SBAR the handoff");
    expect(contexts("SBAR the handoff").standard).toContain("SBAR the handoff");
  });

  it("G3: an acronym is never de-inflected into nonsense", () => {
    // "SOS" ends in -s; a blind agreement-strip would emit "SO".
    expect(baseActionPhrase("SOS the duty lead")).toBe("SOS the duty lead");
    expect(baseActionPhrase("Send an SOS")).toBe("send an SOS");
  });

  it("G4: a proper name keeps its capitals", () => {
    // A — same retarget as G3 (Slice R4-R5C11): capitals are preserved where the action renders,
    // and no section may lower-case them.
    const c = contexts("Call Dr. Lee");
    expect(c.standard).toContain("call Dr. Lee");
    for (const [name, s] of Object.entries(c)) expect(s ?? "", name).not.toContain("dr. lee");
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
      expect((s ?? "").toLowerCase()).not.toMatch(/doctors (faces|states|does)\b/);
    }
  });

  it("G6: perspective stays separated", () => {
    const c = contexts("Say it blunt");
    /*
      A — the perspective SPLIT is the property this test protects and it is unchanged; the two
      sentences it pinned are not (Slice R4-R5C11). Both restated the action, one in the first
      person as a commitment BTY had already made. Neither may borrow the other's possessive, and
      neither states the behaviour.
    */
    expect(c.decision).not.toMatch(/\byour\b/);
    expect(c.application).not.toMatch(/\bmy\b/);
    expect(c.decision).not.toContain("say it blunt");
    expect(c.application).not.toContain("say it blunt");
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
      renderCompletionQuestion(b, { verificationTarget: "the_behaviour", responseMode: "state_what_you_will_say" }),
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
    // A — retargeted to THE STANDARD, which is where the action renders now (Slice R4-R5C11);
    // the follow-up is held to carrying no casing at all because it carries no action.
    const std = sections("Say it blunt")[0];
    expect(std).toContain("must say it blunt");
    expect(std).not.toContain("Say it blunt");
    expect(sections("Say it blunt")[5]).not.toContain("say it blunt");
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

  it("G1: the v5 subject-less completion phrase is unrepresentable, not refused", () => {
    /*
      v5 returned "receive a confirmation from the next owner" — a bare infinitive that
      rendered as "It is complete when receive a confirmation…". R8 refused it by demanding a
      named confirmer; v11 removes the field, so the model has no place to return that string
      and no grammatical subject is ever decided. `raw()` proves it: the fixture mirrors the
      real response shape and carries no completion key at all.
    */
    expect(Object.keys(raw())).toEqual(["observable_action"]);
    expect(validateBehaviorContract(raw(), SERVER).ok).toBe(true);
  });

  it("G2: a completion the model tried to smuggle back in is IGNORED, not merged", () => {
    const smuggled = validateBehaviorContract(
      { ...raw(), completion: { confirmed_by: "the records manager", confirmation_action: "file the note" } },
      SERVER,
    );
    expect(smuggled.ok).toBe(true);
    if (smuggled.ok) {
      expect(smuggled.value.completion).toEqual({ criterion: SERVER.criterion });
      expect(JSON.stringify(smuggled.value)).not.toContain("records manager");
    }
  });

  it("G3/G4: ONE completion authority reaches every section", () => {
    /*
      A — ONE AUTHORITY, ONE PLACE (Slice R4-R5C11). This asserted the criterion reaches FOUR
      sections and moves in all of them together. Single authority was right; four surfaces was
      the defect — a real learner read the same evidence sentence four times in one sitting, and
      the earlier repair only varied the four words in front of it.

      The criterion is still rendered from one authority and still moves with it. It reaches THE
      STANDARD, whose behaviour contract it is a field of, and nowhere else BTY writes.
    */
    const b = { ...GOOD, completion: { criterion: "The handover log shows the next owner for every open item" } };
    const criterion = "The handover log shows the next owner for every open item";
    expect(renderStandardSentence(b)).toContain(criterion);
    for (const [name, s] of [
      ["scenario", renderScenarioSentence(b, GOOD_SCENARIO)],
      ["application", renderApplicationSentence(b, APP8, null)],
      ["follow_up", renderFollowUpSentence(b, { reviewFocus: "the_confirmation", confirmer: "self_report" }, 7)],
    ] as const) {
      expect(s, name).not.toContain(criterion);
    }

    // Changing it still moves the one section that states it.
    const other = { ...b, completion: { criterion: "The duty lead signs the handover" } };
    expect(renderStandardSentence(other)).toContain("The duty lead signs the handover");
    expect(renderStandardSentence(other)).not.toContain(criterion);
  });

  it("G4: APPLY IT can no longer state a second, different completion", () => {
    // v5's application_contract carried its own evidence field; there is nowhere left to
    // put a competing answer to "how will we know it happened".
    expect(Object.keys(APP8)).toEqual(["applicationMoment"]);
    const a = renderApplicationSentence(GOOD, APP8, null);
    /*
      A — STRENGTHENED (Slice R4-R5C11). v5's application contract carried its own evidence field
      and the live proposal gave two different answers to "how will we know it happened". v11
      removed the field; this section now states no completion at all, which is a stricter form of
      the same guarantee — there is no second answer because there is no answer here.
    */
    expect(a).not.toContain("You will know it happened by this:");
    expect(a).not.toContain(GOOD.completion.criterion);
  });

  it("G5/G6: a context fragment never receives a doubled preposition", () => {
    for (const [context, expected] of [
      ["during a team meeting just before a project deadline", "During a team meeting"],
      ["at the end of the evening shift", "At the end of the evening shift"],
      ["when the escalation lands", "When the escalation lands"],
      ["while the ward is at capacity", "While the ward is at capacity"],
      ["before the case closes", "Before the case closes"],
      ["after the last patient leaves", "After the last patient leaves"],
      /*
        3.2P-R3.7: a fragment with NO preposition of its own is now stated as the host wrote it,
        rather than gaining "At ". That is the same decision as everywhere else — BTY repeats the
        host's moment, it does not complete their grammar — and it is what lets a Korean moment
        render at all. The property this test exists for is unchanged: never a doubled one.
      */
      ["the last ten minutes of a busy shift", "The last ten minutes of a busy shift"],
    ] as const) {
      // The leading moment is the TRIGGER's — the host's own words (Slice 3.2L-R8.1, 3.2P-R3.7).
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
