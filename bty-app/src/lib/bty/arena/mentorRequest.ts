/**
 * Elite 1:1 mentor session request — domain rules only (PHASE_4_ELITE_5_PERCENT_SPEC §10 3차, PROJECT_BACKLOG §5).
 * 신청 권한·페이로드 검증. 승인/거절 전이는 `src/domain/rules/eliteMentorRequest` 단일 소스.
 */

import {
  canEliteMentorAdminTransition,
  ELITE_MENTOR_QUEUE_STATUSES,
  type EliteMentorQueueStatus,
} from "@/domain/rules/eliteMentorRequest";

export const MENTOR_REQUEST_STATUSES = ELITE_MENTOR_QUEUE_STATUSES;
export type MentorRequestStatus = EliteMentorQueueStatus;

export const DEFAULT_MENTOR_ID = "dr_chi";

/** 최대 메시지 길이(자) */
export const MENTOR_REQUEST_MESSAGE_MAX_LENGTH = 500;

/**
 * Elite만 신청 가능. 이미 pending이 있으면 중복 신청 불가.
 */
export function canRequestMentorSession(
  isElite: boolean,
  existingStatus: MentorRequestStatus | null
): boolean {
  if (!isElite) return false;
  if (existingStatus === "pending") return false;
  return true;
}

/**
 * 요청 페이로드 검증. message는 선택, 길이 제한만.
 */
export function validateMentorRequestPayload(message: string | undefined | null): {
  valid: boolean;
  error?: string;
} {
  if (message == null || message === "") return { valid: true };
  const t = String(message).trim();
  if (t.length > MENTOR_REQUEST_MESSAGE_MAX_LENGTH) {
    return { valid: false, error: "message_too_long" };
  }
  return { valid: true };
}

/**
 * 상태 전이: pending → approved | rejected 만 허용.
 */
export function canTransitionStatus(
  current: MentorRequestStatus,
  next: MentorRequestStatus
): boolean {
  return canEliteMentorAdminTransition(current, next);
}
