/**
 * BTY Today AI Mirror — Korean Golden Voice Set (service layer, shadow-only).
 *
 * A Today-SPECIFIC verbalization calibration asset: approved + rejected Korean examples that
 * DEMONSTRATE the BTY Today voice so the model imitates quality rather than inferring it from a
 * growing list of abstract rules. NOT a persona, NOT counseling, NOT fine-tuning. No real user
 * content, no internal table names / ids / metrics / raw action text. Used only to build a small
 * few-shot projection for KOREAN generation. English generation never sees this.
 */
import type { MirrorLens } from "@/domain/daily/todayMirror.types";

export type KoreanGoldenVoiceExample = {
  id: string;
  lens: MirrorLens;
  confidence: "none" | "low" | "medium" | "high";
  evidenceShape: {
    confirmedFact: string;
    contrast?: string | null;
    honestLimit?: string | null;
    relationship?: "SELF" | "OTHERS" | "WORLD" | null;
    openPromise: boolean;
  };
  approved: {
    mirror: string;
    perspective: string;
    suggestedStep: string | null;
    uncertaintyNote: string | null;
  };
  rejectedAlternatives: Array<{ text: string; reasons: string[] }>;
  voicePrinciples: string[];
};

export const KOREAN_GOLDEN_SET: KoreanGoldenVoiceExample[] = [
  {
    id: "g_insufficient",
    lens: "insufficient_evidence",
    confidence: "none",
    evidenceShape: { confirmedFact: "오늘 읽어낼 만한 움직임이 거의 없음", openPromise: false },
    approved: {
      mirror: "오늘은 아직 읽어낼 만한 움직임이 많지 않습니다.",
      perspective: "무리해서 의미를 붙이기보다, 여기까지만 말하는 편이 정확합니다.",
      suggestedStep: null,
      uncertaintyNote: "아직 한 걸음도 뚜렷하지 않습니다.",
    },
    rejectedAlternatives: [
      { text: "현재로서는 충분한 증거가 보이지 않습니다.", reasons: ["내부 '증거' 언어", "고지·면책 말투"] },
    ],
    voicePrinciples: ["증거가 얕을 땐 조용히 멈춘다", "시스템 보고체 금지"],
  },
  {
    id: "g_low_others",
    lens: "relationship_concentration",
    confidence: "low",
    evidenceShape: { confirmedFact: "최근 타인과 관련된 행동이 한 번 나타남", relationship: "OTHERS", openPromise: false },
    approved: {
      mirror: "최근에는 다른 사람과 관련된 일에 손이 한 번 더 갔습니다.",
      perspective: "다만 이것을 관계 자체가 달라진 것으로 보기에는 이릅니다.",
      suggestedStep: null,
      uncertaintyNote: "지금은 한 가지 이상을 말하지 않는 편이 낫습니다.",
    },
    rejectedAlternatives: [
      { text: "타인과의 연결이 더 강화되고 있음을 보여줍니다.", reasons: ["행동 빈도를 관계의 질로 비약", "강화/깊어짐은 증거에 없음"] },
      { text: "다른 사람과의 관계가 더욱 두드러진 모습을 보입니다.", reasons: ["'모습을 보입니다' 기계적", "관계가 부각됐다는 근거 없는 판단"] },
    ],
    voicePrinciples: ["행동 빈도는 관계의 질이 아니다", "강화/깊어짐/가까워짐을 단정하지 않는다"],
  },
  {
    id: "g_return_others",
    lens: "return_after_miss",
    confidence: "medium",
    evidenceShape: { confirmedFact: "놓친 뒤 다시 돌아옴 (타인 관련 행동)", honestLimit: "한 번으로는 흐름 변화라 보기 어려움", relationship: "OTHERS", openPromise: false },
    approved: {
      mirror: "놓친 뒤에도 다시 돌아왔습니다.",
      perspective: "다만 이번 한 번만으로 흐름이 달라졌다고 보기는 어렵습니다.",
      suggestedStep: "미뤄둔 한 사람에게, 설명보다 먼저 한 문장으로 물어보세요.",
      uncertaintyNote: null,
    },
    rejectedAlternatives: [
      { text: "패턴이 변화했는지는 아직 확인되지 않았습니다.", reasons: ["시스템 평가 언어", "수동적·거리감", "측정당하는 느낌"] },
    ],
    voicePrinciples: ["돌아옴은 단정, 변화는 유보", "타인일 때만 사람을 향한 행동"],
  },
  {
    id: "g_return_self",
    lens: "return_after_miss",
    confidence: "medium",
    evidenceShape: { confirmedFact: "놓친 뒤 다시 돌아옴 (자신에게 한 일)", honestLimit: "한 번으로는 흐름 변화라 보기 어려움", relationship: "SELF", openPromise: false },
    approved: {
      mirror: "내려놓았던 일로 다시 돌아왔습니다.",
      perspective: "오늘의 결은 다시 시작했다는 데보다, 다음에는 더 일찍 돌아오는 데 있을 수 있습니다.",
      suggestedStep: "미뤄뒀던 그 일에서, 가장 작은 첫 동작 하나를 다시 시작하세요.",
      uncertaintyNote: null,
    },
    rejectedAlternatives: [
      { text: "미뤄둔 사람에게 먼저 연락하세요.", reasons: ["증거에 없는 사람을 지어냄", "자기 영역 행동에 타인을 끌어들임"] },
    ],
    voicePrinciples: ["자신에게 한 일이면 타인을 지어내지 않는다", "자기 영역의 첫 동작"],
  },
  {
    id: "g_return_world",
    lens: "return_after_miss",
    confidence: "medium",
    evidenceShape: { confirmedFact: "놓친 뒤 다시 돌아옴 (맡은 일·책임)", honestLimit: "한 번으로는 흐름 변화라 보기 어려움", relationship: "WORLD", openPromise: false },
    approved: {
      mirror: "미뤄뒀던 일로 다시 돌아왔습니다.",
      perspective: "다만 이번 한 번만으로 흐름이 달라졌다고 보기는 어렵습니다.",
      suggestedStep: "멈춰 있던 그 일에서, 남은 첫 단계 하나를 오늘 시작하세요.",
      uncertaintyNote: null,
    },
    rejectedAlternatives: [
      { text: "그 패턴이 변화했는지는 아직 확인되지 않았습니다.", reasons: ["시스템 보고체", "수동적 판단 언어", "측정당하는 느낌", "내부 판정 노출"] },
      { text: "변화의 증거가 아직 부족합니다.", reasons: ["'증거' 내부 언어", "고지·면책 말투"] },
      { text: "미뤄둔 사람에게 한 문장으로 물어보세요.", reasons: ["일·책임 증거에 없는 사람을 지어냄", "관계를 잘못 가정"] },
    ],
    voicePrinciples: ["한계는 자연스럽게('한 번만으로는 …보기 어렵다')", "'확인/증거/검증' 보고체 금지", "일·책임이면 사람을 지어내지 않는다"],
  },
  {
    id: "g_return_unknown",
    lens: "return_after_miss",
    confidence: "medium",
    evidenceShape: { confirmedFact: "놓친 뒤 다시 돌아옴 (대상 불명확)", honestLimit: "무엇으로 돌아왔는지까지는 분명하지 않음", relationship: null, openPromise: false },
    approved: {
      mirror: "놓친 뒤에도 다시 돌아왔습니다.",
      perspective: "다만 이번 한 번만으로 흐름이 달라졌다고 보기는 어렵습니다.",
      suggestedStep: "미뤄뒀던 것 하나에서, 가장 작은 첫 동작을 오늘 시작하세요.",
      uncertaintyNote: null,
    },
    rejectedAlternatives: [
      { text: "미뤄둔 사람에게 먼저 연락하세요.", reasons: ["대상이 불명확한데 사람을 지어냄"] },
      { text: "맡은 일의 다음 단계를 끝내세요.", reasons: ["일이라는 증거가 없는데 과제를 지어냄"] },
    ],
    voicePrinciples: ["대상이 불명확하면 사람도 과제도 지어내지 않는다", "중립적 첫 동작 또는 null"],
  },
  {
    id: "g_latency",
    lens: "completion_latency",
    confidence: "medium",
    evidenceShape: { confirmedFact: "행동을 정한 뒤 완료 확인까지의 시간이 이전 비교 행동보다 짧아짐", contrast: "이전 비교 행동은 더 오래 걸렸고 이번엔 더 빨리 끝남", relationship: "SELF", openPromise: false },
    approved: {
      mirror: "이번에는 행동을 정한 뒤 완료하기까지 걸린 시간이 더 짧았습니다.",
      perspective: "오늘의 결은 정한 일을 미루지 않고 끝까지 가져가는 데 있을 수 있습니다.",
      suggestedStep: "이미 정해둔 일 하나를, 오늘 안에 끝까지 마무리하세요.",
      uncertaintyNote: null,
    },
    rejectedAlternatives: [
      { text: "이번에는 알아차린 뒤 더 빨리 움직였습니다.", reasons: ["chosen_at→verified_at는 '인식-시작' 지연이 아님", "시작 속도/반응 속도로 왜곡"] },
      { text: "시작이 빨라졌고 실행력이 향상됐습니다.", reasons: ["결단력/실행력 향상은 증거에 없음", "습관 변화 단정"] },
    ],
    voicePrinciples: ["'정한 뒤 완료까지'의 간격만 말한다(인식-시작 아님)", "사실은 단정, 의미는 유보"],
  },
  {
    id: "g_reexposure",
    lens: "reexposure_change",
    confidence: "high",
    evidenceShape: { confirmedFact: "다시 마주한 상황에서 끝이 달라짐", contrast: "이전과 이번의 결말이 다름", relationship: "OTHERS", openPromise: false },
    approved: {
      mirror: "같은 상황을 다시 마주했지만, 이번에는 끝이 달랐습니다.",
      perspective: "아직 한 번의 변화이지만, 이전과 다른 선택이 실제로 나타났습니다.",
      suggestedStep: "무엇이 달랐는지 한 문장으로 적어두세요.",
      uncertaintyNote: null,
    },
    rejectedAlternatives: [
      { text: "긍정적인 움직임을 보여줍니다.", reasons: ["근거 없는 가치 판단", "막연한 칭찬"] },
    ],
    voicePrinciples: ["사실 먼저, 대비가 보이게", "변화를 과장하지 않는다"],
  },
  {
    id: "g_reexposure_nochange",
    lens: "repeated_pattern",
    confidence: "low",
    evidenceShape: { confirmedFact: "같은 장면이 한 번 더 반복됨", honestLimit: "달라진 것은 아직 없음", relationship: "SELF", openPromise: false },
    approved: {
      mirror: "익숙한 장면이 같은 자리에서 한 번 더 반복됐습니다.",
      perspective: "달라진 것은 아직 보이지 않지만, 시작하는 그 순간이 바꿀 수 있는 자리입니다.",
      suggestedStep: null,
      uncertaintyNote: "아직 한 번의 반복이라, 여기까지만 말하겠습니다.",
    },
    rejectedAlternatives: [
      { text: "가장 이른 순간이 변화를 시작할 수 있는 지점으로 보입니다.", reasons: ["번역투 구문", "추상적", "기계적 유보"] },
    ],
    voicePrinciples: ["반복은 단정, 변화는 유보", "지점/시사 같은 보고체 금지"],
  },
  {
    id: "g_repeated",
    lens: "repeated_pattern",
    confidence: "medium",
    evidenceShape: { confirmedFact: "비슷한 순간에 익숙한 선택이 다시 나옴", relationship: "SELF", openPromise: false },
    approved: {
      mirror: "비슷한 순간에 익숙한 선택이 다시 나왔습니다.",
      perspective: "그 선택이 시작되는 가장 이른 순간이, 손댈 수 있는 자리입니다.",
      suggestedStep: "그 순간이 오면, 늘 하던 행동 대신 한 가지를 다르게 하세요.",
      uncertaintyNote: null,
    },
    rejectedAlternatives: [
      { text: "변화가 가능하다는 의미가 있습니다.", reasons: ["추상적", "기계적", "사람에게 닿지 않음"] },
    ],
    voicePrinciples: ["가장 이른 순간을 짚는다", "행동은 관찰 가능한 한 동작"],
  },
  {
    id: "g_others",
    lens: "relationship_concentration",
    confidence: "medium",
    evidenceShape: { confirmedFact: "최근 타인과 나눈 일에 손이 더 감", relationship: "OTHERS", openPromise: false },
    approved: {
      mirror: "최근에는 다른 사람과 나눈 일에 더 자주 손이 갔습니다.",
      perspective: "다만 이것을 관계가 좋아졌다거나 가까워졌다고 보기에는 이릅니다.",
      suggestedStep: "한 사람에게, 미뤄둔 한 가지를 분명하게 물어보세요.",
      uncertaintyNote: null,
    },
    rejectedAlternatives: [
      { text: "타인과의 연결이 더욱 부각되었습니다.", reasons: ["행동 빈도를 관계의 질/부각으로 비약", "증거에 없는 판단"] },
      { text: "관계가 긍정적으로 변하고 있습니다.", reasons: ["근거 없는 관계 변화 판단", "빈도≠질"] },
    ],
    voicePrinciples: ["빈도는 질이 아니다 — 관계의 좋아짐/가까워짐을 말하지 않는다", "한 사람·한 가지로 좁힌다"],
  },
  {
    id: "g_world",
    lens: "relationship_concentration",
    confidence: "high",
    evidenceShape: { confirmedFact: "최근 맡은 일·책임 쪽으로 무게가 실림", relationship: "WORLD", openPromise: false },
    approved: {
      mirror: "최근에는 맡은 일과 책임 쪽으로 무게가 실렸습니다.",
      perspective: "오늘은 벌여둔 여러 일보다, 마무리가 남은 하나를 매듭짓는 편이 나을 수 있습니다.",
      suggestedStep: "오늘 안에 끝낼 수 있는 일 하나를 골라, 마지막 한 단계를 끝내세요.",
      uncertaintyNote: null,
    },
    rejectedAlternatives: [
      { text: "세계와 관련된 상호작용을 더 명확히 해보세요.", reasons: ["추상적 '세계'", "대인관계 틀을 일에 잘못 적용"] },
      { text: "맡은 일에 대한 집중을 시사합니다.", reasons: ["보고 말투", "행동으로 이어지지 않음"] },
    ],
    voicePrinciples: ["'세계'를 일·책임으로 옮긴다", "구체 동사(끝내다/정리하다/고치다)"],
  },
  {
    id: "g_recovery",
    lens: "recovery_reentry",
    confidence: "high",
    evidenceShape: { confirmedFact: "멈췄던 자리로 다시 돌아옴", relationship: "SELF", openPromise: false },
    approved: {
      mirror: "멈췄던 자리로 다시 돌아왔습니다.",
      perspective: "오늘은 그 걸음을 크게 만들기보다, 끊기지 않게 이어가는 편이 낫습니다.",
      suggestedStep: "내려놓았던 일 하나를, 딱 한 걸음만 다시 이어가세요.",
      uncertaintyNote: null,
    },
    rejectedAlternatives: [
      { text: "재진입은 작지만 보호할 가치가 있습니다.", reasons: ["'재진입' 관공서 용어", "심리적 회복 묘사"] },
      { text: "작은 행동을 계속 유지하는 것이 중요합니다.", reasons: ["일반적 조언", "거의 모든 사람에게 전송 가능"] },
    ],
    voicePrinciples: ["행동상의 돌아옴만 말한다", "재진입/복귀/회복 단계 금지"],
  },
  {
    id: "g_open",
    lens: "open_contract_gravity",
    confidence: "high",
    evidenceShape: { confirmedFact: "이전에 한 약속이 아직 열려 있음", openPromise: true },
    approved: {
      mirror: "이전에 하신 약속이 아직 열려 있습니다.",
      perspective: "오늘은 새로운 일을 더하기보다, 그 약속 안으로 들어가는 날일 수 있습니다.",
      suggestedStep: null,
      uncertaintyNote: null,
    },
    rejectedAlternatives: [
      { text: "오늘은 그 약속을 이행할 수 있는 기회입니다.", reasons: ["'기회입니다' 상투적", "약속을 새 조언으로 감쌈"] },
    ],
    voicePrinciples: ["약속은 사용자의 것으로 둔다", "새 행동 제안을 만들지 않는다(step=null)"],
  },
  {
    id: "g_unsafe_others",
    lens: "relationship_concentration",
    confidence: "medium",
    evidenceShape: { confirmedFact: "최근 다른 사람과 관련된 행동이 더 자주 나타남", relationship: "OTHERS", openPromise: false },
    approved: {
      mirror: "최근에는 다른 사람과 관련된 행동이 더 자주 나타났습니다.",
      perspective: "지금은 그 이상을 말하지 않는 편이 정확합니다.",
      suggestedStep: null,
      uncertaintyNote: null,
    },
    rejectedAlternatives: [
      { text: "타인과의 연결이 더 강화되고 있음을 보여줍니다.", reasons: ["행동 빈도를 관계의 질로 비약", "강화/부각은 증거에 없음"] },
      { text: "다른 사람과 얽힌 일에 마음이 더 쓰였습니다.", reasons: ["행동 증거로 감정·관심 등 내면 상태를 단정", "관찰이 아니라 추측"] },
      { text: "이런 변화는 타인과의 관계에서 긍정적인 움직임을 보여줍니다.", reasons: ["근거 없는 긍정 판단", "막연한 칭찬"] },
    ],
    voicePrinciples: ["관계의 방향(강화/좋아짐)을 평가하지 않는다", "감정·욕구를 단정하지 않는다", "안전하지 않으면 step=null"],
  },
];
