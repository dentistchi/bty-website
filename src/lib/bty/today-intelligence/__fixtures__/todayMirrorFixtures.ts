/**
 * BTY Today AI Mirror — synthetic shadow fixtures + deterministic mock verbalizer.
 *
 * NO real user data. Fixtures are hand-built evidence packets covering the required cases.
 * The mock client implements MirrorLlmClient by reading the analysis from the prompt's user
 * message and emitting safe, evidence-bounded text — so the FULL pipeline (prompt → generate
 * → validators) runs deterministically with no live provider.
 */
import type { Relationship } from "@/domain/daily/axisRelationship";
import type {
  MirrorConfidence,
  MirrorLens,
  RecentTodayMirrorContext,
  TodayMirrorEvidencePacket,
} from "@/domain/daily/todayMirror.types";
import { EMPTY_RECENT_CONTEXT } from "@/domain/daily/todayMirror.types";
import type { MirrorLlmClient } from "@/lib/bty/today-intelligence/todayMirrorGenerate";
import type { MirrorLocale } from "@/lib/bty/today-intelligence/todayMirrorPrompt";

const ALL_LENSES: MirrorLens[] = [
  "reexposure_change",
  "recovery_reentry",
  "return_after_miss",
  "completion_latency",
  "open_contract_gravity",
  "repeated_pattern",
  "relationship_concentration",
];

const USER_DAY = { date: "2026-07-10", timezone: "Asia/Seoul", boundaryHour: 5 };

function base(over: Partial<TodayMirrorEvidencePacket>): TodayMirrorEvidencePacket {
  return {
    userDay: USER_DAY,
    confirmedFacts: [],
    derivedSignals: [],
    openContract: null,
    insufficientEvidence: [],
    prohibitedClaims: ["MOTIVE_CERTAINTY", "EXPLICIT_RELATIONSHIP_CHOICE"],
    allowedLenses: ALL_LENSES,
    confidence: "none",
    ...over,
  };
}

function signalPacket(
  code: string,
  confidence: MirrorConfidence,
  relationship?: Relationship,
  extra?: Partial<TodayMirrorEvidencePacket>,
): TodayMirrorEvidencePacket {
  const factId = `fact:${code.toLowerCase()}:0`;
  return base({
    confidence,
    confirmedFacts: [
      {
        id: factId,
        kind: code.toLowerCase(),
        occurredAt: "2026-07-09T14:00:00+09:00",
        source: { tableOrService: "bty_action_contracts" },
        relationship,
        summaryCode: code,
      },
    ],
    derivedSignals: [
      { code, relationship, confidence, supportingEvidenceIds: [factId] },
    ],
    ...extra,
  });
}

export type MirrorFixture = {
  name: string;
  packet: TodayMirrorEvidencePacket;
  locale: MirrorLocale;
  recent?: RecentTodayMirrorContext;
  expectLens: MirrorLens;
  /** ok = valid response; restraint = valid + uncertainty; fail_quiet = validator rejects. */
  expect: "ok" | "restraint" | "fail_quiet";
};

const REPEAT_LENS: RecentTodayMirrorContext = {
  ...EMPTY_RECENT_CONTEXT,
  recentLenses: ["return_after_miss", "return_after_miss"],
};
const REPEAT_VERB: RecentTodayMirrorContext = {
  ...EMPTY_RECENT_CONTEXT,
  recentActionVerbs: ["reach"],
};

