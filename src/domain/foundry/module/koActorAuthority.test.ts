/**
 * KO ACTOR AUTHORITY V1-R2 — HOST-ROLE SUBJECTS ARE INERT INTERMEDIATE VARIANCE.
 *
 * WHAT V1 GOT WRONG, MEASURED. V1 treated the Host's `audienceDetail` (and its final token) as an
 * actor expression: a role noun wearing 이/가/은/는 anywhere in the action was a reclaim. On a
 * `specific_role` / `팀 리더` training that refused ordinary Korean:
 *
 *   확인한 내용을 팀 리더가 정한 양식에 기록한다      ← 팀 리더가 modifies 정한, not the action
 *   제출한 자료를 리더가 요청한 순서대로 검토한다     ← 리더가 modifies 요청한, not the action
 *
 * Korean relativizes with a bare subject-marked noun, so an embedded clause and a reclaimed actor
 * are the same three characters in the same position. Telling them apart is clause parsing, and
 * this system does not parse Korean.
 *
 * WHY REMOVING THE RULE COSTS NOTHING VISIBLE. The generated ACTION is intermediate. Measured
 * against the tree, not assumed:
 *
 *   · `baseActionPhrase` has exactly ONE call site — `renderStandardSentence` — which is marked
 *     NO LONGER A LEARNER-FACING PATH (R4-R5C14A) and is not returned by
 *     `deriveInstructionalContent` for `observable_standard`.
 *   · THE STANDARD the learner and the Host both read is the Host's own `observableBehavior`,
 *     carried verbatim.
 *   · The actor is `CANONICAL_ACTOR`, passed in as server authority; the schema has no actor
 *     field for the model to write.
 *   · No path persists a `ProgramProposal` or a `BehaviorContract`.
 *
 * So a Host-role subject inside the ACTION reaches nobody and decides nothing. Refusing it spent
 * a Host's generation to correct a string that is never read — which is the same conclusion the
 * generic-role audit reached for `팀원이 …` one slice earlier. This makes the two consistent.
 *
 * THIS IS NOT "FIXED WHO DETECTION". It is the deliberate removal of a refusal that protected
 * nothing. The residual it accepts is named as a residual, in T9–T13.
 */
import { describe, it, expect } from "vitest";
import {
  validateBehaviorContract, actionVerbDefect, composeObservableAction, CANONICAL_ACTOR,
  actionNamesActorKo, actionNamesMomentKo,
} from "./program-coherence";
import {
  validateProgramProposal, requiredProgramKinds, deriveInstructionalContent, contractsFromProposal,
} from "./program-authorship";
import type { BuilderAnswers } from "./module-builder";

/** The Host context under test: a detail-bearing audience, which is what V1's rule keyed on. */
const TRIGGER = "고객의 요청이나 변경 사항을 들었을 때";
const CRITERION = "고객이 요청한 내용과 다음 행동을 정확히 설명할 수 있다.";
const HOST_BEHAVIOR = "고객의 요청을 들은 뒤 핵심 내용을 자신의 말로 다시 확인한다.";

const HOST: BuilderAnswers = {
  title: "고객 요청 다시 확인하기",
  problem: "고객 요청을 들은 뒤 서로 이해한 내용이 맞는지 확인하지 않아 다시 설명하는 일이 생긴다.",
  audienceType: "specific_role",
  audienceDetail: "팀 리더",
  recurringMoment: TRIGGER,
  observableBehavior: HOST_BEHAVIOR,
  successEvidence: CRITERION,
  evidenceType: "seen",
  materialIntent: "written",
  materialText: "한 장짜리 안내",
} as unknown as BuilderAnswers;

/** The real entry point, with the locale and answers the live generation path passes. */
const judge = (action: string, answers: BuilderAnswers = HOST) =>
  validateBehaviorContract(
    { observable_action: action },
    { actor: CANONICAL_ACTOR, trigger: TRIGGER, criterion: CRITERION },
    { locale: "ko", answers },
  );

