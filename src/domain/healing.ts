/**
 * Healing / Awakening — phase·상태 타입·상수.
 * Pure types and constants only. No UI, API, or DB.
 * Ref: docs/specs/healing-coaching-spec-v3.json, docs/ROADMAP_Q3_Q4.md Q4.
 * Phase 전이·Awakening 액트(1–3)는 Dojo 50(`dojo/flow`: 50문항·summaryKey high/mid/low)과 **별도 네임스페이스**.
 * Phase 전이 경계는 API/서비스; 도메인은 라벨·트리거 상수만.
 * @see dojo/flow — Dojo 50문항·summaryKey; 액트 진행과 혼동 금지.
 */

/** Healing 공개 신호용 phase 라벨. */
export type HealingPhaseLabel = "Phase I" | "Phase II";

/** Phase II 공개 표시 타입 (수치 없음). */
export const HEALING_PHASE_RING_TYPE = "phase_ring" as const;

/** Second Awakening 액트 번호 (1=Reflection Chamber, 2=Transition, 3=Awakening). */
export type AwakeningActId = 1 | 2 | 3;

/** Awakening 액트 이름 상수. */
export const AWAKENING_ACT_NAMES: Readonly<Record<AwakeningActId, string>> = {
  1: "Reflection Chamber",
  2: "Transition",
  3: "Awakening",
} as const;

/** Phase I·II 공개 라벨 (스펙·콘텐츠 연동용). */
export const HEALING_PHASE_I_LABEL: HealingPhaseLabel = "Phase I";
export const HEALING_PHASE_II_LABEL: HealingPhaseLabel = "Phase II";

/** Second Awakening 트리거 (day-based). 콘텐츠 연동·API 응답용. */
export interface AwakeningTriggerDayBased {
  type: "day_based";
  day: number;
  requires_min_sessions: number;
}

/** 스펙 기본값: 30일, 최소 10세션. */
export const AWAKENING_TRIGGER_DAY = 30 as const;
export const AWAKENING_TRIGGER_MIN_SESSIONS = 10 as const;

/** 액트별 콘텐츠 블록 — API·콘텐츠 연동용. */
export interface AwakeningActContent {
  actId: AwakeningActId;
  contentBlocks: readonly string[];
}

/**
 * Q4 Healing 경로 가드: Second Awakening 액트 ID만 허용. Dojo 50·다른 플로우와 혼선 방지.
 */
export function isValidHealingAwakeningActId(n: unknown): n is AwakeningActId {
  return n === 1 || n === 2 || n === 3;
}

/**
 * 다음 액트(1→2→3); 전부 완료 시 null. 1→2→3 순서 위반(건너뜀) 시 null.
 */
export function nextHealingAwakeningActAfter(
  completedActs: readonly AwakeningActId[]
): AwakeningActId | null {
  const set = new Set(completedActs);
  if (set.has(1) && set.has(2) && set.has(3)) return null;
  if (set.size === 0) return 1;
  if (set.has(1) && !set.has(2) && set.size === 1) return 2;
  if (set.has(1) && set.has(2) && !set.has(3) && set.size === 2) return 3;
  return null;
}

/**
 * Healing 선형 액트 경로의 **대칭 가드**: actId 완료 허용 여부(이미 완료 제외, 선행 액트 필수).
 * `nextHealingAwakeningActAfter`와 짝 — 완료 시점 검증용.
 */
export function canCompleteHealingAwakeningAct(
  actId: AwakeningActId,
  alreadyCompleted: readonly AwakeningActId[]
): boolean {
  const s = new Set(alreadyCompleted);
  if (s.has(actId)) return false;
  if (actId === 1) return true;
  if (actId === 2) return s.has(1);
  if (actId === 3) return s.has(1) && s.has(2);
  return false;
}

/**
 * 완료 이력이 **순서 1→2→3·중복 없음**을 만족하는지(부분 완료 허용).
 * API/UI는 제출 전·후 이 규칙으로 자격 검증.
 */
