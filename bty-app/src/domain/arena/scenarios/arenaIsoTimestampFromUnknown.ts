/**
 * Arena 저장소 ISO-8601 시각 문자열 — 순수 정규화. `started_at`·`completed_at` 등 검증용.
 * XP·랭킹·시즌 무관.
 */

export const ARENA_ISO_TIMESTAMP_MAX_LENGTH = 64;

export function arenaIsoTimestampFromUnknown(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.length > ARENA_ISO_TIMESTAMP_MAX_LENGTH) return null;
  if (Number.isNaN(Date.parse(s))) return null;
  return s;
}
