/**
 * BTY Today AI Mirror — deterministic output validators (service layer, shadow-only).
 *
 * The LLM safety prompt is NOT trusted as proof of safety. Every generated response is
 * gated here by deterministic rules before it could ever be considered for display.
 * This module holds validation POLICY (denylists) — not display strings — so it lives in
 * the service layer, keeping src/domain pure.
 *
 * A response is rejected (→ fail quiet, no fabricated fallback) on ANY violation.
 */
import type {
  RecentTodayMirrorContext,
  TodayMirrorAnalysis,
  TodayMirrorEvidencePacket,
  TodayMirrorResponse,
} from "@/domain/daily/todayMirror.types";
import { checkNovelty } from "@/domain/daily/todayMirrorNovelty";
import {
  deriveClaimPermissions,
  checkRelationshipQuality,
  checkInternalState,
  checkReportLike,
  hasMetricPoint,
  checkNumericProvenance,
} from "@/lib/bty/today-intelligence/todayMirrorSemanticFloor";

/**
 * Hidden metrics / progression internals that must never surface in Mirror text.
 * NOTE: ordinary "point" (entry/starting/one unresolved point) is intentionally NOT here —
 * metric "points" are handled context-sensitively by hasMetricPoint().
 */
const HIDDEN_METRIC = [
  /\b(air|lri|xp|rank|ranking|score|streak|penalt|tier|leaderboard)s?\b/i,
  /(점수|순위|등급|랭킹|페널티|벌점|연속\s*기록|스트릭|포인트|리더보드)/,
];

/** Identity / motive labels — BTY never tells a user who they are. */
const IDENTITY_MOTIVE = [
  /\b(dishonest|coward(ly)?|avoidant|toxic|broken|selfish|weak|lazy|manipulative)\b/i,
  /(정직하지\s*않|비겁|회피적|독성|망가진|이기적|약한\s*사람|게으르|조종)/,
];

/** Clinical inference the Mirror must not make. */
const DIAGNOSIS_TRAUMA = [
  /\b(depress(ion|ed)|anxiety disorder|trauma(tic|tized)?|addict(ion|ed)|abuse|abusive|ptsd)\b/i,
  /(우울증|불안장애|트라우마|중독|학대)/,
];

/** Self-harm directive content — never generate. */
const SELF_HARM = [/\b(self-harm|hurt yourself|end (it|your life)|suicid)/i, /(자해|자살)/];

/** Generic, could-be-sent-to-1000-users phrases (Commander §12). */
const GENERIC = [
  /keep going/i,
  /small steps matter/i,
  /you'?ve got this/i,
  /trust the process/i,
  /today is a new beginning/i,
  /you are stronger than you think/i,
  /\bbe courageous\b/i,
  /계속\s*나아가세요/,
  /작은\s*걸음이\s*중요/,
  /당신은\s*충분히\s*강/,
  /오늘은\s*새로운\s*시작/,
  /당신은\s*강합니다/,
];

/** Explicit relationship-CHOICE claims — forbidden because relationship is only DERIVED. */
const EXPLICIT_CHOICE = [
  /\b(chose|selected|picked)\b[^.]*\b(self|others|world)\b/i,
  /\b(self|others|world)\b[^.]*\b(chose|selected|picked)\b/i,
  /(self|others|world|자신|타인|세계|관계)[^.]*(를|을)?\s*(선택했|골랐|택했)/,
];

/** Any standalone count 2–99 in an OBSERVATION is unverifiable → forbidden ("no unsupported count"). */
const BARE_COUNT = /(?<![.\d])\b([2-9]|[1-9]\d)\b(?!\s*(am|pm|시|:|분|초|월|일))/;

const CATEGORIES: Array<{ code: string; patterns: RegExp[] }> = [
  { code: "HIDDEN_METRIC", patterns: HIDDEN_METRIC },
  { code: "IDENTITY_MOTIVE", patterns: IDENTITY_MOTIVE },
  { code: "DIAGNOSIS_TRAUMA", patterns: DIAGNOSIS_TRAUMA },
  { code: "SELF_HARM", patterns: SELF_HARM },
  { code: "GENERIC", patterns: GENERIC },
  { code: "EXPLICIT_CHOICE", patterns: EXPLICIT_CHOICE },
];

function scanText(text: string): string[] {
  const hits: string[] = [];
  for (const { code, patterns } of CATEGORIES) {
    if (patterns.some((p) => p.test(text))) hits.push(code);
  }
  return hits;
}

