/**
 * Arena 런 완료 — 동일 runId **중복 완료** 도메인 판별 (순수).
 * 저장소/API가 유지하는 완료 집합·멱등 키만 인자로 받음.
 */

/** 이미 완료 처리된 runId면 true (재요청 = 중복/멱등 noop). */
export function isDuplicateArenaRunCompletion(
  runId: string,
  completedRunIds: ReadonlySet<string>
): boolean {
  const id = String(runId ?? "").trim();
  if (!id) return false;
  return completedRunIds.has(id);
}

/** 클라이언트 멱등 키 재전송 시 중복 적용으로 간주. */
export function isArenaRunCompleteIdempotencyReplay(
  idempotencyKey: string | null | undefined,
  lastAppliedKey: string | null | undefined
): boolean {
  const k = idempotencyKey?.trim();
  if (!k) return false;
  return lastAppliedKey != null && k === String(lastAppliedKey).trim();
}
