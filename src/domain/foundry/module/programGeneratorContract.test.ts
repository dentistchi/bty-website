import { describe, it, expect } from "vitest";
import {
  RESPONSE_MODES,
  VERIFICATION_TARGETS,
  definiteConstructs,
  namesIndependentMoment,
  renderCompletionQuestion,
  validateProgramDependencies,
  type BehaviorContract,
  type ProgramSection,
} from "./program-coherence";

/**
 * SLICE 3.2O-R1 — THE GENERATOR CONTRACT, ENFORCED BY TEST RATHER THAN BY HOPE.
 *
 * Two live windows were spent on a real pilot and both were refused. Neither refusal was the
 * model's fault:
 *
 *   1. BTY's own deterministic completion renderer emitted "…follow this standard" and BTY's
 *      own dependency graph then refused it, because that training's behaviour is about
 *      confirmation calls and no section ever defined a "standard".
 *   2. The scenario rule was enforced on BOTH pressure fields and written into the prompt for
 *      only one of them.
 *
 * The validators were right both times and are untouched. These tests pin the two contracts
 * the rest of the system has to honour, so neither defect can return quietly. Zero provider
 * calls — every assertion is deterministic.
 */

/** The real pilot shape: the behaviour is a call + a checklist. No construct named "standard". */
const CALLS: BehaviorContract = {
  actor: "Front desk staff",
  trigger: "before each scheduled appointment",
  observableAction: "make a confirmation call and follow the checklist of required questions",
  completion: { criterion: "The completed checklist is reviewed before the shift ends" },
};

/** A training whose behaviour genuinely IS a standard — the case that must not regress. */
const HANDOVER: BehaviorContract = {
  actor: "The outgoing person",
  trigger: "at each handover",
  observableAction: "state each open item using the handover standard",
  completion: { criterion: "The handover note lists every open item and who now owns it" },
};

const standardSection = (b: BehaviorContract, content: string): ProgramSection[] => [
  { kind: "observable_standard", content },
  ...([] as ProgramSection[]),
];

const CALLS_STANDARD =
  "Before each scheduled appointment, front desk staff make a confirmation call and follow the checklist of required questions.";
const HANDOVER_STANDARD = "At each handover, the outgoing person states each open item using the handover standard.";

