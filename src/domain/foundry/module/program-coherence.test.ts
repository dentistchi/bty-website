import { describe, it, expect } from "vitest";
import {
  validateBehaviorContract,
  renderStandardSentence,
  isMetaStandardText,
  validateProgramDependencies,
  definiteConstructs,
  ungroundedExistingEntity,
  ARTIFACT_NOUNS,
  CONSTRUCT_NOUNS,
  type BehaviorContract,
  type ProgramSection,
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
    );
    expect(d).not.toBeNull();
    expect(d).toMatchObject({ kind: "field_application", construct: "standard", reason: "used_before_defined" });
  });

  it("G5: the Host naming the topic does NOT count as defining it", () => {
    // The canonical draft's observableBehavior is "Create a shared handoff standard" —
    // that authorises BTY to PROPOSE the standard and says nothing about its steps. This
    // is precisely how the live program justified telling someone to use it.
    const d = validateProgramDependencies(
      [S("observable_standard", renderStandardSentence(GOOD)), S("action_decision", "I will apply the shared handoff standard on Monday.")],
      GOOD,
    );
    expect(d).toMatchObject({ reason: "used_before_defined" });
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
    );
    expect(d).not.toBeNull();
    expect(d).toMatchObject({ kind: "completion_check", construct: "standard", reason: "defined_after_use" });
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
    );
    expect(d).toBeNull();
  });

  it("a scenario may not assume a construct nothing defined", () => {
    const d = validateProgramDependencies(
      [S("observable_standard", renderStandardSentence(GOOD)), S("scenario", "The shift ends and the agreed escalation process is already in dispute.")],
      GOOD,
    );
    expect(d).toMatchObject({ kind: "scenario", reason: "used_before_defined" });
  });

  it("with no validated contract, nothing is defined", () => {
    const d = validateProgramDependencies([S("field_application", LIVE_APPLY)], null);
    expect(d).toMatchObject({ reason: "used_before_defined" });
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
    );
    expect(d).toMatchObject({ kind: "completion_check", reason: "defined_after_use" });
  });
});
