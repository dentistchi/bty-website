/** Announcement evidence is measured in BTY, never a Teams channel read receipt. */
export const TRACKING_MODES = ["acknowledgment", "response"] as const;
export type TrackingMode = (typeof TRACKING_MODES)[number];
export function isTrackingMode(value: unknown): value is TrackingMode {
  return value === "acknowledgment" || value === "response";
}
export type TrackingEvidence = {
  trackingMode: TrackingMode | null;
  openedAt: string | null;
  acknowledgedAt: string | null;
  responseSubmittedAt: string | null;
};
export function trackingComplete(e: TrackingEvidence): boolean {
  return e.trackingMode === "acknowledgment" ? !!e.acknowledgedAt
    : e.trackingMode === "response" ? !!e.responseSubmittedAt : false;
}
export function trackingState(e: TrackingEvidence): "responded" | "acknowledged" | "opened" | "targeted" {
  if (e.responseSubmittedAt) return "responded";
  if (e.acknowledgedAt) return "acknowledged";
  return e.openedAt ? "opened" : "targeted";
}
export function summariseTracking(targeted: number, rows: readonly TrackingEvidence[]) {
  return { targeted, opened: rows.filter(r => r.openedAt).length,
    acknowledged: rows.filter(r => r.acknowledgedAt).length,
    responded: rows.filter(r => r.responseSubmittedAt).length,
    remaining: targeted - rows.filter(trackingComplete).length };
}
export const TRACKING_COPY = {
  en: { title: "Track announcement", acknowledgment: "Acknowledgment required", response: "Response required",
    targeted: "Targeted", opened: "Opened in BTY", acknowledged: "Acknowledged", responded: "Response submitted",
    remaining: "Action still required", noEvidence: "No acknowledgment evidence", open: "Open announcement",
    acknowledge: "I acknowledge", answer: "Your response", submit: "Submit response", source: "Open original Teams message",
    someone: "Recipient", failed: "Couldn't record that. Please try again.", complete: "Completed",
    evidence: "These are actions in BTY, not Teams channel read receipts." },
  ko: { title: "공지 추적", acknowledgment: "확인 필요", response: "응답 필요", targeted: "대상자",
    opened: "BTY에서 열람", acknowledged: "확인 완료", responded: "응답 완료", remaining: "필요한 조치가 남음",
    noEvidence: "확인 증거 없음", open: "공지 열기", acknowledge: "확인했습니다", answer: "답변",
    submit: "답변 제출", source: "원본 Teams 메시지 열기", someone: "수신자", failed: "기록하지 못했습니다. 다시 시도하세요.",
    complete: "완료", evidence: "BTY에서의 행동 기록이며 Teams 채널 읽음 확인이 아닙니다." },
} as const;
