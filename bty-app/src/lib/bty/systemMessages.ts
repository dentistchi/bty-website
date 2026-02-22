// bty-app/src/lib/bty/systemMessages.ts
// BTY Arena System Messages (EN 20 + KO 10)
// 목적: Hero / Toast / Feed / Milestone 채널로 재사용 가능하도록 "메시지 엔진"용 스키마로 정리

export type Locale = "en" | "ko";

export type MessageChannel =
  | "hero"       // 로그인 후 상단 1줄
  | "toast"      // 이벤트 직후 짧은 팝업
  | "feed"       // 활동 로그
  | "milestone"; // 잠금해제/예고 카드

export type TriggerType =
  | "streak"          // streak_days
  | "leaderboard"     // percentile
  | "hidden_stat"     // integrity/insight/etc 변화
  | "system_event";   // stage/unlock 등

export type HiddenStatKey = "integrity" | "communication" | "insight" | "resilience" | "gratitude";

export type SystemMessage = {
  id: string;
  locale: Locale;
  channel: MessageChannel;

  // 분류/필터용
  tags: string[];

  // 표시 텍스트
  text: string;

  // 우선순위: hero/토스트에서 경쟁할 때 사용 (큰값 우선)
  priority: number;

  // 같은 메시지 반복 방지(초)
  cooldownSec: number;

  // 어떤 조건에서 후보가 되는지(엔진이 평가)
  trigger: {
    type: TriggerType;

    // streak 트리거
    streakDays?: number[];

    // leaderboard 트리거
    percentileLTE?: number; // 예: 5

    // hidden stat 트리거
    statKey?: HiddenStatKey;
    deltaGTE?: number; // 예: +3

    // system event 트리거
    eventKeys?: string[]; // 예: ["ARCH_INIT", "RESP_UP", "VOLUNTEER_UNLOCK"]
  };
};

