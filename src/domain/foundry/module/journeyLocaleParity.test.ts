import { describe, it, expect } from "vitest";
import {
  renderApplicationSentence,
  renderCompletionQuestion,
  renderDecisionSentence,
  renderFollowUpSentence,
  renderPressureFrame,
  renderRationaleSentence,
  renderScenarioSentence,
  renderStandardSentence,
  pressureFrameIds,
  type BehaviorContract,
} from "./program-coherence";
import { JOURNEY_COPY_TABLES, journeyCopy } from "./journeyLocaleCopy";
import { contractsFromProposal, deriveInstructionalContent, validateProgramProposal } from "./program-authorship";
import type { BuilderAnswers } from "./module-builder";

/**
 * SLICE R4-R5C13 — KO/EN PARITY FOR THE SEVEN SECTIONS BTY WRITES ITSELF.
 *
 * FOUNDER-OBSERVED, on a real Korean draft ("리더의 행동"): WHY and THE STANDARD read Korean
 * because they interpolate the Host's own Korean, while YOUR DECISION, APPLY IT, BEFORE YOU
 * FINISH and WHAT HAPPENS NEXT rendered fully English. That is not a coincidence of those four
 * — R4-R5C11 removed the behaviour clause from exactly them, which was right for repetition and
 * left them 100% BTY-authored. The frames had never been localized, and `composeObservableAction`
 * says so in as many words.
 *
 * The assertions below are about the SEAM, not about translation quality: no ASCII sentence
 * scaffolding survives in a Korean render, the English output is byte-identical to what C11
 * shipped, and Host text is never touched in either language.
 */

const KO_ACTOR = "팀 리더";
const KO_ACTION = "담당자와 기한을 확인한다";
const KO_TRIGGER = "아침 허들 때마다";
const KO_CRITERION = "허들 노트에 담당자와 기한이 기록된다";

const KO_BEHAVIOR: BehaviorContract = {
  actor: KO_ACTOR,
  trigger: KO_TRIGGER,
  observableAction: KO_ACTION,
  completion: { criterion: KO_CRITERION },
} as unknown as BehaviorContract;

const EN_BEHAVIOR: BehaviorContract = {
  actor: "team leads",
  trigger: "At the morning huddle",
  observableAction: "confirm the owner and the deadline",
  completion: { criterion: "the huddle note records one owner and one deadline" },
} as unknown as BehaviorContract;

const APP = { applicationMoment: KO_TRIGGER };
/** Sentence scaffolding BTY would only emit in English. Host text is never matched by these. */
const ENGLISH_FRAME =
  /\b(?:must|the next time this happens|completion evidence|this is easiest to skip|first real chance|you will be asked|in \d+ days|what will you do|this program introduces|for exactly that|in practice|your host|not an observation|what exactly will you|what could stop you)\b/i;

// ---------------------------------------------------------------------------
// T1-T6 · Korean output carries no English frame
// ---------------------------------------------------------------------------

