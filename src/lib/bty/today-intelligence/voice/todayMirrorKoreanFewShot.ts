/**
 * BTY Today AI Mirror — Korean few-shot projection (service layer, shadow-only).
 *
 * Selects a SMALL number of Golden Set examples for the current KO generation (≤1 same-lens,
 * ≤1 same-confidence/boundary, ≤1 relevant negative) and renders them into a compact prompt
 * block. Never injects the whole set. English generation never calls this.
 */
import type { MirrorLens } from "@/domain/daily/todayMirror.types";
import {
  KOREAN_GOLDEN_SET,
  type KoreanGoldenVoiceExample,
} from "@/lib/bty/today-intelligence/voice/todayMirrorKoreanGoldenSet";

export type GoldenSelection = {
  positives: KoreanGoldenVoiceExample[];
  negative: { text: string; reasons: string[] } | null;
};

export function selectGoldenFewShot(
  lens: MirrorLens,
  confidence: "none" | "low" | "medium" | "high",
  relationship: "SELF" | "OTHERS" | "WORLD" | null,
  openPromise: boolean,
): GoldenSelection {
  const sameLens = KOREAN_GOLDEN_SET.filter((e) => e.lens === lens);
  // Relationship-aware: for cross-domain lenses (e.g. return_after_miss) the action object
  // must follow relationship_context, not the lens. Match relationship (null included); only
  // fall back to a same-lens example when it does NOT carry a mismatched relationship object.
  const primary =
    sameLens.find((e) => (e.evidenceShape.relationship ?? null) === relationship) ??
    sameLens.find((e) => e.evidenceShape.relationship == null) ??
    sameLens[0] ??
    null;

  // Secondary shows rhythm variety from a DIFFERENT lens (never a same-lens/other-relationship
  // example, which would re-teach an invented person/task).
  const secondary =
    KOREAN_GOLDEN_SET.find(
      (e) =>
        e.id !== primary?.id &&
        e.lens !== lens &&
        (e.confidence === confidence || e.evidenceShape.openPromise === openPromise),
    ) ?? null;

  const positives: KoreanGoldenVoiceExample[] = [];
  if (primary) positives.push(primary);
  if (secondary && secondary.id !== primary?.id) positives.push(secondary);

  const negative =
    primary?.rejectedAlternatives[0] ??
    KOREAN_GOLDEN_SET.flatMap((e) => e.rejectedAlternatives)[0] ??
    null;

  return { positives, negative };
}

export function renderKoreanGoldenBlock(sel: GoldenSelection): string {
  if (sel.positives.length === 0) return "";
  const good = sel.positives
    .map((e) => {
      const a = e.approved;
      const step = a.suggestedStep ?? "(행동 없음)";
      const note = a.uncertaintyNote ?? "(없음)";
      return `· 좋은 예 [${e.lens}]: 미러="${a.mirror}" / 관점="${a.perspective}" / 행동="${step}" / 한계="${note}"`;
    })
    .join("\n");
  const bad = sel.negative
    ? `· 나쁜 예: "${sel.negative.text}" — 이유: ${sel.negative.reasons.join(", ")}`
    : "";
  return [
    "[참고용 BTY 한국어 예시 — 리듬과 결만 배우고, 증거가 다르므로 문장을 그대로 베끼지 마세요]",
    good,
    bad,
  ]
    .filter(Boolean)
    .join("\n");
}
