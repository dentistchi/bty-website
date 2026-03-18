/**
 * Arena 런 **진행/완료/중단** 순수 판별. 저장소 ISO 시각 필드만 가정.
 */

export type ArenaRunLifecyclePhase = "in_progress" | "completed" | "aborted";

/**
 * aborted > completed > in_progress 우선. 시작 없으면 null.
 */
export function arenaRunLifecyclePhase(input: {
  startedAt: string | null | undefined;
  completedAt: string | null | undefined;
  abortedAt: string | null | undefined;
}): ArenaRunLifecyclePhase | null {
  const started =
    typeof input.startedAt === "string" && input.startedAt.trim().length > 0;
  if (!started) return null;
  if (input.abortedAt != null && String(input.abortedAt).trim() !== "") {
    return "aborted";
  }
  if (input.completedAt != null && String(input.completedAt).trim() !== "") {
    return "completed";
  }
  return "in_progress";
}

/** Render-only i18n keys for recent run status (profile / my page). */
export type ArenaRunStateDisplayLabelKey =
  | "arena.run.stateInProgress"
  | "arena.run.stateCompleted"
  | "arena.run.stateAborted";

export function arenaRunStateDisplayLabelKey(
  phase: ArenaRunLifecyclePhase
): ArenaRunStateDisplayLabelKey {
  switch (phase) {
    case "in_progress":
      return "arena.run.stateInProgress";
    case "completed":
      return "arena.run.stateCompleted";
    case "aborted":
      return "arena.run.stateAborted";
    default: {
      const _e: never = phase;
      return _e;
    }
  }
}
