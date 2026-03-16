/**
 * Healing / Awakening — phase·상태 타입·상수.
 * Pure types and constants only. No UI, API, or DB.
 * Ref: docs/specs/healing-coaching-spec-v3.json, docs/ROADMAP_Q3_Q4.md Q4.
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
