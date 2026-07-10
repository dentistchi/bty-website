import { describe, it, expect } from "vitest";
import {
  checkRelationshipQuality,
  checkInternalState,
  checkReportLike,
  hasMetricPoint,
  checkNumericProvenance,
  deriveClaimPermissions,
  type TodayMirrorClaimPermissions,
} from "@/lib/bty/today-intelligence/todayMirrorSemanticFloor";
import type { TodayMirrorAnalysis } from "@/domain/daily/todayMirror.types";

const P: TodayMirrorClaimPermissions = {
  allowedClaimFamilies: [],
  forbiddenClaimFamilies: [],
  relationshipQualityEvidence: false,
  internalStateEvidence: false,
  allowedNumericClaims: [],
};
const rq = (t: string) => checkRelationshipQuality(t, P, true); // relationship-concentration context

// A. relationship-quality — Korean (15)
const REL_KO = [
  "관계가 강화되고 있습니다", "연결이 더 깊어지고 있습니다", "관계가 가까워지고 있습니다",
  "사이가 좋아지고 있습니다", "관계가 회복되고 있습니다", "관계가 발전하고 있습니다",
  "긍정적인 방향으로 나아가고 있습니다", "관계가 더 단단해지고 있습니다", "연결이 더 의미 있어졌습니다",
  "관계가 더 끈끈해졌습니다", "타인과의 연결이 부각되었습니다", "관계가 더욱 두드러집니다",
  "연결이 강해지고 있습니다", "관계가 긍정적으로 변하고 있습니다", "관계가 좋은 방향으로 가고 있습니다",
];
// B. relationship-quality — English (12)
const REL_EN = [
  "the relationship is strengthening", "the connection is deepening", "becoming closer",
  "the relationship is improving", "moving in a positive direction", "the bond is recovering",
  "growing stronger", "becoming more meaningful", "there is positive movement in the relationship",
  "the connection feels tighter", "we are closer than before", "their bond is deeper now",
];
// C. internal-state / motive — KO (10) + EN (10)
const INT_KO = [
  "마음이 더 쓰였습니다", "그 사람을 걱정하고 있습니다", "다시 연결되고 싶어 합니다",
  "관계를 중요하게 느끼고 있습니다", "상대를 원하고 있습니다", "대화를 피하고 있습니다",
  "그를 두려워합니다", "마음이 그쪽으로 향했습니다", "무언가를 의도하고 있습니다", "속으로 불안해하고 있습니다",
];
const INT_EN = [
  "cares more about them", "wants to reconnect", "feels more invested", "is worried about the outcome",
  "intends to fix it", "is avoiding the conversation", "is afraid of the response", "longs to be closer",
  "desires to connect", "feels attached",
];
// D. report-like — KO (12) + E. EN (10)
const REP_KO = [
  "증거가 보이지 않습니다", "증거가 부족합니다", "확인되지 않았습니다", "검증되지 않았습니다",
  "데이터로 판단할 수 없습니다", "기록상 나타나지 않았습니다", "지지받고 있습니다", "변화를 시사합니다",
  "행동이 관찰됩니다", "분석 결과 그렇습니다", "패턴 변화 여부는 불분명합니다", "변화가 검출되지 않았습니다",
  "패턴이 바뀌었다고 말할 수 있는 증거는 아직 없습니다", // real V6 leak: adverb between 증거 and 없
];
const REP_EN = [
  "there is insufficient evidence", "evidence is not visible", "this has not been confirmed",
  "this has not been validated", "the data suggests otherwise", "according to the records",
  "the analysis indicates change", "it is supported by the evidence", "no evidence that it changed",
  "evidence is not clear",
];
// F. natural honest limits that MUST PASS (12 KO + 10 EN)
const LIMIT_KO = [
  "이번 한 번만으로 흐름이 달라졌다고 보기는 어렵습니다", "아직 방향이라고 부르기에는 이릅니다",
  "지금은 여기까지만 말하는 편이 정확합니다", "아직 흐름이라 부르기엔 이릅니다",
  "이것을 관계 자체가 달라진 것으로 보기에는 이릅니다", "관계가 좋아졌다고 보기에는 이릅니다",
  "한 번의 변화만으로는 단정하기 어렵습니다", "오늘은 여기까지가 정확합니다",
  "아직 뚜렷한 방향은 보이지 않습니다", "아직 한 걸음만 보입니다",
  "다시 돌아왔습니다", "미뤄뒀던 일에서 첫 단계를 시작하세요",
];
const LIMIT_EN = [
  "this one return is not enough to call the pattern changed", "it is still too early to call this a direction",
  "the outcome was different this time", "you began sooner after recognizing it",
  "you returned after missing it", "a promise you made earlier is still open",
  "name the exact difference in a sentence", "keep the return unbroken today",
  "start the next thing before you feel ready", "you closed the gap between deciding and starting",
];
// G. ordinary "point" that MUST PASS (10) + H. metric points that MUST REJECT (8)
const POINT_OK = [
  "entry point", "starting point", "the point where the behavior begins", "clarify one point",
  "one unresolved point", "at this point", "a turning point", "make your point",
  "the point of return", "to the point",
];
const POINT_METRIC = [
  "earned 20 points", "lost points", "total points", "point score",
  "leaderboard points", "XP points", "you have 50 points", "bonus points",
];