export const MIRROR_FIXTURES: MirrorFixture[] = [
  { name: "1_new_user_no_evidence", packet: base({ confidence: "none", insufficientEvidence: ["NO_EVIDENCE"] }), locale: "en", expectLens: "insufficient_evidence", expect: "restraint" },
  { name: "2_one_completed_action", packet: signalPacket("RELATIONSHIP_CONCENTRATION", "low", "Others"), locale: "en", expectLens: "relationship_concentration", expect: "restraint" },
  { name: "3_repeated_pattern_no_action", packet: signalPacket("REPEATED_PATTERN", "medium", "Self"), locale: "en", expectLens: "repeated_pattern", expect: "ok" },
  { name: "4_open_contract_exists", packet: base({ confidence: "high", openContract: { id: "c1", actionTextReference: "ref:c1" }, derivedSignals: [], allowedLenses: ALL_LENSES }), locale: "en", expectLens: "open_contract_gravity", expect: "ok" },
  { name: "5_missed_then_return", packet: signalPacket("RETURN_AFTER_MISS", "medium", "Others"), locale: "en", expectLens: "return_after_miss", expect: "ok" },
  { name: "6_latency_shortened", packet: signalPacket("LATENCY_SHORTENED", "medium", "Self"), locale: "en", expectLens: "completion_latency", expect: "ok" },
  { name: "7_reexposure_changed", packet: signalPacket("REEXPOSURE_CHANGED", "high", "Others"), locale: "en", expectLens: "reexposure_change", expect: "ok" },
  { name: "8_reexposure_no_change", packet: signalPacket("REPEATED_PATTERN", "low", "Self"), locale: "en", expectLens: "repeated_pattern", expect: "restraint" },
  // conflicting: both return_after_miss (medium) and relationship_concentration (high) present;
  // priority is fixed by lens rank (return_after_miss outranks relationship_concentration).
  { name: "9_conflicting_evidence", packet: base({ confidence: "high", derivedSignals: [ { code: "RELATIONSHIP_CONCENTRATION", relationship: "World", confidence: "high", supportingEvidenceIds: ["f1"] }, { code: "RETURN_AFTER_MISS", relationship: "Others", confidence: "medium", supportingEvidenceIds: ["f2"] } ], confirmedFacts: [ { id: "f1", kind: "activity", occurredAt: "2026-07-09T10:00:00+09:00", source: { tableOrService: "pattern_states" }, summaryCode: "ACTIVITY" }, { id: "f2", kind: "return", occurredAt: "2026-07-09T20:00:00+09:00", source: { tableOrService: "user_day" }, summaryCode: "RETURN" } ] }), locale: "en", expectLens: "return_after_miss", expect: "ok" },
  { name: "10_derived_others_no_explicit_choice", packet: signalPacket("RELATIONSHIP_CONCENTRATION", "medium", "Others"), locale: "en", expectLens: "relationship_concentration", expect: "ok" },
  { name: "11_recovery_reentry", packet: signalPacket("RECOVERY_REENTRY", "high", "Self"), locale: "en", expectLens: "recovery_reentry", expect: "ok" },
  { name: "12_korean_output", packet: signalPacket("RETURN_AFTER_MISS", "medium", "Others"), locale: "ko", expectLens: "return_after_miss", expect: "ok" },
  { name: "13_english_output", packet: signalPacket("RETURN_AFTER_MISS", "medium", "Others"), locale: "en", expectLens: "return_after_miss", expect: "ok" },
  // open contract present alongside a stronger signal → a step-producing lens may win by
  // priority, but the open-contract invariant still forces suggestedStep = null (no duplication).
  { name: "14_step_duplicates_open_contract", packet: signalPacket("RETURN_AFTER_MISS", "medium", "Others", { openContract: { id: "c9", actionTextReference: "ref:c9" }, confidence: "high" }), locale: "en", expectLens: "return_after_miss", expect: "ok" },
  // unsafe confrontation risk: prohibitedClaims flags it; allowed actions stay safe.
  { name: "15_unsafe_confrontation_risk", packet: signalPacket("RELATIONSHIP_CONCENTRATION", "medium", "Others", { prohibitedClaims: ["COERCIVE_CONFRONTATION", "MOTIVE_CERTAINTY"] }), locale: "en", expectLens: "relationship_concentration", expect: "ok" },
  { name: "16_repeated_recent_lens", packet: signalPacket("RETURN_AFTER_MISS", "medium", "Others"), locale: "en", recent: REPEAT_LENS, expectLens: "return_after_miss", expect: "fail_quiet" },
  { name: "17_repeated_action_verb", packet: signalPacket("RETURN_AFTER_MISS", "medium", "Others"), locale: "en", recent: REPEAT_VERB, expectLens: "return_after_miss", expect: "fail_quiet" },
  { name: "18_low_confidence", packet: signalPacket("REPEATED_PATTERN", "low", "Self"), locale: "en", expectLens: "repeated_pattern", expect: "restraint" },
  { name: "19_returned_after_inactive_day", packet: signalPacket("RETURN_AFTER_GAP", "medium", "Others"), locale: "en", expectLens: "return_after_miss", expect: "ok" },
  { name: "20_strong_world_derived", packet: signalPacket("RELATIONSHIP_CONCENTRATION", "high", "World"), locale: "en", expectLens: "relationship_concentration", expect: "ok" },
];

