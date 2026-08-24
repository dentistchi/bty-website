import { describe, it, expect } from "vitest";
import { applyProgramProposal, contractsFromProposal, deriveInstructionalContent, initialSectionDecisions } from "./program-authorship";
import type { JourneyElementKind, RealityGroundedJourneyV1 } from "./journey";
import type { SectionChoice } from "./program-authorship";

/**
 * SLICE R4-R5C13-R1 — WHAT THE HOST REVIEWED IS WHAT GETS ADOPTED.
 *
 * FOUNDER-OBSERVED. A Korean proposal read Korean in every section, the Host pressed
 * "Add this program to my training" without editing anything, and the adopted Journey came back
 * with four English sections. Measured afterwards on the real row: attempt `0d2726fe`,
 * `locale = ko`, generated under deploy `5d241bfb` and adopted under `b72163fb` — the server had
 * composed English because the locale repair was eighteen minutes away, and adoption took the
 * server's copy instead of the sentence on screen.
 *
 * The locale skew is the case that exposed it. The defect is that the two can differ at all.
 */

const KO = {
  action_decision: "다음에 이런 상황이 생기면 무엇을 다르게 해보겠습니까?",
  field_application: "다음에 이런 상황이 생기는 것이 실제로 해볼 첫 기회입니다.",
  completion_check: "다음에 이런 상황이 생기면 정확히 무엇을 하시겠습니까?",
  follow_up: "7일 후, 실제로 해봤을 때 어떻게 되었는지 다시 묻겠습니다. 이것은 본인의 경험에 대한 답이며, 다른 사람의 관찰은 아닙니다.",
} as const;

/** The server payload as it actually was: English for every rendered kind. */
const EN_PAYLOAD = {
  action_decision: "The next time this happens, what will you do differently?",
  field_application: "The next time this happens is the first real chance to try it for yourself.",
  completion_check: "What exactly will you say when you are in that situation?",
  follow_up: "In 7 days you will be asked what happened when you tried it. That is your own account of it, not an observation.",
} as const;

const KINDS = Object.keys(KO) as (keyof typeof KO)[];

const proposal = {
  displayTitle: "신뢰를 구축하는 리더의 행동",
  elements: KINDS.map((k) => ({ kind: k as JourneyElementKind, content: EN_PAYLOAD[k], rationale: "" })),
} as never;

/** Exactly what `apply()` builds: the decision, plus the sentence on screen. */
const choices = (over: Partial<Record<keyof typeof KO, SectionChoice>> = {}): SectionChoice[] =>
  KINDS.map((k) => over[k] ?? { kind: k as JourneyElementKind, decision: "use", editedContent: KO[k] });

const adopt = (current: RealityGroundedJourneyV1 | undefined, cs: SectionChoice[]) =>
  applyProgramProposal(current, proposal, cs, { titleDecision: "use" });

const byKind = (j: RealityGroundedJourneyV1) => Object.fromEntries(j.elements.map((e) => [e.kind, e]));

describe("[R4-R5C13-R1 · T1-T4] a reviewed Korean section is adopted in Korean", () => {
  const out = byKind(adopt(undefined, choices()));

  it("T1 YOUR DECISION", () => {
    expect(out.action_decision.content).toBe(KO.action_decision);
    expect(out.action_decision.content).not.toBe(EN_PAYLOAD.action_decision);
  });
  it("T2 APPLY IT", () => expect(out.field_application.content).toBe(KO.field_application));
  it("T3 BEFORE YOU FINISH", () => expect(out.completion_check.content).toBe(KO.completion_check));
  it("T4 WHAT HAPPENS NEXT", () => expect(out.follow_up.content).toBe(KO.follow_up));

  it("provenance is unchanged — BTY wrote it and the Host did not touch it", () => {
    for (const k of KINDS) expect(out[k].grounding[0]?.sourceType, k).toBe("ai_proposed");
  });
});

describe("[R4-R5C13-R1 · T5] English is unaffected", () => {
  it("a reviewed English section adopts byte-identically", () => {
    const en = byKind(adopt(undefined, KINDS.map((k) => ({ kind: k as JourneyElementKind, decision: "use", editedContent: EN_PAYLOAD[k] }))));
    for (const k of KINDS) expect(en[k].content, k).toBe(EN_PAYLOAD[k]);
  });

  it("a caller that sends no reviewed text still falls back to the payload", () => {
    const bare = byKind(adopt(undefined, KINDS.map((k) => ({ kind: k as JourneyElementKind, decision: "use" }))));
    for (const k of KINDS) expect(bare[k].content, k).toBe(EN_PAYLOAD[k]);
  });
});