// --------------------
// EN (20)
// --------------------
const EN: SystemMessage[] = [
  // [Streak & Consistency]
  {
    id: "en_streak_3_consistency_confirmed",
    locale: "en",
    channel: "toast",
    tags: ["streak", "consistency"],
    text: "Consistency confirmed. 3-day operational rhythm established.",
    priority: 70,
    cooldownSec: 86400,
    trigger: { type: "streak", streakDays: [3] },
  },
  {
    id: "en_streak_7_standardization",
    locale: "en",
    channel: "toast",
    tags: ["streak", "consistency"],
    text: "Standardization in progress. 7-day leadership calibration complete.",
    priority: 72,
    cooldownSec: 86400,
    trigger: { type: "streak", streakDays: [7] },
  },
  {
    id: "en_streak_30_core_habit",
    locale: "en",
    channel: "hero",
    tags: ["streak", "milestone"],
    text: "Core habit solidified. 30-day streak detected. Legacy building initiated.",
    priority: 90,
    cooldownSec: 86400,
    trigger: { type: "streak", streakDays: [30] },
  },
  {
    id: "en_architect_status_active",
    locale: "en",
    channel: "hero",
    tags: ["status", "identity"],
    text: "Architect status active. Your unwavering focus is reshaping the landscape.",
    priority: 80,
    cooldownSec: 43200,
    trigger: { type: "system_event", eventKeys: ["ARCH_STATUS_ACTIVE"] },
  },
  {
    id: "en_momentum_verified",
    locale: "en",
    channel: "feed",
    tags: ["momentum", "team"],
    text: "Momentum verified. Your daily commitment is now the team's baseline.",
    priority: 40,
    cooldownSec: 21600,
    trigger: { type: "system_event", eventKeys: ["MOMENTUM_VERIFIED"] },
  },

  // [Performance & Status]
  {
    id: "en_elite_top5",
    locale: "en",
    channel: "toast",
    tags: ["leaderboard", "elite"],
    text: "Elite tier reached. You are currently within the top 5% of global DSO architects.",
    priority: 95,
    cooldownSec: 604800, // 주 1회 이상은 과열되기 쉬움
    trigger: { type: "leaderboard", percentileLTE: 5 },
  },
  {
    id: "en_strategic_influence_expanding",
    locale: "en",
    channel: "feed",
    tags: ["status", "influence"],
    text: "Strategic influence expanding. Your decisions now resonate beyond your immediate sector.",
    priority: 45,
    cooldownSec: 43200,
    trigger: { type: "system_event", eventKeys: ["INFLUENCE_UP"] },
  },
  {
    id: "en_high_value_asset",
    locale: "en",
    channel: "feed",
    tags: ["status", "ops"],
    text: "High-Value Asset detected. Your operational efficiency is setting a new benchmark.",
    priority: 50,
    cooldownSec: 43200,
    trigger: { type: "system_event", eventKeys: ["OPS_BENCHMARK"] },
  },
  {
    id: "en_builder_status_stabilizing",
    locale: "en",
    channel: "hero",
    tags: ["status", "builder"],
    text: "Builder status stabilizing. The structural integrity of your leadership is increasing.",
    priority: 78,
    cooldownSec: 43200,
    trigger: { type: "system_event", eventKeys: ["BUILDER_STABLE"] },
  },
  {
    id: "en_peak_performance_95",
    locale: "en",
    channel: "feed",
    tags: ["performance"],
    text: "Peak performance logged. Tactical precision remains above the 95th percentile.",
    priority: 55,
    cooldownSec: 86400,
    trigger: { type: "system_event", eventKeys: ["PEAK_95"] },
  },

  // [Skills & Milestones]
  {
    id: "en_integrity_spike",
    locale: "en",
    channel: "toast",
    tags: ["hidden", "integrity"],
    text: "Integrity spike detected. Your ethical alignment has fortified the organization.",
    priority: 85,
    cooldownSec: 86400,
    trigger: { type: "hidden_stat", statKey: "integrity", deltaGTE: 3 },
  },
  {
    id: "en_gratitude_frequency",
    locale: "en",
    channel: "feed",
    tags: ["hidden", "gratitude"],
    text: "Gratitude frequency synchronized. Positive cultural impact is now measurable.",
    priority: 60,
    cooldownSec: 86400,
    trigger: { type: "hidden_stat", statKey: "gratitude", deltaGTE: 2 },
  },
  {
    id: "en_insight_engine_upgraded",
    locale: "en",
    channel: "feed",
    tags: ["hidden", "insight"],
    text: "Insight engine upgraded. Pattern recognition in conflict resolution is improving.",
    priority: 60,
    cooldownSec: 43200,
    trigger: { type: "hidden_stat", statKey: "insight", deltaGTE: 2 },
  },
  {
    id: "en_volunteer_unlocked",
    locale: "en",
    channel: "milestone",
    tags: ["unlock", "volunteer"],
    text: "Volunteer protocol unlocked. You are now eligible for high-impact social initiatives.",
    priority: 88,
    cooldownSec: 604800,
    trigger: { type: "system_event", eventKeys: ["VOLUNTEER_UNLOCK"] },
  },
  {
    id: "en_mentorship_window_opening",
    locale: "en",
    channel: "milestone",
    tags: ["unlock", "mentorship"],
    text: "Mentorship window opening. Prepare to transfer core competencies in 3 days.",
    priority: 88,
    cooldownSec: 604800,
    trigger: { type: "system_event", eventKeys: ["MENTORSHIP_T_MINUS_3"] },
  },

  // [System & Duty]
  {
    id: "en_architecture_initialized",
    locale: "en",
    channel: "hero",
    tags: ["system"],
    text: "Architecture initialized. The framework for your next growth phase is ready.",
    priority: 82,
    cooldownSec: 43200,
    trigger: { type: "system_event", eventKeys: ["ARCH_INIT"] },
  },
  {
    id: "en_resilience_threshold",
    locale: "en",
    channel: "feed",
    tags: ["hidden", "resilience"],
    text: "Resilience threshold surpassed. System recovery speed is at an all-time high.",
    priority: 65,
    cooldownSec: 86400,
    trigger: { type: "hidden_stat", statKey: "resilience", deltaGTE: 2 },
  },
  {
    id: "en_leadership_telemetry",
    locale: "en",
    channel: "feed",
    tags: ["system", "telemetry"],
    text: "Leadership telemetry active. Every choice is refining the arena's intelligence.",
    priority: 40,
    cooldownSec: 43200,
    trigger: { type: "system_event", eventKeys: ["TELEMETRY_ON"] },
  },
  {
    id: "en_responsibility_weight_adjusted",
    locale: "en",
    channel: "toast",
    tags: ["system", "duty"],
    text: "Responsibility weight adjusted. You have been cleared for higher-stakes scenarios.",
    priority: 75,
    cooldownSec: 604800,
    trigger: { type: "system_event", eventKeys: ["RESP_UP"] },
  },
  {
    id: "en_system_integrity_verified",
    locale: "en",
    channel: "feed",
    tags: ["system", "stability"],
    text: "System integrity verified. Your path to mastery remains unobstructed.",
    priority: 35,
    cooldownSec: 86400,
    trigger: { type: "system_event", eventKeys: ["SYSTEM_OK"] },
  },
];