/**
 * V3 expanded KOREAN review set — same deterministic facts as their English counterparts,
 * locale "ko". At least 8 real KO generations for native-register review (Commander §7).
 */
export const KOREAN_REVIEW_FIXTURES: MirrorFixture[] = [
  { name: "ko1_insufficient", packet: base({ confidence: "none", insufficientEvidence: ["NO_EVIDENCE"] }), locale: "ko", expectLens: "insufficient_evidence", expect: "restraint" },
  { name: "ko2_return_after_miss", packet: signalPacket("RETURN_AFTER_MISS", "medium", "Others"), locale: "ko", expectLens: "return_after_miss", expect: "ok" },
  { name: "ko3_completion_latency", packet: signalPacket("LATENCY_SHORTENED", "medium", "Self"), locale: "ko", expectLens: "completion_latency", expect: "ok" },
  { name: "ko4_reexposure_changed", packet: signalPacket("REEXPOSURE_CHANGED", "high", "Others"), locale: "ko", expectLens: "reexposure_change", expect: "ok" },
  { name: "ko5_repeated_pattern", packet: signalPacket("REPEATED_PATTERN", "medium", "Self"), locale: "ko", expectLens: "repeated_pattern", expect: "ok" },
  { name: "ko6_relationship_others", packet: signalPacket("RELATIONSHIP_CONCENTRATION", "medium", "Others"), locale: "ko", expectLens: "relationship_concentration", expect: "ok" },
  { name: "ko7_relationship_world", packet: signalPacket("RELATIONSHIP_CONCENTRATION", "high", "World"), locale: "ko", expectLens: "relationship_concentration", expect: "ok" },
  { name: "ko8_recovery_reentry", packet: signalPacket("RECOVERY_REENTRY", "high", "Self"), locale: "ko", expectLens: "recovery_reentry", expect: "ok" },
  { name: "ko9_open_contract", packet: base({ confidence: "high", openContract: { id: "kc1", actionTextReference: "ref:kc1" } }), locale: "ko", expectLens: "open_contract_gravity", expect: "ok" },
  { name: "ko10_low_conf_repeated", packet: signalPacket("REPEATED_PATTERN", "low", "Self"), locale: "ko", expectLens: "repeated_pattern", expect: "restraint" },
  { name: "ko11_one_completed_low", packet: signalPacket("RELATIONSHIP_CONCENTRATION", "low", "Others"), locale: "ko", expectLens: "relationship_concentration", expect: "restraint" },
  { name: "ko12_unsafe_relationship", packet: signalPacket("RELATIONSHIP_CONCENTRATION", "medium", "Others", { prohibitedClaims: ["COERCIVE_CONFRONTATION", "MOTIVE_CERTAINTY"] }), locale: "ko", expectLens: "relationship_concentration", expect: "ok" },
];

/**
 * V5.1 targeted relationship-context cases — same deterministic facts/policies, locale "ko".
 * Verify the action object follows relationship_context, not just the lens, and that no internal
 * state / person / task is invented.
 */
export const KOREAN_TARGETED_FIXTURES: MirrorFixture[] = [
  { name: "tk1_return_others", packet: signalPacket("RETURN_AFTER_MISS", "medium", "Others"), locale: "ko", expectLens: "return_after_miss", expect: "ok" },
  { name: "tk2_return_self", packet: signalPacket("RETURN_AFTER_MISS", "medium", "Self"), locale: "ko", expectLens: "return_after_miss", expect: "ok" },
  { name: "tk3_return_world", packet: signalPacket("RETURN_AFTER_MISS", "medium", "World"), locale: "ko", expectLens: "return_after_miss", expect: "ok" },
  { name: "tk4_return_unknown", packet: signalPacket("RETURN_AFTER_MISS", "medium"), locale: "ko", expectLens: "return_after_miss", expect: "ok" },
  { name: "tk5_unsafe_others_no_emotion", packet: signalPacket("RELATIONSHIP_CONCENTRATION", "medium", "Others", { prohibitedClaims: ["COERCIVE_CONFRONTATION", "MOTIVE_CERTAINTY"] }), locale: "ko", expectLens: "relationship_concentration", expect: "ok" },
  { name: "tk6_others_no_desire", packet: signalPacket("RELATIONSHIP_CONCENTRATION", "medium", "Others"), locale: "ko", expectLens: "relationship_concentration", expect: "ok" },
  { name: "tk7_return_world_low", packet: signalPacket("RETURN_AFTER_MISS", "low", "World"), locale: "ko", expectLens: "return_after_miss", expect: "restraint" },
  { name: "tk8_others_safe_question", packet: signalPacket("RELATIONSHIP_CONCENTRATION", "medium", "Others"), locale: "ko", expectLens: "relationship_concentration", expect: "ok" },
];