describe("[3.2O-R1] the renderer may never invent a construct the program has not defined", () => {
  /**
   * THE CLASS, not the one sentence. Every target × mode pair, under a behaviour contract
   * that defines no construct at all — nothing the renderer produces may refer definitely to
   * one, because there is nothing for such a reference to point at.
   */
  it("no target × mode pair emits a definite construct reference for a construct-free behaviour", () => {
    const offenders: string[] = [];
    for (const target of VERIFICATION_TARGETS) {
      for (const mode of RESPONSE_MODES) {
        const sentence = renderCompletionQuestion(CALLS, { verificationTarget: target, responseMode: mode });
        if (!sentence) continue;
        const constructs = definiteConstructs(sentence);
        if (constructs.length > 0) offenders.push(`${target}+${mode} → [${constructs}] :: ${sentence}`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("and none of them is refused by the dependency graph for wording the renderer chose", () => {
    for (const target of VERIFICATION_TARGETS) {
      for (const mode of RESPONSE_MODES) {
        const sentence = renderCompletionQuestion(CALLS, { verificationTarget: target, responseMode: mode });
        if (!sentence) continue;
        const defect = validateProgramDependencies(
          [...standardSection(CALLS, CALLS_STANDARD), { kind: "completion_check", content: sentence }],
          CALLS,
          null,
        );
        expect(defect, `${target}+${mode} :: ${sentence} → ${JSON.stringify(defect)}`).toBeNull();
      }
    }
  });

  /**
   * The renderer may ECHO the behaviour's own words — "follow the checklist" is the trained
   * action and belongs in the question. What it may not do is ADD a construct noun the
   * contract never used, which is precisely how "this standard" got in.
   */
  it("never ADDS a construct noun the behaviour contract does not already use", () => {
    const contractText = [
      CALLS.actor, CALLS.trigger, CALLS.observableAction,
      CALLS.completion.criterion,
    ].join(" ").toLowerCase();
    for (const target of VERIFICATION_TARGETS) {
      for (const mode of RESPONSE_MODES) {
        const s = (renderCompletionQuestion(CALLS, { verificationTarget: target, responseMode: mode }) ?? "").toLowerCase();
        for (const noun of ["standard", "process", "checklist", "procedure", "template", "framework", "rubric", "practice"]) {
          if (contractText.includes(noun)) continue; // the behaviour's own vocabulary is fine
          expect(s.includes(noun), `${target}+${mode} invented "${noun}" :: ${s}`).toBe(false);
        }
      }
    }
  });

  it("still asks a real closing question — a wh-word, at the derived moment", () => {
    const s = renderCompletionQuestion(CALLS, { verificationTarget: "the_behaviour", responseMode: "name_the_moment" });
    expect(s).toBe("Before the next scheduled appointment, what exactly will you do?");
  });

  /** The second offender the matrix audit caught — an idiom that parsed as a construct. */
  it("the application-plan target no longer says 'into practice'", () => {
    for (const mode of RESPONSE_MODES) {
      const s = renderCompletionQuestion(CALLS, { verificationTarget: "the_application_plan", responseMode: mode }) ?? "";
      expect(s.toLowerCase(), s).not.toContain("into practice");
    }
    expect(renderCompletionQuestion(CALLS, { verificationTarget: "the_application_plan", responseMode: "state_what_you_will_say" }))
      .toBe("What exactly will you say when you apply this?");
  });

  it("goes quiet rather than inventing a moment when the trigger does not recur", () => {
    const oneOff: BehaviorContract = { ...CALLS, trigger: "at the annual audit on 3 March" };
    expect(renderCompletionQuestion(oneOff, { verificationTarget: "the_behaviour", responseMode: "name_the_moment" })).toBeNull();
  });
});

describe("[3.2O-R1] a behaviour that DOES define a standard is unaffected", () => {
  it("the same pair renders and passes for the handover training", () => {
    const s = renderCompletionQuestion(HANDOVER, { verificationTarget: "the_behaviour", responseMode: "name_the_moment" })!;
    expect(s).toContain("what exactly will you do");
    expect(
      validateProgramDependencies(
        [...standardSection(HANDOVER, HANDOVER_STANDARD), { kind: "completion_check", content: s }],
        HANDOVER,
        null,
      ),
    ).toBeNull();
  });

  it("a section may still refer to a construct the standard DID define", () => {
    // The graph's real job is unchanged: this passes only because the standard names it.
    expect(
      validateProgramDependencies(
        [
          ...standardSection(HANDOVER, HANDOVER_STANDARD),
          { kind: "field_application", content: "At the next handover, use the handover standard before you leave." },
        ],
        HANDOVER,
        null,
      ),
    ).toBeNull();
  });

  it("and is STILL refused when a section invents one the standard never defined", () => {
    // Proof the validator was not weakened: the same shape that refused our pilot still refuses.
    expect(
      validateProgramDependencies(
        [
          ...standardSection(CALLS, CALLS_STANDARD),
          { kind: "field_application", content: "Before the next appointment, follow this standard." },
        ],
        CALLS,
        null,
      ),
    ).toEqual({ kind: "field_application", construct: "standard", branch: "used_before_defined", counterpartKind: null });
  });
});

describe("[3.2O-R1] THE REAL PILOT, replayed offline", () => {
  /**
   * Attempt 2 (`e1ab17ba…`) recorded exactly: kind `completion_check`, branch
   * `used_before_defined`, construct `standard`. This is that refusal, reconstructed from its
   * durable diagnostics and the real behaviour shape — and it must no longer occur.
   */
  it("the exact refused combination now passes", () => {
    const sentence = renderCompletionQuestion(CALLS, {
      verificationTarget: "the_behaviour",
      responseMode: "name_the_moment",
    })!;
    const defect = validateProgramDependencies(
      [...standardSection(CALLS, CALLS_STANDARD), { kind: "completion_check", content: sentence }],
      CALLS,
      null,
    );
    expect(defect, "dependency_inversion must be gone").toBeNull();
  });
});

describe("[3.2O-R1] scenario pressure: a difficulty, never a second occasion", () => {
  it("ALLOWS operational pressure that names no occasion", () => {
    for (const ok of [
      "the front desk queue is building",
      "information is incomplete and another task is competing for attention",
      "the patient has already been told something different",
      "a senior colleague disagrees and is waiting for an answer",
      "the team is short-staffed and the phone keeps ringing",
    ]) {
      expect(namesIndependentMoment(ok), ok).toBe(false);
    }
  });

  it("REFUSES a second time or event anchor, in either field", () => {
    for (const bad of [
      "during the next confirmation call",
      "during the call the patient is distracted",
      "before the next appointment",
      "at the end of the day",
      "during a team meeting just before a project deadline",
      "at the next handover",
    ]) {
      expect(namesIndependentMoment(bad), bad).toBe(true);
    }
  });

  it("does not over-broaden: an operational noun alone is not an occasion", () => {
    // The refusal is structural — a temporal preposition governing an occasion noun — not a
    // word list. A sentence may mention the work without anchoring a second moment.
    for (const ok of [
      "the checklist is missing from the desk",
      "two appointments have already overrun and the queue is long",
      "calls are stacking up while the system is slow",
    ]) {
      expect(namesIndependentMoment(ok), ok).toBe(false);
    }
  });
});