describe("[R4-R5C13 · T1-T6] a Korean program renders Korean sentences", () => {
  it("T1 YOUR DECISION", () => {
    const ko = renderDecisionSentence(KO_BEHAVIOR, APP, "ko");
    expect(ko).toBe("다음에 이런 상황이 생기면 무엇을 다르게 해보겠습니까?");
    expect(ko).not.toMatch(ENGLISH_FRAME);
  });

  it("T2 APPLY IT, with and without a construct", () => {
    const bare = renderApplicationSentence(KO_BEHAVIOR, APP, null, "ko");
    expect(bare).toBe("다음에 이런 상황이 생기는 것이 실제로 해볼 첫 기회입니다.");
    expect(bare).not.toMatch(ENGLISH_FRAME);
    const named = renderApplicationSentence(KO_BEHAVIOR, APP, { noun: "체크리스트", label: "체크리스트" } as never, "ko");
    expect(named).toContain("실제 업무에서의");
    expect(named).not.toMatch(ENGLISH_FRAME);
  });

  it("T3 BEFORE YOU FINISH keeps learner-owned decision semantics in Korean", () => {
    const ask = renderCompletionQuestion(KO_BEHAVIOR, { verificationTarget: "the_behaviour", responseMode: "name_the_moment" } as never, "ko");
    expect(ask).toBe("다음에 이런 상황이 생기면 정확히 무엇을 하시겠습니까?");
    expect(ask).not.toMatch(ENGLISH_FRAME);
    // It asks the learner to decide; it does not quote the behaviour back at them (C12A).
    expect(ask).not.toContain(KO_ACTION);
    for (const mode of ["state_what_you_will_say", "name_what_could_stop_you"] as const) {
      for (const target of ["the_behaviour", "the_application_plan", "the_confirmation_step"] as const) {
        const q = renderCompletionQuestion(KO_BEHAVIOR, { verificationTarget: target, responseMode: mode } as never, "ko");
        expect(q, `${mode}/${target}`).not.toMatch(ENGLISH_FRAME);
        expect(q, `${mode}/${target}`).toMatch(/\?$/);
      }
    }
  });

  it("T4 WHAT HAPPENS NEXT at 7 days keeps timing + the self-report boundary", () => {
    const ko = renderFollowUpSentence(KO_BEHAVIOR, { reviewFocus: "what_happened_next", confirmer: "self_report" } as never, 7, "ko");
    expect(ko).toBe("7일 후, 실제로 해봤을 때 어떻게 되었는지 다시 묻겠습니다. 이것은 본인의 경험에 대한 답이며, 다른 사람의 관찰은 아닙니다.");
    expect(ko).not.toMatch(ENGLISH_FRAME);
    expect(ko).not.toContain(KO_ACTION); // C11: no seventh copy of the behaviour
  });

  it("T5 WHAT HAPPENS NEXT at 30 days — same semantics, correct duration", () => {
    const ko = renderFollowUpSentence(KO_BEHAVIOR, { reviewFocus: "what_happened_next", confirmer: "the_host" } as never, 30, "ko");
    expect(ko.startsWith("30일 후,")).toBe(true);
    expect(ko).toContain("담당자가 함께 읽습니다.");
    expect(ko).not.toMatch(ENGLISH_FRAME);
  });

  it("T6 IN CONTEXT is situation + pressure, never the Standard again", () => {
    const ko = renderScenarioSentence(KO_BEHAVIOR, { frame: "time_is_short" } as never, "ko");
    expect(ko).toBe("아침 허들 때마다, 시간이 촉박할 때 가장 놓치기 쉽습니다.");
    expect(ko).not.toMatch(ENGLISH_FRAME);
    expect(ko).not.toContain(KO_ACTION);
    expect(ko).not.toContain(KO_CRITERION);
    // Every frame the model may choose has Korean words, not a blank and not English.
    for (const id of pressureFrameIds()) {
      const clause = renderPressureFrame(id, "ko");
      expect(clause, id).not.toBe("");
      expect(clause, id).toMatch(/[가-힣]/);
      expect(renderPressureFrame(id, "en"), id).toMatch(/^[\x20-\x7E]+$/);
    }
  });

  it("WHY and THE STANDARD carry Korean frames too", () => {
    const why = renderRationaleSentence("리더가 신뢰를 잃고 있다", KO_BEHAVIOR, null, "ko");
    expect(why).toContain("이 프로그램이 그 문제에 대해 내놓는 것은");
    expect(why).not.toMatch(ENGLISH_FRAME);
    const std = renderStandardSentence(KO_BEHAVIOR, "ko");
    expect(std).toBe(`${KO_TRIGGER}, ${KO_ACTOR} — ${KO_ACTION}. 완료 증거: ${KO_CRITERION}.`);
    expect(std).not.toMatch(ENGLISH_FRAME);
  });
});

// ---------------------------------------------------------------------------
// T7 · English is unchanged
// ---------------------------------------------------------------------------