// ─── Deterministic mock verbalizer (safe, evidence-bounded; no counts, no labels) ───

type Turn = {
  mirror: string;
  perspective: string;
  suggestedStep: { text: string; observableCompletion: string; timeWindow: string | null } | null;
  uncertaintyNote: string | null;
};

const REL_EN: Record<Relationship, string> = { Self: "Self", Others: "Others", World: "World" };
const REL_KO: Record<Relationship, string> = { Self: "자신", Others: "타인", World: "세계" };

function verbalize(
  lens: MirrorLens,
  locale: MirrorLocale,
  relationship: Relationship | null,
  confidence: string,
  mustNullStep: boolean,
): Turn {
  const rel = relationship ?? "Others";
  const relWord = locale === "ko" ? REL_KO[rel] : REL_EN[rel];
  const restraint = confidence === "low" || confidence === "none";
  const note = locale === "ko"
    ? "증거가 얕아 작은 관찰에 머무릅니다."
    : "Evidence is thin, so this stays a small observation.";

  const EN: Record<MirrorLens, Turn> = {
    reexposure_change: { mirror: "Something you returned to landed differently this time.", perspective: "That may reflect a change you carried in.", suggestedStep: { text: "Name one thing that felt different, in a sentence.", observableCompletion: "a written sentence exists", timeWindow: "today" }, uncertaintyNote: null },
    recovery_reentry: { mirror: "You stepped back in after stepping away.", perspective: "Re-entry may matter more than never pausing.", suggestedStep: { text: "Return to one small thing you set down.", observableCompletion: "the thing is picked back up", timeWindow: "today" }, uncertaintyNote: null },
    return_after_miss: { mirror: "After letting something slip, you came back to it.", perspective: "The edge today may be starting a little earlier.", suggestedStep: { text: "Reach out to the person you postponed, with one question.", observableCompletion: "a message is sent", timeWindow: "before evening" }, uncertaintyNote: null },
    completion_latency: { mirror: "You closed the space between deciding and doing more quickly.", perspective: "Beginning sooner may be getting easier for you.", suggestedStep: { text: "Begin the next thing before you feel fully ready.", observableCompletion: "the task is started", timeWindow: "today" }, uncertaintyNote: null },
    open_contract_gravity: { mirror: "A promise you made is still open.", perspective: "Today may simply be for entering it.", suggestedStep: null, uncertaintyNote: null },
    repeated_pattern: { mirror: "A familiar move showed up again in your choices.", perspective: "Naming it may loosen its hold more than avoiding it.", suggestedStep: { text: "Say the pattern out loud to someone you trust.", observableCompletion: "you said it aloud to someone", timeWindow: "today" }, uncertaintyNote: null },
    relationship_concentration: { mirror: `Recent activity leaned toward ${relWord}.`, perspective: `Today may be a chance to meet ${relWord} a little more directly.`, suggestedStep: { text: `Turn toward one ${relWord}-connected thing you have kept at arm's length.`, observableCompletion: "one concrete step is taken", timeWindow: "today" }, uncertaintyNote: null },
    insufficient_evidence: { mirror: "There isn't much to read into today yet.", perspective: "A quiet day can simply be lived.", suggestedStep: null, uncertaintyNote: note },
  };

  const KO: Record<MirrorLens, Turn> = {
    reexposure_change: { mirror: "다시 마주한 일이 이번에는 다르게 흘러갔습니다.", perspective: "그것은 당신이 가져온 변화일 수 있습니다.", suggestedStep: { text: "달랐던 점 하나를 한 문장으로 적어보세요.", observableCompletion: "문장이 하나 남는다", timeWindow: "오늘" }, uncertaintyNote: null },
    recovery_reentry: { mirror: "잠시 멈췄다가 다시 들어섰습니다.", perspective: "다시 돌아온 일이 멈추지 않은 것보다 중요할 수 있습니다.", suggestedStep: { text: "내려놓았던 작은 일 하나로 돌아가 보세요.", observableCompletion: "그 일을 다시 손에 든다", timeWindow: "오늘" }, uncertaintyNote: null },
    return_after_miss: { mirror: "놓쳤던 일에 당신은 다시 돌아왔습니다.", perspective: "오늘의 결은 조금 더 일찍 시작하는 것일 수 있습니다.", suggestedStep: { text: "미뤄둔 사람에게 설명 대신 한 문장의 질문을 보내세요.", observableCompletion: "메시지가 전송된다", timeWindow: "저녁 전" }, uncertaintyNote: null },
    completion_latency: { mirror: "결정과 실행 사이의 간격을 더 빠르게 좁혔습니다.", perspective: "더 일찍 시작하는 일이 조금씩 쉬워지고 있을 수 있습니다.", suggestedStep: { text: "완전히 준비되기 전에 다음 일을 시작해 보세요.", observableCompletion: "그 일이 시작된다", timeWindow: "오늘" }, uncertaintyNote: null },
    open_contract_gravity: { mirror: "당신이 한 약속이 아직 열려 있습니다.", perspective: "오늘은 그 약속으로 들어서는 날일 수 있습니다.", suggestedStep: null, uncertaintyNote: null },
    repeated_pattern: { mirror: "익숙한 움직임이 당신의 선택에 다시 나타났습니다.", perspective: "피하기보다 이름을 붙이는 편이 그 힘을 느슨하게 할 수 있습니다.", suggestedStep: { text: "그 패턴을 믿는 사람에게 소리 내어 말해 보세요.", observableCompletion: "누군가에게 소리 내어 말했다", timeWindow: "오늘" }, uncertaintyNote: null },
    relationship_concentration: { mirror: `최근 기록은 ${relWord}와 연결된 쪽으로 기울어 있었습니다.`, perspective: `오늘은 ${relWord}를 조금 더 직접 마주하는 기회일 수 있습니다.`, suggestedStep: { text: `거리를 두었던 ${relWord}와 연결된 일 하나로 향해 보세요.`, observableCompletion: "구체적인 한 걸음을 뗀다", timeWindow: "오늘" }, uncertaintyNote: null },
    insufficient_evidence: { mirror: "오늘은 아직 읽어낼 것이 많지 않습니다.", perspective: "조용한 하루도 하루입니다.", suggestedStep: null, uncertaintyNote: note },
  };

  const turn = { ...(locale === "ko" ? KO : EN)[lens] };
  if (restraint && !turn.uncertaintyNote) turn.uncertaintyNote = note;
  if (mustNullStep) turn.suggestedStep = null;
  return turn;
}