function sentenceCount(text: string): number {
  return text
    .split(/[.!?。！？\n]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

function validEvidenceIds(packet: TodayMirrorEvidencePacket): Set<string> {
  const ids = new Set<string>();
  for (const f of packet.confirmedFacts) ids.add(f.id);
  for (const s of packet.derivedSignals) for (const id of s.supportingEvidenceIds) ids.add(id);
  // The open contract itself is admissible provenance for the open_contract_gravity lens.
  if (packet.openContract) ids.add(`contract:${packet.openContract.id}`);
  return ids;
}

export type MirrorValidationResult = { ok: boolean; violations: string[] };

/**
 * Deterministically validate a candidate response. Returns ok:false with violation codes
 * on any breach; the caller must then fail quiet (no fabricated fallback).
 */
export function validateMirrorResponse(
  response: TodayMirrorResponse,
  packet: TodayMirrorEvidencePacket,
  analysis: TodayMirrorAnalysis,
  recent: RecentTodayMirrorContext,
): MirrorValidationResult {
  const v: string[] = [];
  const permissions = deriveClaimPermissions(analysis);
  const stepText = response.suggestedStep?.text ?? "";
  const stepObs = response.suggestedStep?.observableCompletion ?? "";
  const note = response.uncertaintyNote ?? "";
  const observationText = `${response.mirror} ${response.perspective}`;
  const allText = `${observationText} ${stepText} ${note}`;

  // Clause-level user-facing fields (semantic floor applies to each).
  const fields: Array<[string, string]> = [
    ["mirror", response.mirror],
    ["perspective", response.perspective],
    ["step", stepText],
    ["observable", stepObs],
    ["note", note],
  ];

  // 1) Prohibited content anywhere (generic/identity/diagnosis/self-harm/explicit-choice/hidden-metric).
  for (const code of scanText(allText)) v.push(`PROHIBITED_${code}`);
  if (hasMetricPoint(allText)) v.push("PROHIBITED_HIDDEN_METRIC");

  // 1b) Semantic floor — relationship-quality, internal-state, report-like — per field.
  const relConcentration = analysis.selectedLens === "relationship_concentration";
  for (const [field, text] of fields) {
    if (!text.trim()) continue;
    const rq = checkRelationshipQuality(text, permissions, relConcentration);
    if (rq) v.push(`${rq}:${field}`);
    const is = checkInternalState(text, permissions);
    if (is) v.push(`${is}:${field}`);
    const rl = checkReportLike(text);
    if (rl) v.push(`${rl}:${field}`);
  }

  // 2) Provenance-aware numeric counts in observations + note (blanket only when unproven).
  const numViolation = checkNumericProvenance(`${observationText} ${note}`, permissions, response.evidenceIds);
  if (numViolation) v.push(numViolation);

  // 3) Lens integrity.
  if (response.lens !== analysis.selectedLens) v.push("LENS_MISMATCH");

  // 4) Evidence-id provenance.
  const valid = validEvidenceIds(packet);
  for (const id of response.evidenceIds) if (!valid.has(id)) v.push(`EVIDENCE_ID_UNKNOWN:${id}`);
  if (analysis.selectedLens !== "insufficient_evidence" && response.evidenceIds.length === 0) {
    v.push("EVIDENCE_ID_MISSING");
  }

  // 5) Open-contract duplication invariant → step MUST be null.
  if (analysis.mustAvoidContractDuplication && response.suggestedStep !== null) {
    v.push("OPEN_CONTRACT_DUPLICATION");
  }

  // 6) Suggested step must be observable when present.
  if (response.suggestedStep && !response.suggestedStep.observableCompletion.trim()) {
    v.push("STEP_NOT_OBSERVABLE");
  }

  // 7) Low/none confidence must carry restraint (uncertainty note).
  if (
    (analysis.confidence === "low" || analysis.confidence === "none") &&
    !response.uncertaintyNote?.trim()
  ) {
    v.push("MISSING_UNCERTAINTY_NOTE");
  }

  // 8) Brevity — Today is quiet.
  if (sentenceCount(response.mirror) > 2) v.push("MIRROR_TOO_LONG");
  if (sentenceCount(response.perspective) > 2) v.push("PERSPECTIVE_TOO_LONG");

  // 9) Insufficient-evidence lens must NOT assert an interpretation or action.
  if (analysis.selectedLens === "insufficient_evidence" && response.suggestedStep) {
    v.push("RESTRAINT_VIOLATED");
  }

  // 10) Novelty.
  for (const nv of checkNovelty(response, recent)) v.push(`NOVELTY_${nv}`);

  return { ok: v.length === 0, violations: v };
}

/** Exposed for tests: raw prohibited-content scan on arbitrary text. */
export function scanProhibited(text: string): string[] {
  const hits = scanText(text);
  if (BARE_COUNT.test(text)) hits.push("BARE_COUNT");
  return hits;
}