describe("semantic floor — relationship quality", () => {
  it("A. rejects 15 Korean paraphrases", () => REL_KO.forEach((t) => expect(rq(t), t).toBe("UNSUPPORTED_RELATIONSHIP_QUALITY")));
  it("B. rejects 12 English paraphrases", () => REL_EN.forEach((t) => expect(rq(t), t).toBe("UNSUPPORTED_RELATIONSHIP_QUALITY")));
});

describe("semantic floor — internal state / motive", () => {
  it("C. rejects 10 KO + 10 EN", () =>
    [...INT_KO, ...INT_EN].forEach((t) => expect(checkInternalState(t, P), t).toBe("UNSUPPORTED_INTERNAL_STATE")));
});

describe("semantic floor — report-like language", () => {
  it("D+E. rejects 12 KO + 10 EN", () =>
    [...REP_KO, ...REP_EN].forEach((t) => expect(checkReportLike(t), t).toBe("REPORT_LIKE_EPISTEMIC_LANGUAGE")));
});

describe("semantic floor — false-positive discipline (natural limits PASS)", () => {
  it("F. 12 KO + 10 EN natural limits are NOT flagged", () =>
    [...LIMIT_KO, ...LIMIT_EN].forEach((t) => {
      expect(rq(t), `relq:${t}`).toBeNull();
      expect(checkReportLike(t), `report:${t}`).toBeNull();
      expect(checkInternalState(t, P), `internal:${t}`).toBeNull();
    }));
});

describe("semantic floor — context-aware relationship quality (§4)", () => {
  it("factual outcome contrast passes OUTSIDE relationship-concentration", () => {
    ["the completed action improved the result", "이번에는 결과가 달라졌습니다", "the outcome improved this time"]
      .forEach((t) => expect(checkRelationshipQuality(t, P, false), t).toBeNull());
  });
  it("but the RELATIONSHIP improving is rejected even outside relationship-concentration", () => {
    expect(checkRelationshipQuality("the relationship improved", P, false)).toBe("UNSUPPORTED_RELATIONSHIP_QUALITY");
    expect(checkRelationshipQuality("연결이 더 깊어졌습니다", P, false)).toBe("UNSUPPORTED_RELATIONSHIP_QUALITY");
  });
});

describe("semantic floor — point / points fix", () => {
  it("G. 10 ordinary 'point' phrases PASS", () => POINT_OK.forEach((t) => expect(hasMetricPoint(t), t).toBe(false)));
  it("H. 8 metric-points phrases REJECT", () => POINT_METRIC.forEach((t) => expect(hasMetricPoint(t), t).toBe(true)));
  it("Korean 지점/한 가지 unaffected", () => {
    ["가장 이른 지점", "한 가지를 분명히"].forEach((t) => expect(hasMetricPoint(t), t).toBe(false));
  });
});

describe("semantic floor — numeric provenance", () => {
  const proven: TodayMirrorClaimPermissions = {
    ...P,
    allowedNumericClaims: [
      { value: 2, kind: "completed_action", evidenceIds: ["f1", "f2"] },
      { value: 3, kind: "return", evidenceIds: ["r1"] },
    ],
  };
  // I. provenance-backed numeric claims PASS when evidence present (8)
  it("I. supported numeric claims pass with full provenance", () => {
    const ids = ["f1", "f2", "r1"];
    ["2 completed actions", "you completed 2 actions today", "3 returns this cycle",
     "there were 2 completed actions and 3 returns", "2 actions", "completed 2", "3 times", "2 and 3"]
      .forEach((t) => expect(checkNumericProvenance(t, proven, ids), t).toBeNull());
  });
  // J. unsupported numeric claims REJECT (10)
  it("J. unsupported numeric claims are rejected", () => {
    ["관계가 2배 좋아졌습니다", "your score rose by 10", "you returned 4 times", "AIR increased by 4",
     "chose Others 2 times", "3 conversations happened", "improved 5 fold", "10 steps closer",
     "2 completed actions", "3 returns"]
      .forEach((t) => expect(checkNumericProvenance(t, P, []), t).toBe("UNSUPPORTED_COUNT")); // no permission
  });
  it("supported value but MISSING evidence id is rejected", () => {
    expect(checkNumericProvenance("2 completed actions", proven, ["f1"]), "missing f2").toBe("UNSUPPORTED_COUNT");
  });
});

describe("claim permissions", () => {
  const a = (lens: TodayMirrorAnalysis["selectedLens"]): TodayMirrorAnalysis => ({
    selectedLens: lens, supportedObservationCodes: [], supportingEvidenceIds: [],
    confidence: "medium", allowedInterpretations: [], prohibitedInterpretations: [],
    allowedActionTypes: [], mustAvoidContractDuplication: false,
  });
  it("relationship_concentration forbids quality/direction/internal; V0 numeric empty", () => {
    const p = deriveClaimPermissions(a("relationship_concentration"));
    expect(p.relationshipQualityEvidence).toBe(false);
    expect(p.internalStateEvidence).toBe(false);
    expect(p.allowedNumericClaims).toEqual([]);
    expect(p.forbiddenClaimFamilies).toContain("RELATIONSHIP_QUALITY");
  });
  it("reexposure_change permits BEHAVIOR_CONTRAST", () => {
    expect(deriveClaimPermissions(a("reexposure_change")).allowedClaimFamilies).toContain("BEHAVIOR_CONTRAST");
  });
});