describe("[R4-R5C13-R1 · T6-T8] keep / edit / mixed authorship are exact", () => {
  const existing: RealityGroundedJourneyV1 = {
    version: 1,
    displayTitle: "기존 제목",
    displayTitleStatus: "grounded",
    elements: [
      {
        id: "el_action_decision",
        kind: "action_decision",
        content: "호스트가 직접 쓴 문장입니다.",
        grounding: [{ sourceType: "host_statement", field: "problem" }],
        confirmationStatus: "grounded",
      },
    ],
  };

  it("T6 KEEP preserves the Host's existing sentence exactly", () => {
    const out = byKind(adopt(existing, choices({ action_decision: { kind: "action_decision", decision: "keep" } })));
    expect(out.action_decision.content).toBe("호스트가 직접 쓴 문장입니다.");
    expect(out.action_decision.grounding[0]?.sourceType).toBe("host_statement");
  });

  it("T7 EDIT preserves the Host's rewritten sentence exactly", () => {
    const mine = "제가 직접 고친 문장입니다.";
    const out = byKind(adopt(undefined, choices({ action_decision: { kind: "action_decision", decision: "edit", editedContent: mine } })));
    expect(out.action_decision.content).toBe(mine);
    expect(out.action_decision.grounding[0]?.sourceType).toBe("host_edited");
  });

  it("T8 every section keeps the exact choice made for it", () => {
    const mine = "제가 직접 고친 문장입니다.";
    const out = byKind(
      adopt(existing, choices({
        action_decision: { kind: "action_decision", decision: "keep" },
        field_application: { kind: "field_application", decision: "edit", editedContent: mine },
      })),
    );
    expect(out.action_decision.content).toBe("호스트가 직접 쓴 문장입니다.");
    expect(out.field_application.content).toBe(mine);
    expect(out.completion_check.content).toBe(KO.completion_check);
    expect(out.follow_up.content).toBe(KO.follow_up);
  });
});

describe("[R4-R5C13-R1] THE INVARIANT, as a permanent rule", () => {
  /**
   * For every section the Host did not KEEP, the adopted sentence is the sentence they were
   * shown. Stated over the real seam rather than over a hand-built pair: the review surface's
   * `sectionText` for a derived kind IS `deriveInstructionalContent`, so this drives adoption
   * from the same function the screen does and asserts the two agree.
   */
  it("adopted content === the reviewed sentence, for every non-keep section, in both locales", () => {
    const behavior = {
      actor: "팀 리더",
      trigger: "아침 허들 때마다",
      observableAction: "담당자와 기한을 확인한다",
      completion: { criterion: "허들 노트에 담당자와 기한이 기록된다" },
    } as never;
    const base = {
      displayTitle: "t",
      elements: KINDS.map((k) => ({ kind: k as JourneyElementKind, content: EN_PAYLOAD[k], rationale: "" })),
      behaviorContract: behavior,
      scenarioContract: { frame: "time_is_short" },
      applicationContract: { applicationMoment: "아침 허들 때마다" },
      completionContract: { verificationTarget: "the_behaviour", responseMode: "name_the_moment" },
      followUpContract: { reviewFocus: "what_happened_next", confirmer: "self_report" },
      operationalConstruct: null,
    } as never;

    for (const loc of ["en", "ko"] as const) {
      const contracts = contractsFromProposal(base, 7, "문제", null, undefined, [], loc)!;
      // Exactly what the review surface renders, and exactly what `apply()` sends.
      const reviewed = KINDS.map((k) => ({
        kind: k as JourneyElementKind,
        decision: "use" as const,
        editedContent: deriveInstructionalContent(k as JourneyElementKind, contracts) ?? EN_PAYLOAD[k],
      }));
      const out = byKind(applyProgramProposal(undefined, base, reviewed, { titleDecision: "use" }));
      for (const c of reviewed) {
        expect(out[c.kind].content, `${loc}/${c.kind}`).toBe(c.editedContent);
      }
    }
  });

  it("initialSectionDecisions still opens a preservable Host section on keep", () => {
    const existing: RealityGroundedJourneyV1 = {
      version: 1, displayTitle: "t", displayTitleStatus: "grounded",
      elements: [{ id: "el_action_decision", kind: "action_decision", content: "내 문장", grounding: [{ sourceType: "host_statement", field: "problem" }], confirmationStatus: "grounded" }],
    };
    expect(initialSectionDecisions(existing, proposal).action_decision).toBe("keep");
    expect(initialSectionDecisions(existing, proposal).follow_up).toBe("use");
  });
});
