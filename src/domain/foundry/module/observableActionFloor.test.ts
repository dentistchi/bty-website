import { describe, it, expect } from "vitest";
import {
  composeObservableAction,
  isInterrogativeAction,
  isRenderableAction,
  isMetaStandardText,
  validateBehaviorContract,
  renderStandardSentence,
  CONTRACT_DEFECT_REASONS,
} from "./program-coherence";
import { validateProgramProposal, isSemanticRepairableCode, requiredProgramKinds } from "./program-authorship";
import type { BuilderAnswers } from "./module-builder";

/**
 * SLICE 3.2P-R2.1 — A QUESTION IS NOT A BEHAVIOUR.
 *
 * The live pilot's Host answer is a question, and it reached `observable_action` intact
 * through a whole validated proposal. Everything downstream did its job faithfully and the
 * learner would have been shown "…the huddle leader must at the next huddle, what exact words
 * will you use…?". There was no floor on the action's grammatical shape.
 *
 * These fixtures are the floor's proof. Zero provider calls.
 */
const ANSWERS = {
  problem:
    "During morning huddles, team members report problems but leave without naming who will act or when the next step will happen.",
  audienceType: "leaders",
  evidenceType: "confirmed",
  followUpDays: 7,
  learningNeeds: ["shared_standard", "practice"],
  materialIntent: "pdf",
  sharedQuestion: "In your own words, what is the most important standard from this training?",
  successEvidence: "The huddle note records one owner and one deadline for every agreed action.",
  arenaRecommended: true,
  completionPrompt:
    "What specific phrases will you use in the next huddle to confirm the action owner and deadline for each reported issue?",
  recurringMoment: "During morning huddles",
  observableBehavior:
    "At the next huddle, what exact words will you use to confirm the owner, action, and deadline?",
  capabilityCandidate: "Accountability",
} as unknown as BuilderAnswers;

/** The exact stored Host answer, verbatim — the value that must be refused as an action. */
const LIVE_QUESTION = ANSWERS.observableBehavior as string;

/** Server-owned since v11 (Slice 3.2P-R3.4-R1) — the Host's evidence, not a model field. */
/**
 * WHAT THE SERVER SUPPLIES (Slice 3.2P-R3.6-R1). Three of the contract's four roles are Host or
 * product authority now — actor, moment, evidence — so a validator fixture supplies them the way
 * the runtime does, and the model's object carries only the two action fields.
 */
const SERVER = {
  actor: "you",
  trigger: "at each morning huddle, before the group leaves",
  criterion: "The huddle note records one owner and one deadline for every agreed action",
};

const GROUNDED = {
  actor: "the huddle leader",
  trigger: "at each morning huddle, before the group leaves",
  action_verb: "name",
  action_detail: "one owner and one deadline for every agreed action and write them in the huddle note",
};

describe("[3.2P-R2.1] the corpus the floor must not break", () => {
  /**
   * Every observable action written in this repository's fixtures, plus the four the dispatch
   * named. Actions ABOUT asking or checking are ordinary behaviours and must keep passing —
   * "confirm who owns the action" is the behaviour this very pilot teaches.
   */
  const ACTIONS = [
    "names one owner and one deadline for every agreed action and writes them in the huddle note",
    "state each unfinished item and identify its next owner",
    "states each open item aloud to the person taking over",
    "make a confirmation call and follow the checklist of required questions",
    "writes the unfinished items on the shared board",
    "state each open item using the handover standard",
    "Say it blunt",
    "Ask the patient to confirm the appointment date",
    "Check whether the owner has been named",
    "Confirm who owns the action and by when",
    "Record the deadline in the huddle note",
    "asks what is still outstanding and writes down the answer",
    // A wh-word HEAD that is not a question. This one broke the first, broader rule and is why
    // the floor needs subject-auxiliary inversion rather than a wh-head alone.
    "when in doubt, name the owner out loud",
    "where ownership is unclear, say so before the group leaves",
    "how the deadline is recorded is agreed out loud", // wh-head, aux, but no inverted subject
    // Ambiguous without punctuation, and deliberately ACCEPTED — a false refusal costs a Host
    // a legitimate program, and the marked/inverted forms already cover the measured defect.
    "which action needs an owner",
  ];

  it("accepts every one of them", () => {
    const refused = ACTIONS.filter((a) => isInterrogativeAction(a));
    expect(refused, `wrongly refused:\n${refused.join("\n")}`).toEqual([]);
  });

  it("and they all remain renderable actions", () => {
    for (const a of ACTIONS) expect(isRenderableAction(a), a).toBe(true);
  });
});