export function isHealingAwakeningCompletionHistoryValid(
  completedInOrder: readonly AwakeningActId[]
): boolean {
  const expected: readonly AwakeningActId[] = [1, 2, 3];
  if (completedInOrder.length > 3) return false;
  const seen = new Set<AwakeningActId>();
  for (const a of completedInOrder) {
    if (!isValidHealingAwakeningActId(a)) return false;
    if (seen.has(a)) return false;
    seen.add(a);
  }
  for (let i = 0; i < completedInOrder.length; i++) {
    if (completedInOrder[i] !== expected[i]) return false;
  }
  return true;
}

export type HealingAwakeningUnlockAfterComplete =
  | AwakeningActId
  | "all_done";

/**
 * 액트 완료 직후 **다음에 잠금 해제되는** 액트(또는 전체 완료).
 * 완료 불가 시점이면 null.
 */
export function healingAwakeningNextUnlockedAfterCompleting(
  completedActId: AwakeningActId,
  completedBefore: readonly AwakeningActId[]
): HealingAwakeningUnlockAfterComplete | null {
  if (!canCompleteHealingAwakeningAct(completedActId, completedBefore)) {
    return null;
  }
  const merged = [...completedBefore, completedActId];
  const n = nextHealingAwakeningActAfter(merged);
  if (n === null) return "all_done";
  return n;
}

/** Second Awakening 3액트 모두 완료 여부(순서 무관·집합 기준). */
export function isHealingAwakeningAllActsComplete(
  completed: readonly AwakeningActId[]
): boolean {
  const s = new Set(completed);
  return s.has(1) && s.has(2) && s.has(3);
}

/** 3액트 모두 완료 시 축하·다음 단계 안내용 i18n 키(표시만). */
export function healingAwakeningCompletionCelebrationMessageKey(): "healing_awakening_all_complete_next_steps" {
  return "healing_awakening_all_complete_next_steps";
}

const AWAKENING_ACT_TOTAL = 3 as const;

/** 액트 진행률 바 표시 퍼센트 경계 (0–100). API/UI clamp 단일 소스. */
export const HEALING_AWAKENING_PROGRESS_PERCENT_MIN = 0 as const;
export const HEALING_AWAKENING_PROGRESS_PERCENT_MAX = 100 as const;

/** Clamps raw percent for progress bar / aria-valuenow (render-only consumer). */
export function clampHealingAwakeningActProgressDisplayPercent(raw: number): number {
  const n = Number.isFinite(raw) ? Math.round(raw) : HEALING_AWAKENING_PROGRESS_PERCENT_MIN;
  return Math.max(
    HEALING_AWAKENING_PROGRESS_PERCENT_MIN,
    Math.min(HEALING_AWAKENING_PROGRESS_PERCENT_MAX, n)
  );
}

/** Second Awakening 진행률 표시 0–100 (완료 액트 수 / 3). */
export function healingAwakeningProgressPercent(
  completed: readonly AwakeningActId[]
): number {
  let n = 0;
  const s = new Set<AwakeningActId>();
  for (const a of completed) {
    if (!isValidHealingAwakeningActId(a) || s.has(a)) continue;
    s.add(a);
    n += 1;
  }
  return Math.min(100, Math.round((n / AWAKENING_ACT_TOTAL) * 100));
}

/**
 * GET 진행률 vs POST 완료 주장 불일치 시 클라 메시지 키(순수).
 * 동일하면 null.
 */
export function healingProgressGetPostMismatchMessageKey(input: {
  getProgressPercent: number;
  postClaimedPercent: number;
}): "healing_sync_mismatch_server_ahead" | "healing_sync_mismatch_client_ahead" | null {
  const g = Math.max(0, Math.min(100, Math.round(input.getProgressPercent)));
  const p = Math.max(0, Math.min(100, Math.round(input.postClaimedPercent)));
  if (g === p) return null;
  return p > g ? "healing_sync_mismatch_client_ahead" : "healing_sync_mismatch_server_ahead";
}

