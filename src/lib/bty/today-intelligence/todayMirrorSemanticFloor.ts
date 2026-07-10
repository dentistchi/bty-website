/**
 * BTY Today AI Mirror — deterministic semantic floor (service layer, shadow-only).
 *
 * The hard, testable floor beneath the approved voice. NOT an LLM. Rejects unsupported
 * relationship-quality/direction claims, unsupported internal-state/motive claims, and
 * report-like epistemic language — while PASSING factual behavioral contrast and natural
 * honest limits (false-positive discipline). Also fixes the "point"/"points" hidden-metric
 * false positive and enforces provenance-aware numeric claims. Locale- and context-aware.
 */
import type { TodayMirrorAnalysis } from "@/domain/daily/todayMirror.types";

export type ClaimFamily =
  | "BEHAVIOR_OCCURRENCE"
  | "BEHAVIOR_FREQUENCY"
  | "BEHAVIOR_SEQUENCE"
  | "BEHAVIOR_CONTRAST"
  | "HONEST_LIMIT"
  | "BOUNDED_ACTION"
  | "OPEN_PROMISE"
  | "RELATIONSHIP_QUALITY"
  | "RELATIONSHIP_DIRECTION"
  | "INTERNAL_EMOTION"
  | "INTERNAL_DESIRE"
  | "MOTIVE"
  | "SYSTEM_EVIDENCE_REPORT"
  | "HIDDEN_METRIC"
  | "UNSUPPORTED_COUNT";

export type AllowedNumericClaim = { value: number; kind: string; evidenceIds: string[] };

export type TodayMirrorClaimPermissions = {
  allowedClaimFamilies: ClaimFamily[];
  forbiddenClaimFamilies: ClaimFamily[];
  relationshipQualityEvidence: boolean;
  internalStateEvidence: boolean;
  allowedNumericClaims: AllowedNumericClaim[];
};

const ALWAYS_FORBIDDEN: ClaimFamily[] = [
  "RELATIONSHIP_QUALITY",
  "RELATIONSHIP_DIRECTION",
  "INTERNAL_EMOTION",
  "INTERNAL_DESIRE",
  "MOTIVE",
  "SYSTEM_EVIDENCE_REPORT",
  "HIDDEN_METRIC",
  "UNSUPPORTED_COUNT",
];

/**
 * Derive what THIS analysis is permitted to claim. V0: no evidence source proves relationship
 * quality, internal state, or a numeric count, so those permissions are always false/empty.
 * Behavioral contrast is added only for lenses whose evidence is an actual before/after.
 */
export function deriveClaimPermissions(analysis: TodayMirrorAnalysis): TodayMirrorClaimPermissions {
  const allowed: ClaimFamily[] = [
    "BEHAVIOR_OCCURRENCE",
    "BEHAVIOR_FREQUENCY",
    "BEHAVIOR_SEQUENCE",
    "HONEST_LIMIT",
    "BOUNDED_ACTION",
  ];
  if (analysis.selectedLens === "reexposure_change" || analysis.selectedLens === "completion_latency") {
    allowed.push("BEHAVIOR_CONTRAST");
  }
  if (analysis.selectedLens === "open_contract_gravity") allowed.push("OPEN_PROMISE");
  return {
    allowedClaimFamilies: allowed,
    forbiddenClaimFamilies: ALWAYS_FORBIDDEN,
    relationshipQualityEvidence: false,
    internalStateEvidence: false,
    allowedNumericClaims: [], // V0: no numeric provenance produced by existing evidence
  };
}

// ─────────────────────────── normalization + clause split ───────────────────────────

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}
// Sentence-level (NOT connective-level): a quotative limit like "…좋아졌다고 보기에는 이릅니다"
// must stay in one unit so its limit marker is seen with the quality word.
function sentences(text: string): string[] {
  return text.split(/[.!?。！？\n]+/).map((c) => c.trim()).filter(Boolean);
}

// A clause that WITHHOLDS a claim (limit/negation) is not a claim → must PASS.
// Note: Korean "이르다"(too early) conjugates to "이릅니다/이른" — match 이[르릅른], not just "이르".
const LIMIT_MARKER =
  /(보기[에엔][는]?\s*이[르릅른]|보기는?\s*어렵|보기\s*어렵|부르기[에엔][는]?\s*이[르릅른]|단정[^.]*어렵|만으로[^.]*어렵|아직[^.]*(이[르릅른]|어렵)|아니(다|라|에요|ᆸ니다|ㅂ니다)|too early|hard to (say|call|tell)|not (yet )?(enough|clear|a |the )|isn'?t|is not|n't (call|enough))/i;

// ─────────────────────────── relationship quality / direction ───────────────────────

const REL_SUBJECT = /(관계|연결|사이|유대|relationship|connection|bond|rapport)/i;
const REL_QUALITY_PRED = [
  /(강화|강해|깊어|깊이|가까워|좋아|개선|회복|발전|단단|끈끈|돈독|의미\s*있|의미\s*가\s*커|부각|두드러)/,
  /\b(strength(en|ening)|deepen(ing)?|deeper|clos(er|ing)|improv(e|es|ing|ed)|recover(ing|ed)?|stronger|tighter|more meaningful|blossom|flourish)\b/i,
];
const REL_DIRECTION = [
  /(긍정적(인|으로)?\s*(방향|움직임|변화|변하)|좋은\s*(방향|쪽)|나아지고\s*있|나아가고\s*있|더\s*나아지|긍정적으로\s*변)/,
  /\b(positive (direction|movement|change|shift)|moving in a positive|headed (in|for) (a )?(good|positive|better)|for the better|turning a corner|on the mend)\b/i,
];

