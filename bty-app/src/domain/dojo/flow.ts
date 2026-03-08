/**
 * Dojo / Dear Me — 진입·제출·결과 비즈니스 규칙만 (순수 함수).
 * 단일 참조: docs/DOJO_DEAR_ME_NEXT_CONTENT.md §7.
 * API·UI는 이 도메인 호출 결과만 사용.
 */

/** Dojo 50문항 5영역 (목차 수준). */
export const DOJO_50_AREAS = [
  "perspective_taking",   // 역지사지
  "communication",       // 소통·경청
  "leadership",           // 리더십·책임
  "conflict",            // 갈등·협상
  "teamwork",            // 팀·협업
] as const;

export type Dojo50AreaId = (typeof DOJO_50_AREAS)[number];

/** 문항당 1~5 리커트. answers: questionId(1..50) -> 1..5 */
export type Dojo50Answers = Record<number, number>;

export type Dojo50Result = {
  scores: Record<Dojo50AreaId, number>;
  summaryKey: string;
};

/** 진입: Dojo/역지사지 진입 가능 여부. (현재: 인증만) */
export function canEnterDojo(isAuthenticated: boolean): boolean {
  return isAuthenticated;
}

/** 50문항 제출 검증: 50개 응답, 각 1~5. */
export function validateDojo50Submit(answers: Dojo50Answers): { ok: boolean; error?: string } {
  const ids = Object.keys(answers).map(Number);
  if (ids.length !== 50) return { ok: false, error: "answers_count" };
  for (let q = 1; q <= 50; q++) {
    const v = answers[q];
    if (typeof v !== "number" || v < 1 || v > 5) return { ok: false, error: "invalid_range" };
  }
  return { ok: true };
}

/** 50문항 결과: 5영역별 10문항 합 → 0~100 스케일. (문항 ID 1–10=역지사지, 11–20=소통, …) */
export function computeDojo50Result(answers: Dojo50Answers): Dojo50Result {
  const areaSize = 10;
  const scores: Record<Dojo50AreaId, number> = {
    perspective_taking: 0,
    communication: 0,
    leadership: 0,
    conflict: 0,
    teamwork: 0,
  };
  for (let i = 0; i < DOJO_50_AREAS.length; i++) {
    let sum = 0;
    for (let j = 1; j <= areaSize; j++) {
      const qId = i * areaSize + j;
      const v = answers[qId];
      sum += typeof v === "number" && v >= 1 && v <= 5 ? v : 0;
    }
    // 10문항×1~5 = 10~50 → 0~100
    scores[DOJO_50_AREAS[i]] = Math.round(((Math.min(50, Math.max(10, sum)) - 10) / 40) * 100);
  }
  const avg = Object.values(scores).reduce((a, b) => a + b, 0) / 5;
  const summaryKey = avg >= 70 ? "high" : avg >= 50 ? "mid" : "low";
  return { scores, summaryKey };
}

/** 역지사지 제출: 시나리오 입력(텍스트 또는 선택 ID) 필수. */
export function validateIntegritySubmit(payload: {
  text?: string | null;
  choiceId?: string | null;
}): { ok: boolean; error?: string } {
  const hasText = typeof payload.text === "string" && payload.text.trim().length > 0;
  const hasChoice = typeof payload.choiceId === "string" && payload.choiceId.length > 0;
  if (hasText || hasChoice) return { ok: true };
  return { ok: false, error: "missing_input" };
}