/** 진행 불가 — 쿨다운·요청 간격 등(사용자 메시지, render-only). API blocked 사유와 매핑. */
export const HEALING_PROGRESS_BLOCKED_COOLDOWN_DISPLAY_KEY =
  "healing.progress_blocked_cooldown" as const;
/** 진행 불가 — 단계·페이즈 미충족(251). */
export const HEALING_PROGRESS_BLOCKED_PHASE_DISPLAY_KEY =
  "healing.progress_blocked_phase" as const;

/**
 * Second Awakening 자격(서버 집계 필드 가정). 스펙: Phase II·일수·세션·미완료.
 */
export function isSecondAwakeningEligible(input: {
  phaseTwoUnlocked: boolean;
  daysSinceEnrollment: number;
  sessionCount: number;
  allAwakeningActsComplete: boolean;
}): boolean {
  if (input.allAwakeningActsComplete) return false;
  if (!input.phaseTwoUnlocked) return false;
  return (
    input.daysSinceEnrollment >= AWAKENING_TRIGGER_DAY &&
    input.sessionCount >= AWAKENING_TRIGGER_MIN_SESSIONS
  );
}

/** 액트 스킵·순서 위반 시 메시지 키(스킵 불가 = 선행 미완료). */
export function healingAwakeningActBlockedMessageKey(
  attemptedAct: AwakeningActId,
  completedBefore: readonly AwakeningActId[]
): "healing_awakening_act_already_complete" | "healing_awakening_act_order_required" | null {
  const s = new Set(completedBefore);
  if (s.has(attemptedAct)) return "healing_awakening_act_already_complete";
  if (canCompleteHealingAwakeningAct(attemptedAct, completedBefore)) return null;
  return "healing_awakening_act_order_required";
}

/** 액트 잠금 사유 — UI·aria(render-only). 잠금 없으면 null. */
export type HealingAwakeningActLockReasonDisplayKey =
  | "healing_act_lock_prerequisite"
  | "healing_act_lock_already_complete";

export function healingAwakeningActLockReasonDisplayKey(
  attemptedAct: AwakeningActId,
  completedBefore: readonly AwakeningActId[]
): HealingAwakeningActLockReasonDisplayKey | null {
  const b = healingAwakeningActBlockedMessageKey(attemptedAct, completedBefore);
  if (b === "healing_awakening_act_already_complete") {
    return "healing_act_lock_already_complete";
  }
  if (b === "healing_awakening_act_order_required") {
    return "healing_act_lock_prerequisite";
  }
  return null;
}

/** Second Awakening 3액트 완료 시 축하·다음 단계 메시지 키. */
export function secondAwakeningJourneyCompleteMessageKeys(
  completed: readonly AwakeningActId[]
): {
  congrats: "awakening_journey_complete_congrats";
  nextStep: "awakening_journey_complete_next_explore";
} | null {
  if (!isHealingAwakeningAllActsComplete(completed)) return null;
  return {
    congrats: "awakening_journey_complete_congrats",
    nextStep: "awakening_journey_complete_next_explore",
  };
}

/** Healing 일반 경로 — 진행 불가 사유(쿨다운·단계 미충족). API가 사유만 넘기면 UI가 키로 문구 표시(251). */
export type HealingPathProgressBlockedReason = "cooldown_active" | "phase_requirement_not_met";

/** 진행 불가 시 사용자 메시지 i18n 키 — `HEALING_PROGRESS_BLOCKED_*_DISPLAY_KEY` 와 동일 값. */
export function healingPathProgressBlockedUserDisplayKey(
  reason: HealingPathProgressBlockedReason
):
  | typeof HEALING_PROGRESS_BLOCKED_COOLDOWN_DISPLAY_KEY
  | typeof HEALING_PROGRESS_BLOCKED_PHASE_DISPLAY_KEY {
  if (reason === "cooldown_active") return HEALING_PROGRESS_BLOCKED_COOLDOWN_DISPLAY_KEY;
  return HEALING_PROGRESS_BLOCKED_PHASE_DISPLAY_KEY;
}
