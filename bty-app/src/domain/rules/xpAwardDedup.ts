/**
 * XP 지급 **중복 방지** — 멱등 키 순수 규칙. 저장소·API가 집합/유니크에 사용.
 */

export function xpAwardEventDedupKey(
  userId: string,
  source: string,
  uniqueEventId: string
): string {
  const u = String(userId ?? "").trim();
  const s = String(source ?? "").trim();
  const id = String(uniqueEventId ?? "").trim();
  return `${u}|${s}|${id}`;
}

export function isXpAwardDuplicateEvent(
  dedupKey: string,
  alreadyAppliedKeys: ReadonlySet<string>
): boolean {
  const k = dedupKey.trim();
  if (!k) return false;
  return alreadyAppliedKeys.has(k);
}