describe("[3.2P-R2.1] what the floor refuses", () => {
  const QUESTIONS = [
    LIVE_QUESTION,
    "what exact words will you use?",
    "What will you say to confirm the owner",       // inverted, no mark — still a question
    "How will you make sure the deadline is set?",
    "Who owns the next step?",
    "what exact words does the leader use to close the huddle",
    "다음 허들에서 어떤 말을 하시겠습니까?",              // Korean, carries the mark
    "confirm the owner and the deadline?",           // verb head, but explicitly a question
  ];

  it("refuses every one", () => {
    const accepted = QUESTIONS.filter((q) => !isInterrogativeAction(q));
    expect(accepted, `wrongly accepted:\n${accepted.join("\n")}`).toEqual([]);
  });

  it("empty is NOT interrogative — emptiness is `missing`, an earlier and different defect", () => {
    expect(isInterrogativeAction("")).toBe(false);
    expect(isInterrogativeAction("   ")).toBe(false);
    const r = validateBehaviorContract({ observable_action: "" }, SERVER);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.defect).toEqual({ field: "observableAction", reason: "missing" });
  });
});

describe("[3.2P-R2.1] PART 4 — the exact live negative control", () => {
  it("BEFORE the floor this passed; now the contract refuses it precisely", () => {
    const r = validateBehaviorContract({ observable_action: LIVE_QUESTION }, SERVER);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.defect).toEqual({ field: "observableAction", reason: "interrogative_action" });
  });

  it("and the WHOLE proposal refuses it, carrying the diagnosis", () => {
    const kinds = requiredProgramKinds(ANSWERS);
    const content: Record<string, string> = {
      why_it_matters: "When a huddle ends without a named owner and a deadline, the problem stays where it was.",
      observable_standard: "The huddle leader names one owner and one deadline for every agreed action.",
      scenario: "The huddle is running late and people are already standing to leave.",
      reflection: "In your own words, what is the most important standard from this training?",
      field_application: "At the next morning huddle, name one owner and one deadline for every agreed action.",
      completion_check: "What exactly will you say at the next morning huddle to name the owner and the deadline?",
      follow_up: "In seven days you will be asked what you actually said at the huddle.",
    };
    const r = validateProgramProposal(
      {
        program: {
          display_title: "End every huddle with an owner and a deadline",
          elements: kinds.map((k) => ({ kind: k, content: content[k], rationale: "grounded" })),
          assumptions: [], warnings: [],
          /* The host's question, split the way a model would send it (Slice 3.2P-R3.7-R2). */
          behavior_contract: { action_verb: "at", action_detail: LIVE_QUESTION.replace(/^at\s+/i, "") },
          scenario_contract: {
            pressure_condition: "the huddle is running late and people are already standing to leave",
            pressure_detail: null,
          },
          completion_contract: { verification_target: "the_behaviour", response_mode: "state_what_you_will_say" },
          follow_up_contract: { review_focus: "what_you_said", confirmer: "self_report" },
        },
      },
      ANSWERS,
      [],
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // The top-level refusal semantics are UNCHANGED — no new parent-level family was invented.
    expect(r.code).toBe("non_observable_standard");
    expect(r.kind).toBe("observable_standard");
    expect(r.contract).toEqual({ field: "observableAction", reason: "interrogative_action" });
  });

  it("the grounded contract still PASSES, and still renders", () => {
    // The domain validator takes the COMPOSED action; the two wire fields are the proposal's.
    const r = validateBehaviorContract(
      { observable_action: composeObservableAction(GROUNDED.action_verb, GROUNDED.action_detail) },
      SERVER,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(renderStandardSentence(r.value)).toContain("must name one owner and one deadline");
  });
});

describe("[3.2P-R2.1] the floor is not repairable, and not a substitute for anything", () => {
  it("neither refusal may be retried around", () => {
    expect(isSemanticRepairableCode("non_observable_standard")).toBe(false);
    expect(isSemanticRepairableCode("missing_required_kind")).toBe(false);
  });

  it("`interrogative_action` joined the closed vocabulary and nothing left it", () => {
    expect(CONTRACT_DEFECT_REASONS).toContain("interrogative_action");
    for (const r of ["missing", "too_long", "meta_only", "not_a_role", "no_moment", "no_confirmation"]) {
      expect(CONTRACT_DEFECT_REASONS, r).toContain(r);
    }
  });

  it("isMetaStandardText was NOT repurposed — it answers a different question", () => {
    /*
      It exists to catch a CONSTRUCT'S LIFE CYCLE stated as a behaviour. It returns false for
      this question and true for empty input, so wiring it here would have refused the wrong
      things and missed the actual defect. Left exactly as it was.
    */
    expect(isMetaStandardText(LIVE_QUESTION)).toBe(false);
    expect(isMetaStandardText("a shared handoff standard is created and utilized")).toBe(true);
  });
});
