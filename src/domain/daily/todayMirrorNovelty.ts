/**
 * BTY Today AI Mirror — novelty control (pure domain).
 *
 * A living system cannot reveal its template after five uses. Surprise must come from
 * truth, never randomness. This module derives a stable novelty signature and checks a
 * candidate response against fixture-based recent-output context (no DB table in V0).
 */
import type {
  MirrorLens,
  RecentTodayMirrorContext,
  TodayMirrorResponse,
} from "@/domain/daily/todayMirror.types";

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** First meaningful word of an action step = its "verb" fingerprint (KO/EN tolerant). */
export function actionVerbOf(step: string | null | undefined): string {
  if (!step) return "";
  const first = normalize(step).split(/[\s,.;:]/).filter(Boolean)[0] ?? "";
  return first;
}

/** Opening shape = normalized first clause, capped — catches repeated sentence construction. */
export function openingPatternOf(mirror: string): string {
  const firstClause = normalize(mirror).split(/[.,;!?]/)[0] ?? "";
  return firstClause.slice(0, 24);
}

/** Stable signature = lens + opening shape + action verb. Deterministic, no crypto needed. */
export function noveltySignatureOf(
  lens: MirrorLens,
  mirror: string,
  step: string | null | undefined,
): string {
  return `${lens}|${openingPatternOf(mirror)}|${actionVerbOf(step)}`;
}

export type NoveltyViolation =
  | "REPEAT_SIGNATURE"
  | "REPEAT_LENS_OVERUSE"
  | "REPEAT_OPENING"
  | "REPEAT_ACTION_VERB"
  | "REPEAT_RECOMMENDATION";

/**
 * Detect obvious repetition against recent context. Returns the list of violations
 * (empty ⇒ novel enough). Lens overuse triggers when the same lens already appears
 * twice or more in recent history.
 */
export function checkNovelty(
  response: TodayMirrorResponse,
  recent: RecentTodayMirrorContext,
): NoveltyViolation[] {
  const violations: NoveltyViolation[] = [];
  const sig = response.noveltySignature;
  const opening = openingPatternOf(response.mirror);
  const verb = actionVerbOf(response.suggestedStep?.text);
  const rec = response.suggestedStep ? normalize(response.suggestedStep.text) : "";

  if (recent.recentNoveltySignatures.includes(sig)) violations.push("REPEAT_SIGNATURE");

  const lensCount = recent.recentLenses.filter((l) => l === response.lens).length;
  if (lensCount >= 2) violations.push("REPEAT_LENS_OVERUSE");

  if (opening && recent.recentOpeningPatterns.map(normalize).includes(normalize(opening)))
    violations.push("REPEAT_OPENING");

  if (verb && recent.recentActionVerbs.map(normalize).includes(verb))
    violations.push("REPEAT_ACTION_VERB");

  if (rec && recent.recentRecommendations.map(normalize).includes(rec))
    violations.push("REPEAT_RECOMMENDATION");

  return violations;
}