// --------------------
// KO (10)
// --------------------
const KO: SystemMessage[] = [
  // [리더의 무게와 책임]
  {
    id: "ko_leadership_orbit",
    locale: "ko",
    channel: "hero",
    tags: ["리더십", "일관성"],
    text: "리더십 궤도 진입. 귀하의 일관성이 조직의 새로운 표준이 되고 있습니다.",
    priority: 80,
    cooldownSec: 43200,
    trigger: { type: "system_event", eventKeys: ["LEADERSHIP_ORBIT"] },
  },
  {
    id: "ko_influence_index_up",
    locale: "ko",
    channel: "feed",
    tags: ["영향력", "심리적안전"],
    text: "영향력 지수 상승. 귀하의 선택이 팀 전체의 심리적 안전감을 강화합니다.",
    priority: 55,
    cooldownSec: 43200,
    trigger: { type: "system_event", eventKeys: ["INFLUENCE_UP"] },
  },
  {
    id: "ko_trust_asset",
    locale: "ko",
    channel: "feed",
    tags: ["신뢰", "원칙"],
    text: "신뢰 자산 축적. 원칙 중심의 결정이 조직의 결속력을 높이고 있습니다.",
    priority: 55,
    cooldownSec: 43200,
    trigger: { type: "hidden_stat", statKey: "integrity", deltaGTE: 2 },
  },
  {
    id: "ko_mentoring_ready_72h",
    locale: "ko",
    channel: "milestone",
    tags: ["멘토링", "프로토콜"],
    text: "멘토링 준비 완료. 72시간 내에 지식 전수 프로토콜이 활성화됩니다.",
    priority: 88,
    cooldownSec: 604800,
    trigger: { type: "system_event", eventKeys: ["MENTORSHIP_T_MINUS_3"] },
  },
  {
    id: "ko_strategic_intuition",
    locale: "ko",
    channel: "feed",
    tags: ["직관", "갈등"],
    text: "전략적 직관 포착. 복잡한 갈등 상황에서 최적의 해법을 도출해냈습니다.",
    priority: 60,
    cooldownSec: 86400,
    trigger: { type: "hidden_stat", statKey: "insight", deltaGTE: 2 },
  },

  // [성취와 자부심]
  {
    id: "ko_top5_leaderboard",
    locale: "ko",
    channel: "toast",
    tags: ["리더보드", "상위5%"],
    text: "상위 5% 리더보드 진입. 탁월함은 반복된 행동의 결과입니다.",
    priority: 95,
    cooldownSec: 604800,
    trigger: { type: "leaderboard", percentileLTE: 5 },
  },
  {
    id: "ko_gratitude_log",
    locale: "ko",
    channel: "feed",
    tags: ["감사", "문화"],
    text: "감사 로그 기록됨. 리더의 진심이 조직의 정서적 자산으로 전환되었습니다.",
    priority: 65,
    cooldownSec: 86400,
    trigger: { type: "hidden_stat", statKey: "gratitude", deltaGTE: 2 },
  },
  {
    id: "ko_resilience_verified",
    locale: "ko",
    channel: "feed",
    tags: ["회복탄력성", "위기대응"],
    text: "회복 탄력성 검증. 위기 대응 후 시스템 안정화 속도가 매우 우수합니다.",
    priority: 65,
    cooldownSec: 86400,
    trigger: { type: "hidden_stat", statKey: "resilience", deltaGTE: 2 },
  },
  {
    id: "ko_arena_sync",
    locale: "ko",
    channel: "feed",
    tags: ["아레나", "운영효율"],
    text: "아레나 동기화 완료. 귀하의 성장이 DSO 운영 효율의 상한선을 높입니다.",
    priority: 50,
    cooldownSec: 86400,
    trigger: { type: "system_event", eventKeys: ["ARENA_SYNC"] },
  },
  {
    id: "ko_sustainable_leadership_30",
    locale: "ko",
    channel: "hero",
    tags: ["지속가능", "30일"],
    text: "지속 가능한 리더십. 30일간의 여정이 견고한 변화의 토대를 마련했습니다.",
    priority: 92,
    cooldownSec: 86400,
    trigger: { type: "streak", streakDays: [30] },
  },
];

export const BTY_SYSTEM_MESSAGES: SystemMessage[] = [...EN, ...KO];

// 편의 함수: 로케일 필터
export function getMessagesByLocale(locale: Locale) {
  return BTY_SYSTEM_MESSAGES.filter((m) => m.locale === locale);
}