/**
 * Reject relationship-quality/direction claims unless permission proves such evidence.
 * Context-aware: in relationship_concentration (the relationship IS the subject) a bare quality
 * predicate fires; in other lenses an explicit relationship subject is required, so factual
 * behavioral contrast ("improved the result") passes. Limit clauses ("…too early to call it
 * improved") always pass.
 */
export function checkRelationshipQuality(
  text: string,
  permissions: TodayMirrorClaimPermissions,
  relationshipConcentration = false,
): "UNSUPPORTED_RELATIONSHIP_QUALITY" | null {
  if (permissions.relationshipQualityEvidence) return null;
  for (const clause of sentences(text)) {
    if (LIMIT_MARKER.test(clause)) continue; // withheld claim → fine
    if (REL_DIRECTION.some((p) => p.test(clause))) return "UNSUPPORTED_RELATIONSHIP_QUALITY";
    const qual = REL_QUALITY_PRED.some((p) => p.test(clause));
    if (qual && (relationshipConcentration || REL_SUBJECT.test(clause))) {
      return "UNSUPPORTED_RELATIONSHIP_QUALITY";
    }
  }
  return null;
}

// ─────────────────────────── internal state / motive ────────────────────────────────

const INTERNAL_STATE = [
  /(마음[이은을][^.]{0,10}(쓰|향|기울|가\s*있)|걱정(하|되|스러)|원하(고|는|던|였)|바라(고|는)|중요하게\s*느|연결되고\s*싶|다시\s*연결[^.]*싶|의도(하|적)|피하(고|려|는)[^.]*있|두려워|무서워|불안해하)/,
  /\b(cares? (more|deeply|about)|wants? to (reconnect|connect|be)|feels? (more )?(invested|attached|hurt)|is worried about|intends? to|is avoiding|afraid of|longs? to|desires? to)\b/i,
];

/** Reject unsupported internal-state/motive claims (behavior does not prove feeling). */
export function checkInternalState(
  text: string,
  permissions: TodayMirrorClaimPermissions,
): "UNSUPPORTED_INTERNAL_STATE" | null {
  if (permissions.internalStateEvidence) return null;
  return INTERNAL_STATE.some((p) => p.test(text)) ? "UNSUPPORTED_INTERNAL_STATE" : null;
}

// ─────────────────────────── report-like epistemic language ──────────────────────────

const REPORT_LIKE = [
  // "증거는 (아직) 없습니다 / 보이지 않습니다 / 부족합니다" — allow an intervening adverb (아직/충분한…).
  /증거(가|는|를|도)?[^.]{0,10}(보이지\s*않|안\s*보|부족|없|충분치|불충분)/,
  /(확인되지\s*않|검증되지\s*않|판단할\s*수\s*없|데이터(로|상)|기록상[^.]*나타나지\s*않|지지받고\s*있|시사합니다|관찰됩니다|분석\s*결과|패턴\s*변화\s*여부|검출되)/,
  /\b(insufficient evidence|evidence is (not|n't) (visible|clear)|no evidence (of|that)|has not been (confirmed|validated|verified)|the data (suggests|indicates|shows)|according to the records|the analysis (indicates|shows)|supported by the evidence)\b/i,
];

/** Reject language that exposes internal evaluation machinery (natural limits still PASS). */
export function checkReportLike(text: string): "REPORT_LIKE_EPISTEMIC_LANGUAGE" | null {
  return REPORT_LIKE.some((p) => p.test(text)) ? "REPORT_LIKE_EPISTEMIC_LANGUAGE" : null;
}

// ─────────────────────────── point / points metric fix ──────────────────────────────

/** Ordinary "point" (entry/starting/one unresolved point) passes; only metric "points" reject. */
const METRIC_POINT =
  /\b(\d+\s*points?|points?\s*(score|total|balance)|(earn|earned|lost|lose|losing|gain|gained|total|leaderboard|xp|extra|bonus|reward)\s*points?|point\s*score)\b/i;

export function hasMetricPoint(text: string): boolean {
  return METRIC_POINT.test(text);
}

// ─────────────────────────── provenance-aware numbers ────────────────────────────────

const BARE_NUM = /(?<![.\d])\b([2-9]|[1-9]\d)\b(?!\s*(am|pm|시|:|분|초|월|일|주|개월|년))/g;

/**
 * A bare integer 2–99 passes ONLY when the analysis provides a matching allowedNumericClaim
 * whose evidence ids are all present in the response. Otherwise UNSUPPORTED_COUNT.
 */
export function checkNumericProvenance(
  text: string,
  permissions: TodayMirrorClaimPermissions,
  responseEvidenceIds: string[],
): "UNSUPPORTED_COUNT" | null {
  const nums = text.match(BARE_NUM);
  if (!nums) return null;
  for (const raw of nums) {
    const n = Number(raw);
    const claim = permissions.allowedNumericClaims.find((c) => c.value === n);
    const proven = claim != null && claim.evidenceIds.every((id) => responseEvidenceIds.includes(id));
    if (!proven) return "UNSUPPORTED_COUNT";
  }
  return null;
}

/** Test/introspection helper: normalize a clause (exported for adversarial suite). */
export const _normForTest = norm;
