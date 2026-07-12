/**
 * livingResponseFallback (domain) — the deterministic, provider-free Living Response.
 *
 * Selected by `relationship + day_key + FALLBACK_VERSION` so the same user/day always resolves to
 * the same line (stable on re-entry) with gentle rotation across days. Each line is ONE short
 * perspective that does not sound personalized, does not diagnose, exposes no counts, does not
 * repeat the CTA/benediction, prescribes nothing, and releases the user back into the day.
 *
 * Pure: no I/O, no Date.now(). World is always fallback in V1; Self/Others fall back here when
 * evidence is insufficient or generation/validation fails.
 */
import type { LivingResponseRelationship } from "@/domain/daily/livingResponse";

export const FALLBACK_VERSION = "lrfb_v1";

/** Curated bounded sets — one calm perspective line per relationship. No counts, no diagnosis. */
const FALLBACK_LINES: Record<LivingResponseRelationship, readonly string[]> = {
  self: [
    "Returning to yourself is quiet work, and it still counts.",
    "The way back to yourself is a little shorter each time you take it.",
    "Some of the steadiest things you carry, no one else will ever see.",
  ],
  others: [
    "Being there for someone rarely feels dramatic while it's happening.",
    "The people around you feel your steadiness more than your words.",
    "Showing up for someone is its own kind of strength today.",
  ],
  world: [
    "Moving one real thing forward is enough to make the day count.",
    "The work that matters is usually quieter than it looks.",
    "You don't have to move everything — just the thing in front of you.",
  ],
};

const FALLBACK_LINES_KO: Record<LivingResponseRelationship, readonly string[]> = {
  self: [
    "나에게 돌아오는 일은 조용하지만, 그래도 분명히 남습니다.",
    "돌아오는 길은 갈 때마다 조금씩 짧아집니다.",
    "가장 단단한 것들은 아무도 보지 못하는 곳에 쌓입니다.",
  ],
  others: [
    "누군가의 곁에 서는 일은 대개 요란하지 않게 지나갑니다.",
    "곁에 있는 사람은 말보다 당신의 차분함을 먼저 느낍니다.",
    "오늘 누군가의 곁에 서는 것, 그 자체가 하나의 힘입니다.",
  ],
  world: [
    "진짜 하나를 앞으로 옮기면, 그것으로 오늘은 충분합니다.",
    "중요한 일은 보통 보이는 것보다 조용합니다.",
    "전부를 옮길 필요는 없습니다 — 눈앞의 그 하나면 됩니다.",
  ],
};

/** Deterministic index from relationship + day_key + version (stable per user/day). */
function pick(relationship: LivingResponseRelationship, dayKey: string, count: number): number {
  const material = `${FALLBACK_VERSION}:${relationship}:${dayKey}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < material.length; i++) {
    h ^= material.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % count;
}

export function selectFallbackLine(
  relationship: LivingResponseRelationship,
  dayKey: string,
  locale: string | null,
): string {
  const table = locale === "ko" ? FALLBACK_LINES_KO : FALLBACK_LINES;
  const lines = table[relationship];
  return lines[pick(relationship, dayKey, lines.length)];
}
