/**
 * Elite 멘토 신청 큐 — 승인/거절 **도메인 전용** (API·DB와 분리).
 * PATCH mentor-requests 등은 이 규칙만 호출. UI 버튼 노출도 동일 단일 소스.
 */

export const ELITE_MENTOR_QUEUE_STATUSES = ["pending", "approved", "rejected"] as const;
export type EliteMentorQueueStatus = (typeof ELITE_MENTOR_QUEUE_STATUSES)[number];

/** pending → approved | rejected 만 허용. */
export function canEliteMentorAdminTransition(
  current: EliteMentorQueueStatus,
  target: EliteMentorQueueStatus
): boolean {
  if (current !== "pending") return false;
  return target === "approved" || target === "rejected";
}

/** 멘토(관리자) UI: 승인·거절 가능 여부 — pending일 때만 둘 다 true. */
export function eliteMentorAdminActionEligibility(current: EliteMentorQueueStatus): {
  mayApprove: boolean;
  mayReject: boolean;
} {
  const pending = current === "pending";
  return { mayApprove: pending, mayReject: pending };
}

/** 승인/거절 **결과** 상태: pending에서만 유효; 그 외 null(전이 없음). */
export function applyEliteMentorAdminDecision(
  current: EliteMentorQueueStatus,
  decision: "approve" | "reject"
): EliteMentorQueueStatus | null {
  if (current !== "pending") return null;
  return decision === "approve" ? "approved" : "rejected";
}

export function isEliteMentorQueueTerminal(status: EliteMentorQueueStatus): boolean {
  return status === "approved" || status === "rejected";
}

/** terminal(approved/rejected) 상태용 라벨 키; pending은 null. */
export function eliteMentorRequestTerminalLabelKey(
  status: EliteMentorQueueStatus
): "elite_mentor_terminal_approved" | "elite_mentor_terminal_rejected" | null {
  if (status === "pending") return null;
  return status === "approved"
    ? "elite_mentor_terminal_approved"
    : "elite_mentor_terminal_rejected";
}

/** 멘토 요청 상태 배지·라벨(render-only). pending·approved·rejected 전부 매핑. */
export type EliteMentorRequestStatusDisplayLabelKey =
  | "elite_mentor_status_pending"
  | "elite_mentor_status_approved"
  | "elite_mentor_status_rejected";

export function eliteMentorRequestStatusDisplayLabelKey(
  status: EliteMentorQueueStatus
): EliteMentorRequestStatusDisplayLabelKey {
  switch (status) {
    case "pending":
      return "elite_mentor_status_pending";
    case "approved":
      return "elite_mentor_status_approved";
    case "rejected":
      return "elite_mentor_status_rejected";
    default: {
      const _e: never = status;
      return _e;
    }
  }
}

/** 오래된 pending — UI·알림용 stale 키 (절대 일수). */
export const ELITE_MENTOR_PENDING_STALE_DAYS = 14 as const;

export function isEliteMentorRequestPendingStale(
  status: EliteMentorQueueStatus,
  createdAtMs: number,
  nowMs: number
): boolean {
  if (status !== "pending") return false;
  const maxMs = ELITE_MENTOR_PENDING_STALE_DAYS * 86_400_000;
  return nowMs - createdAtMs > maxMs;
}

export function eliteMentorPendingStaleLabelKey(
  status: EliteMentorQueueStatus,
  createdAtMs: number,
  nowMs: number
): "elite_mentor_pending_stale" | null {
  return isEliteMentorRequestPendingStale(status, createdAtMs, nowMs)
    ? "elite_mentor_pending_stale"
    : null;
}

/** 동시 **승인 유효** 건 상한(도메인 캡). 초과 시 신규 승인 불가. */
export const ELITE_MENTOR_APPROVED_ACTIVE_CAP = 5 as const;

export function isEliteMentorApprovedActiveAtCap(approvedActiveCount: number): boolean {
  const n = Math.max(0, Math.floor(approvedActiveCount));
  return n >= ELITE_MENTOR_APPROVED_ACTIVE_CAP;
}

export function canEliteMentorApproveWithoutCapViolation(
  approvedActiveCount: number
): boolean {
  return !isEliteMentorApprovedActiveAtCap(approvedActiveCount);
}

/** 동일 사용자 **pending 중복 신청** 방지용 클라/API 메시지 키. */
export const ELITE_MENTOR_DUPLICATE_PENDING_KEY =
  "elite_mentor_duplicate_pending" as const;

export function eliteMentorDuplicateApplicationBlockKey(
  existingLatestStatus: EliteMentorQueueStatus | null
): typeof ELITE_MENTOR_DUPLICATE_PENDING_KEY | null {
  return existingLatestStatus === "pending"
    ? ELITE_MENTOR_DUPLICATE_PENDING_KEY
    : null;
}

/** 멘토 미응답 SLA(일) — 임박 경고 키. */
export const ELITE_MENTOR_RESPONSE_SLA_WARNING_DAYS = 7 as const;

export function eliteMentorResponseSlaWarningKey(
  status: EliteMentorQueueStatus,
  createdAtMs: number,
  nowMs: number
): "elite_mentor_sla_response_imminent" | null {
  if (status !== "pending") return null;
  const days = (nowMs - createdAtMs) / 86_400_000;
  if (!Number.isFinite(days) || days < ELITE_MENTOR_RESPONSE_SLA_WARNING_DAYS) {
    return null;
  }
  return "elite_mentor_sla_response_imminent";
}

/** 관리자 대기열: pending 우선 → 동일 시 생성 시각 오름차순 → id. */
export function compareEliteMentorQueueRows(
  a: { status: EliteMentorQueueStatus; createdAtMs: number; id: string },
  b: { status: EliteMentorQueueStatus; createdAtMs: number; id: string }
): number {
  const pri = (s: EliteMentorQueueStatus) => (s === "pending" ? 0 : 1);
  if (pri(a.status) !== pri(b.status)) return pri(a.status) - pri(b.status);
  if (a.createdAtMs !== b.createdAtMs) return a.createdAtMs - b.createdAtMs;
  return a.id.localeCompare(b.id);
}