const accepts = (action: string, answers: BuilderAnswers = HOST) => judge(action, answers).ok;
const refusalOf = (action: string, answers: BuilderAnswers = HOST) => {
  const r = judge(action, answers);
  return r.ok ? null : `${r.defect.reason}/${r.defect.authority ?? "-"}`;
};

// ---------------------------------------------------------------------------
// T1–T5 — the false refusals this slice removes, and the nouns that were never at risk
// ---------------------------------------------------------------------------

describe("[V1-R2] embedded Host-role clauses are not actor reclaims", () => {
  it("T1 — an embedded 팀 리더 relative clause is accepted", () => {
    expect(accepts("확인한 내용을 팀 리더가 정한 양식에 기록한다")).toBe(true);
    expect(accepts("확인한 내용을 팀 리더가 정한 순서대로 정리한다")).toBe(true);
    expect(accepts("팀 리더가 전달한 정보를 CRM에 기록한다")).toBe(true);
  });

  it("T2 — an embedded 리더 relative clause is accepted", () => {
    expect(accepts("제출한 자료를 리더가 요청한 순서대로 검토한다")).toBe(true);
    expect(accepts("리더가 요청한 자료를 검토한다")).toBe(true);
  });

  it("T3 — a sentence-initial embedded Host-role clause is accepted", () => {
    /*
      THE CASE NO POSITIONAL RULE COULD HAVE SAVED. `팀 리더가 승인한 내용을 기록한다` and
      `팀 리더가 핵심 내용을 확인한다` share their first three tokens and differ only in whether
      승인한 modifies the following noun. Anchoring the old rule to the sentence head would have
      kept this one refused, which is why the rule went instead of moving.
    */
    expect(accepts("팀 리더가 승인한 내용을 기록한다")).toBe(true);
  });

  it("T4 — recipient role nouns are accepted, as they always were", () => {
    for (const a of ["팀원에게 결과를 공유한다", "리더에게 상태를 알린다", "고객에게 내용을 다시 설명한다"]) {
      expect(accepts(a), a).toBe(true);
    }
  });

  it("T5 — person nouns in object and comitative position are accepted", () => {
    for (const a of ["담당자와 마감일을 확인한다", "팀 리더와 결과를 검토한다", "핵심 내용을 다시 확인한다"]) {
      expect(accepts(a), a).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// T6–T8 — second person is untouched, and is NOT redundant
// ---------------------------------------------------------------------------

describe("[V1-R2] the second-person branch is preserved", () => {
  it("T6/T7 — 당신이 / 당신은 / 여러분이 / 여러분은 / 너희가 still refuse", () => {
    for (const a of [
      "당신이 핵심 내용을 확인한다", "당신은 핵심 내용을 확인한다",
      "여러분이 핵심 내용을 확인한다", "여러분은 핵심 내용을 확인한다",
      "너희가 핵심 내용을 확인한다", "너희는 핵심 내용을 확인한다",
    ]) {
      expect(refusalOf(a), a).toBe("action_reclaims_authority/actor");
    }
  });

  it("T8 — a MID-SENTENCE second person still refuses, which is why the branch stays unanchored", () => {
    /*
      Not redundant with `actionVerbDefect`: `핵심 내용을 당신이 확인한다` splits to
      action_verb `핵심`, which is a well-formed one-token verb field. Only this rule sees it.
    */
    expect(actionVerbDefect("핵심")).toBeNull();
    expect(refusalOf("핵심 내용을 당신이 확인한다")).toBe("action_reclaims_authority/actor");
    expect(refusalOf("확인 후 당신이 기록한다")).toBe("action_reclaims_authority/actor");
  });

  it("a Latin phrase wearing a Korean subject particle still refuses", () => {
    expect(refusalOf("the team leader가 담당자를 확인한다")).toBe("action_reclaims_authority/actor");
    expect(refusalOf("you 투약량을 복창한다")).toBe("action_reclaims_authority/actor");
  });
});

// ---------------------------------------------------------------------------
// T9–T13 — the accepted residual, named as a residual
// ---------------------------------------------------------------------------

/** The multi-token Host role that bypasses the arity gate — the reason V1-R2 needed a decision. */
const RESIDUAL_VERB = "팀";
const RESIDUAL_DETAIL = "리더가 핵심 내용을 확인한다";
const RESIDUAL_ACTION = composeObservableAction(RESIDUAL_VERB, RESIDUAL_DETAIL);

describe("[V1-R2] ACCEPTED INTERMEDIATE VARIANCE — a Host-role subject that reaches nobody", () => {
  it("T9 — the multi-token Host-role subject is reachable, and is now accepted", () => {
    /*
      REACHABLE, AND THAT IS THE POINT. A one-token role (`매니저`) puts the particle on the first
      token, so `actionVerbDefect` refuses it as `not_a_verb_head` before this rule is consulted.
      A multi-token role does not: `팀` is a well-formed verb field and the particle lands on the
      second token. Four of six realistic Korean role phrases are multi-token, so this shape is
      ordinary, not exotic.

      This test asserts an ACCEPTED DEFECT, not a desirable model output. The prompt still tells
      the model not to write a subject; nothing here endorses one.
    */
    expect(actionVerbDefect(RESIDUAL_VERB)).toBeNull();
    expect(RESIDUAL_ACTION).toBe("팀 리더가 핵심 내용을 확인한다");
    expect(accepts(RESIDUAL_ACTION)).toBe(true);
    expect(actionNamesActorKo(RESIDUAL_ACTION)).toBe(false);
  });

  it("T14 — a one-token Host role is still stopped earlier, by the arity gate", () => {
    // Unchanged by this slice, and deliberately not made to match the multi-token case: the
    // user-visible contract is the invariant, not parity between two invisible strings.
    for (const first of ["매니저가", "리더가", "간호사가", "상담원이", "당신이"]) {
      expect(actionVerbDefect(first), first).toBe("not_a_verb_head");
    }
  });
});

// ---------------------------------------------------------------------------
// T10–T13 — the authority the removal is safe BECAUSE of
// ---------------------------------------------------------------------------

const VERIFIED: string[] = [];
const KINDS = requiredProgramKinds(HOST);
const CONTENT: Record<string, string> = {
  why_it_matters: "확인 없이 넘어가면 같은 설명을 다시 해야 하는 일이 반복된다.",
  observable_standard: "모델이 쓴 표준 문장 — BTY는 이것을 쓰지 않는다.",
  scenario: "요청이 몰리고 시간이 촉박한 상황이다.",
  reflection: "지난주에는 이 상황에서 실제로 어떻게 했는지 떠올려 본다.",
  evidence: "호스트가 실제 업무에서 확인할 수 있는 것과 확인할 수 없는 것.",
  action_decision: "다음 기회가 언제인지 정하고 그때 무엇을 하겠는지 적는다.",
  field_application: "다음 고객 요청을 받을 때가 실제로 해볼 첫 기회입니다.",
  completion_check: "다음 고객 요청에서 정확히 무엇을 말하겠습니까?",
  follow_up: "7일 후에 실제로 해봤을 때 어떻게 되었는지 다시 묻겠습니다.",
};

const proposalWith = (verb: string, detail: string) => ({
  program: {
    display_title: "고객 요청 다시 확인하기",
    elements: KINDS.map((k) => ({ kind: k, content: CONTENT[k], rationale: "호스트의 답변에 근거함" })),
    assumptions: ["팀은 고객 요청을 정기적으로 받는다"],
    warnings: ["요청이 없는 날은 훈련 대상이 아니다"],
    behavior_contract: { action_verb: verb, action_detail: detail },
    scenario_contract: { pressure_frame: "time_is_short" },
    completion_contract: { verification_target: "the_behaviour", response_mode: "state_what_you_will_say" },
    follow_up_contract: { review_focus: "what_you_said", confirmer: "self_report" },
  },
});

describe("[V1-R2] the residual changes nothing a person can see", () => {
  it("T10 — the learner's observable_standard is still the Host's sentence, verbatim", () => {
    const r = validateProgramProposal(proposalWith(RESIDUAL_VERB, RESIDUAL_DETAIL), HOST, VERIFIED, "ko");
    expect(r.ok, r.ok ? "" : `refused ${r.code}`).toBe(true);
    if (!r.ok) return;
    const std = r.value.proposal.elements.find((e) => e.kind === "observable_standard")!.content;
    expect(std).toBe(HOST_BEHAVIOR);
    // The role the model wrote appears in NO element the learner reads.
    for (const el of r.value.proposal.elements) expect(el.content, el.kind).not.toContain("팀 리더가");
  });

  it("T11 — the Host's audience is untouched by anything in the contract", () => {
    const r = validateProgramProposal(proposalWith(RESIDUAL_VERB, RESIDUAL_DETAIL), HOST, VERIFIED, "ko");
    expect(r.ok).toBe(true);
    // Nothing in the response is an input to the audience: it is read from the Host's answers.
    expect(HOST.audienceType).toBe("specific_role");
    expect(HOST.audienceDetail).toBe("팀 리더");
  });

  it("T12 — the canonical actor stays server-owned, whatever the action says", () => {
    expect(CANONICAL_ACTOR).toBe("you");
    const clean = validateProgramProposal(proposalWith("확인하다", "핵심 내용을 다시 확인한다"), HOST, VERIFIED, "ko");
    const leaked = validateProgramProposal(proposalWith(RESIDUAL_VERB, RESIDUAL_DETAIL), HOST, VERIFIED, "ko");
    expect(clean.ok && leaked.ok).toBe(true);
    if (!clean.ok || !leaked.ok) return;
    // Identical learner-facing programs: the action is not an input to any of them.
    const text = (r: typeof clean) => (r.ok ? r.value.proposal.elements.map((e) => `${e.kind}:${e.content}`).join("|") : "");
    expect(text(leaked)).toBe(text(clean));
  });

  it("T13 — BTY renders nothing from the model's action, so there is nothing to persist", () => {
    const r = validateProgramProposal(proposalWith(RESIDUAL_VERB, RESIDUAL_DETAIL), HOST, VERIFIED, "ko");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    /*
      THE STRUCTURAL REASON, asserted through the REAL review factory rather than a hand-built
      object: `deriveInstructionalContent` returns null for `observable_standard`, so no surface —
      Host review included — can render the contract's action in its place.
    */
    const contracts = contractsFromProposal(r.value.proposal, 7, HOST.problem ?? "", null, HOST, [], "ko");
    expect(contracts).not.toBeNull();
    expect(contracts!.behavior.observableAction).toBe(RESIDUAL_ACTION);
    expect(deriveInstructionalContent("observable_standard", contracts!)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T15 — the WHEN half of KO authority is untouched by this slice
// ---------------------------------------------------------------------------

describe("[V1-R2] KO WHEN (V1-R1) is unchanged", () => {
  it("T15 — the temporal skeleton still decides WHEN, on both sides", () => {
    // Refused: a connective whose clause names the Host's own moment.
    expect(actionNamesMomentKo("고객의 요청이나 변경 사항을 들었을 때 확인한다", TRIGGER)).toBe(true);
    expect(refusalOf("고객의 요청이나 변경 사항을 들었을 때 다시 확인한다")).toBe("action_reclaims_authority/moment");
    // Accepted: shared vocabulary with no temporal skeleton — V1-R1's measured false positive.
    expect(actionNamesMomentKo("고객 요청을 CRM에 기록한다", TRIGGER)).toBe(false);
    expect(accepts("고객 요청을 CRM에 기록한다")).toBe(true);
    // Accepted: a temporal word unrelated to the Host's occasion.
    expect(actionNamesMomentKo("확인 후 결과를 기록한다", TRIGGER)).toBe(false);
  });
});