/** A MirrorLlmClient that reads the analysis from the prompt and returns safe mock JSON. */
export function makeMockMirrorClient(): MirrorLlmClient {
  return {
    chat: {
      completions: {
        async create(params) {
          const user = params.messages.find((m) => m.role === "user")?.content ?? "{}";
          const a = JSON.parse(user) as {
            lens: MirrorLens;
            locale: MirrorLocale;
            relationship: Relationship | null;
            confidence: string;
            mustAvoidContractDuplication: boolean;
          };
          const turn = verbalize(a.lens, a.locale, a.relationship, a.confidence, a.mustAvoidContractDuplication);
          return { choices: [{ message: { content: JSON.stringify(turn) } }] };
        },
      },
    },
  };
}

/** A client that returns deliberately unsafe/generic content — for negative validator tests. */
export function makeUnsafeMirrorClient(kind: "generic" | "identity" | "count" | "choice" | "metric"): MirrorLlmClient {
  const bad: Record<string, Turn> = {
    generic: { mirror: "Keep going, small steps matter.", perspective: "You've got this.", suggestedStep: { text: "Trust the process.", observableCompletion: "n/a", timeWindow: null }, uncertaintyNote: null },
    identity: { mirror: "You are avoidant and a little cowardly.", perspective: "That is who you are.", suggestedStep: { text: "Stop being weak.", observableCompletion: "n/a", timeWindow: null }, uncertaintyNote: null },
    count: { mirror: "You chose Others 4 times this week.", perspective: "That is 3 more than last week.", suggestedStep: null, uncertaintyNote: null },
    choice: { mirror: "You selected Others again today.", perspective: "You keep choosing World.", suggestedStep: null, uncertaintyNote: null },
    metric: { mirror: "Your AIR score and rank both dropped.", perspective: "Your XP streak is at risk.", suggestedStep: null, uncertaintyNote: null },
  };
  return {
    chat: { completions: { async create() { return { choices: [{ message: { content: JSON.stringify(bad[kind]) } }] } } } },
  };
}