describe("[R4-R5C13 · T7] English output is byte-identical to what R4-R5C11 shipped", () => {
  it("every renderer", () => {
    expect(renderStandardSentence(EN_BEHAVIOR)).toBe(
      "At the morning huddle, team leads must confirm the owner and the deadline. Completion evidence: The huddle note records one owner and one deadline.",
    );
    expect(renderScenarioSentence(EN_BEHAVIOR, { frame: "time_is_short" } as never)).toBe(
      "At the morning huddle, when time is running short, this is easiest to skip.",
    );
    expect(renderDecisionSentence(EN_BEHAVIOR, APP)).toBe("The next time this happens, what will you do differently?");
    expect(renderApplicationSentence(EN_BEHAVIOR, APP, null)).toBe(
      "The next time this happens is the first real chance to try it for yourself.",
    );
    expect(renderCompletionQuestion(EN_BEHAVIOR, { verificationTarget: "the_behaviour", responseMode: "name_the_moment" } as never)).toBe(
      "The next time this happens, what exactly will you do?",
    );
    expect(renderFollowUpSentence(EN_BEHAVIOR, { reviewFocus: "what_happened_next", confirmer: "self_report" } as never, 7)).toBe(
      "In 7 days you will be asked what happened when you tried it. That is your own account of it, not an observation.",
    );
    expect(renderRationaleSentence("Handoffs drop things", EN_BEHAVIOR, null)).toBe(
      "Handoffs drop things. This program introduces one visible way of working for exactly that.",
    );
  });

  it("an omitted or unknown locale renders English rather than guessing", () => {
    expect(renderDecisionSentence(EN_BEHAVIOR, APP)).toBe(renderDecisionSentence(EN_BEHAVIOR, APP, "en"));
    expect(journeyCopy(undefined).decision).toBe(journeyCopy("en").decision);
  });
});

// ---------------------------------------------------------------------------
// T8/T9 · the C11 and C12A properties still hold in BOTH languages
// ---------------------------------------------------------------------------

describe("[R4-R5C13 · T8-T9] the cognitive repairs survive localization", () => {
  const sections = (loc: "en" | "ko") => {
    const b = loc === "ko" ? KO_BEHAVIOR : EN_BEHAVIOR;
    return {
      standard: renderStandardSentence(b, loc),
      scenario: renderScenarioSentence(b, { frame: "time_is_short" } as never, loc),
      decision: renderDecisionSentence(b, APP, loc),
      application: renderApplicationSentence(b, APP, null, loc),
      completion: renderCompletionQuestion(b, { verificationTarget: "the_behaviour", responseMode: "name_the_moment" } as never, loc)!,
      followUp: renderFollowUpSentence(b, { reviewFocus: "what_happened_next", confirmer: "self_report" } as never, 7, loc),
      rationale: renderRationaleSentence(loc === "ko" ? "리더가 신뢰를 잃고 있다" : "Handoffs drop things", b, null, loc),
    };
  };

  it("T8 the behaviour clause and the criterion appear ONCE, in both languages", () => {
    for (const loc of ["en", "ko"] as const) {
      const s = sections(loc);
      const action = loc === "ko" ? KO_ACTION : "confirm the owner and the deadline";
      const criterion = loc === "ko" ? KO_CRITERION : "huddle note records one owner";
      const carriesAction = Object.entries(s).filter(([, v]) => v.toLowerCase().includes(action.toLowerCase()));
      const carriesCriterion = Object.entries(s).filter(([, v]) => v.toLowerCase().includes(criterion.toLowerCase()));
      expect(carriesAction.map(([k]) => k), `${loc} behaviour clause`).toEqual(["standard"]);
      expect(carriesCriterion.map(([k]) => k), `${loc} criterion`).toEqual(["standard"]);
    }
  });

  it("T9 no section pre-writes the learner's decision, in either language", () => {
    for (const loc of ["en", "ko"] as const) {
      const s = sections(loc);
      expect(s.decision).toMatch(/[?？]$/);
      expect(s.completion).toMatch(/[?？]$/);
      expect(s.decision).not.toMatch(/\bI will\b|하겠습니다\./);
      expect(s.application).not.toContain(loc === "ko" ? KO_ACTION : "must");
    }
  });

  it("every key exists in both tables — a section localized in one language only fails here", () => {
    const en = JOURNEY_COPY_TABLES.en as Record<string, unknown>;
    const ko = JOURNEY_COPY_TABLES.ko as Record<string, unknown>;
    expect(Object.keys(ko).sort()).toEqual(Object.keys(en).sort());
    for (const k of ["pressure", "completionAsk", "completionTarget", "followUpFocus", "followUpBy"]) {
      expect(Object.keys(ko[k] as object).sort(), k).toEqual(Object.keys(en[k] as object).sort());
    }
  });
});

