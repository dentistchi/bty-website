/**
 * Arena run lifecycle phase — 순수 정규화. in_progress | completed | aborted.
 * API/저장소 문자열 검증·표시용. XP·랭킹·시즌 무관.
 */

export type ArenaRunLifecyclePhase = "in_progress" | "completed" | "aborted";

export function arenaRunLifecyclePhaseFromUnknown(raw: unknown): ArenaRunLifecyclePhase | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase();
  if (t === "in_progress" || t === "completed" || t === "aborted") return t;
  return null;
}
