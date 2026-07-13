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
import type { TodayCommitmentFrame, TodayCommitmentPathId, LivingResponseRepetitionMovement } from "@/domain/daily/livingResponseFrame";

export const FALLBACK_VERSION = "lrfb_v3";

/**
 * V2.1 frame-specific Golden floor — ONE conservative line per Commitment Frame. It reflects the
 * frame's MOVEMENT (not history, not contrast, not a paraphrase of the Today Path), is slightly
 * plainer/safer than a provider line, surfaces a movement/destination anchor so it passes the
 * validator, and is deterministic. Preferred over the generic relationship set when a frame is known.
 */
const FRAME_GOLDEN: Record<TodayCommitmentPathId, { en: string; ko: string }> = {
  self_return_honestly: {
    en: "What stays inward begins to take form once it is named honestly.",
    ko: "안에 머물던 것도 정직하게 이름 붙일 때 형태를 얻습니다.",
  },
  others_carry_care: {
    en: "Care takes real shape only when another person can receive it.",
    ko: "마음은 상대가 받을 수 있을 때 비로소 형태를 얻습니다.",
  },
  world_build_stewardship: {
    en: "Stewardship becomes real in the form of what is actually built.",
    ko: "책임은 실제로 짓는 것의 형태로 현실이 됩니다.",
  },
};

// V2.2 repetition Golden floor — ONE conservative line per repetition movement. Expresses RECURRENCE
// ONLY (no improvement/contrast/avoidance/privacy/relational-recipient beyond the frame). Passes the
// V2.2 validator at repetition depth (recurrence marker + frame anchor), replay-stable per movement.
const FRAME_GOLDEN_REPETITION: Record<LivingResponseRepetitionMovement, { en: string; ko: string }> = {
  repeated_inward_return: {
    en: "What has returned inward more than once is being named again today.",
    ko: "여러 번 안으로 돌아온 그 자리를 오늘 다시 이름 붙입니다.",
  },
  repeated_naming: {
    en: "What has been named more than once is being named again today.",
    ko: "여러 번 이름 붙였던 그것을 오늘 다시 이름 붙입니다.",
  },
  repeated_relational_presence: {
    en: "The care carried more than once is reaching another person again today.",
    ko: "여러 번 건넨 마음이 오늘 다시 상대에게 가 닿습니다.",
  },
};

/**
 * The single deterministic Golden fallback line for a Commitment Frame (replay-stable). When a
 * `repetitionMovement` is supplied (repetition depth), returns the recurrence-only repetition Golden;
 * otherwise the commitment-level frame Golden.
 */
export function selectFrameFallbackLine(
  frame: TodayCommitmentFrame,
  locale: string | null,
  repetitionMovement?: LivingResponseRepetitionMovement,
): string {
  const isKo = locale === "ko";
  if (repetitionMovement) {
    const r = FRAME_GOLDEN_REPETITION[repetitionMovement];
    return isKo ? r.ko : r.en;
  }
  const g = FRAME_GOLDEN[frame.pathId];
  return isKo ? g.ko : g.en;
}

// Concept → the evidence-specific fallback family it selects (so a fallback still feels grounded).
const CONCEPT_FAMILY: Record<string, string> = {
  ownership: "ownership",
  accountability: "ownership",
  repair: "repair",
  directness: "directness",
  communication: "directness",
  regard: "directness",
  truth: "truth",
  naming: "truth",
  follow_through: "follow_through",
  change: "follow_through",
  return: "return",
  consistency: "return",
};

// Evidence-specific fallback families — one calm, grounded, observant line per concept. No wellness,
// no instruction, no counts; each surfaces its concept naturally so the fallback never feels inferior.
const FALLBACK_BY_CONCEPT: Record<string, readonly string[]> = {
  ownership: [
    "Responsibility becomes real the moment it enters a conversation.",
    "What you quietly own still has to be said out loud to land.",
  ],
  repair: [
    "Repair begins when what was avoided is finally named.",
    "What was left unaddressed gets lighter the moment it is faced.",
  ],
  directness: [
    "What is said directly is easier for someone else to trust.",
    "A clear word carries further than a careful silence.",
  ],
  truth: [
    "What is named clearly becomes easier to carry honestly.",
    "Naming one thing plainly makes the rest less heavy.",
  ],
  follow_through: [
    "What you return to again becomes something others can rely on.",
    "A change holds once it is carried all the way through.",
  ],
  return: [
    "Returning to yourself starts with one thing named clearly.",
    "The place you return to is quietly becoming solid ground.",
  ],
};

const FALLBACK_BY_CONCEPT_KO: Record<string, readonly string[]> = {
  ownership: [
    "책임은 대화 속으로 들어올 때 비로소 분명해집니다.",
    "조용히 떠안은 것도 결국 말이 되어야 가 닿습니다.",
  ],
  repair: [
    "회복은 미뤄 두었던 것을 마주할 때 시작됩니다.",
    "말하지 못한 것은 마주한 순간부터 가벼워집니다.",
  ],
  directness: [
    "직접 건넨 말이 상대에게는 더 믿을 만하게 남습니다.",
    "분명한 한마디가 조심스러운 침묵보다 멀리 갑니다.",
  ],
  truth: [
    "분명히 이름 붙인 것은 정직하게 지고 가기가 더 쉬워집니다.",
    "한 가지를 또렷이 이름 붙이면 나머지가 한결 가벼워집니다.",
  ],
  follow_through: [
    "계속 돌아오는 그 자리는 천천히 남들이 기댈 곳이 됩니다.",
    "변화는 한 번이 아니라 이어질 때 비로소 자리를 잡습니다.",
  ],
  return: [
    "나에게 돌아오는 일은 한 가지를 분명히 이름 붙이는 데서 시작될 수 있습니다.",
    "꾸준히 돌아오는 그 자리가 조용히 단단해지고 있습니다.",
  ],
};

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

/** Deterministic index from key + day_key + version (stable per user/day). */
function pick(key: string, dayKey: string, count: number): number {
  const material = `${FALLBACK_VERSION}:${key}:${dayKey}`;
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
  concepts: string[] = [],
): string {
  const isKo = locale === "ko";
  // Prefer an evidence-specific family when a packet concept maps to one (grounded, not generic).
  const family = concepts.map((c) => CONCEPT_FAMILY[c]).find(Boolean);
  if (family) {
    const byConcept = isKo ? FALLBACK_BY_CONCEPT_KO : FALLBACK_BY_CONCEPT;
    const lines = byConcept[family];
    if (lines && lines.length > 0) return lines[pick(`${relationship}:${family}`, dayKey, lines.length)];
  }
  // Otherwise the calm per-relationship set (World / insufficient-evidence still feels complete).
  const table = isKo ? FALLBACK_LINES_KO : FALLBACK_LINES;
  const lines = table[relationship];
  return lines[pick(relationship, dayKey, lines.length)];
}