// ---------------------------------------------------------------------------
// T10 · Host text is never translated, and the seam actually carries the locale
// ---------------------------------------------------------------------------

describe("[R4-R5C13 · T10] Host and model text is interpolated verbatim", () => {
  it("Korean Host text survives an English render, and English Host text a Korean one", () => {
    const koInEn = renderStandardSentence(KO_BEHAVIOR, "en");
    expect(koInEn).toContain(KO_ACTOR);
    expect(koInEn).toContain(KO_ACTION);
    expect(koInEn).toContain(KO_CRITERION);
    const enInKo = renderStandardSentence(EN_BEHAVIOR, "ko");
    expect(enInKo).toContain("team leads");
    expect(enInKo).toContain("confirm the owner and the deadline");
  });

  it("the review surface derives Korean when the Builder is Korean", () => {
    const proposal = {
      displayTitle: "신뢰를 구축하는 리더의 행동",
      elements: [{ kind: "action_decision", content: "…", rationale: "" }],
      behaviorContract: KO_BEHAVIOR,
      scenarioContract: { frame: "time_is_short" },
      applicationContract: { applicationMoment: KO_TRIGGER },
      completionContract: { verificationTarget: "the_behaviour", responseMode: "name_the_moment" },
      followUpContract: { reviewFocus: "what_happened_next", confirmer: "self_report" },
      operationalConstruct: null,
    } as never;
    const ko = contractsFromProposal(proposal, 7, "리더가 신뢰를 잃고 있다", null, undefined, [], "ko")!;
    expect(ko.locale).toBe("ko");
    for (const kind of ["action_decision", "field_application", "follow_up", "scenario", "completion_check"] as const) {
      expect(deriveInstructionalContent(kind, ko), kind).not.toMatch(ENGLISH_FRAME);
    }
    const en = contractsFromProposal(proposal, 7, "리더가 신뢰를 잃고 있다", null, undefined, [], "en")!;
    expect(deriveInstructionalContent("action_decision", en)).toBe("The next time this happens, what will you do differently?");
  });

  it("the generation path composes in the locale it ran in", () => {
    const answers = {
      problem: "리더가 신뢰를 잃고 있다",
      observableBehavior: KO_ACTION,
      successEvidence: KO_CRITERION,
      recurringMoment: KO_TRIGGER,
      audienceType: "leaders",
      learningNeeds: ["decide"],
      followUpDays: 7,
      materialIntent: "written",
    } as unknown as BuilderAnswers;
    const proposal = {
      display_title: "신뢰를 구축하는 리더의 행동",
      behavior_contract: { action_verb: "확인한다", action_detail: "담당자와 기한을" },
      completion_contract: { verification_target: "the_behaviour", response_mode: "name_the_moment" },
      follow_up_contract: { review_focus: "what_happened_next", confirmer: "self_report" },
      elements: [],
      assumptions: [],
      warnings: [],
    };
    // The shape may or may not validate on this minimal fixture; what is asserted is the SEAM —
    // `validateProgramProposal` accepts a locale and does not throw when given one.
    expect(() => validateProgramProposal({ program: proposal }, answers, [], "ko")).not.toThrow();
    expect(() => validateProgramProposal({ program: proposal }, answers, [])).not.toThrow();
  });
});
