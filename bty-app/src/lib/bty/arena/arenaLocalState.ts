/**
 * 로컬 저장 Arena 세션 (useArenaSession과 동일 키). 허브 이어하기 문구만 판별 — 서버/도메인 XP 로직 없음.
 */
export const BTY_ARENA_STATE_STORAGE_KEY = "btyArenaState:v1";

type Persisted = {
  version?: number;
  scenarioId?: string;
  phase?: string;
};

/** 브라우저에서만. 진행 중 시뮬(CHOOSING·SHOW_RESULT·FOLLOW_UP)이면 true. */
export function isResumableArenaLocalSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(BTY_ARENA_STATE_STORAGE_KEY);
    if (!raw) return false;
    const p = JSON.parse(raw) as Persisted;
    if (p?.version !== 1 || !p?.scenarioId) return false;
    return p.phase !== "DONE";
  } catch {
    return false;
  }
}
