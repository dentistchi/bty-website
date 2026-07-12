/**
 * livingResponseValidator (lib) — layered validation for a generated Living Response line.
 *
 * Layer 1 (REUSED UNCHANGED): the Today Mirror text guardrails — scanProhibited (metric/diagnosis/
 * identity/explicit-choice/bare-count denylists), hasMetricPoint, checkReportLike. These are the
 * shared safety floor; they are NOT modified.
 *
 * Layer 2 (NEW, Living-Response-specific): exactly one sentence, bounded length, no question, must
 * semantically relate to the committed relationship, must not merely restate the CTA/benediction,
 * and must pass a novelty threshold against recent Living Responses.
 *
 * Any violation ⇒ the caller settles a deterministic fallback. Never retry with looser validation.
 */
import { scanProhibited } from "@/lib/bty/today-intelligence/todayMirrorPolicy";
import { checkReportLike, hasMetricPoint } from "@/lib/bty/today-intelligence/todayMirrorSemanticFloor";
import { openingPatternOf } from "@/domain/daily/todayMirrorNovelty";
import { isRestatement } from "@/domain/daily/livingResponseGuardPhrases";
import { anchorMatcher } from "@/domain/daily/livingResponseConcepts";
import type { LivingResponseRelationship } from "@/domain/daily/livingResponse";

export const LIVING_RESPONSE_POLICY_VERSION = "lrpol_v2";
const MAX_LEN = 160;

// Generic wellness / meditation / motivational phrase families — a Living Response must never read
// like a wellness app. Reject if ANY family matches (case-insensitive), EN + KO.
const WELLNESS_FAMILIES: RegExp[] = [
  /\bembrace\b/i,
  /\bnurtur\w*/i,
  /\bessence\b/i,
  /\byour (own )?(essence|journey|power|center|truth|light|being)\b/i,
  /\b(inner|true|authentic) (self|strength|peace|child|voice|wisdom)\b/i,
  /\bsteady presence within\b/i,
  /\bconnect(ion)? (with|to) (your|yourself|your own)\b/i,
  /\bhonor (your|yourself)\b/i,
  /\bstep into your\b/i,
  /\btrust the process\b/i,
  /\bbe present\b/i,
  /\bcultivat\w*/i,
  /\ballow yourself\b/i,
  /\bgentle reminder\b/i,
  /\bfind (your )?balance\b/i,
  /\bhold space\b/i,
  /\btoday is an opportunity\b/i,
  /\b(radiate|manifest|abundance|serenity|bliss|wholeness)\b/i,
  /명상|내면의 (빛|힘|평화)|우주의|당신의 본질|온전한 자아|균형을 찾/i,
];

// Instruction / imperative language — a Living Response observes; it never prescribes.
const INSTRUCTION = /\b(remember to|make sure|be sure to|try to|you should|you must|don'?t forget|take a moment to)\b|하세요|하십시오|해야 합니다|기억하세요|잊지 마/i;

// Raw machine code accidentally surfaced (e.g. SELF_RETURN_STRONG, OTHERS_RELATIONAL).
const MACHINE_CODE = /\b[A-Z]{2,}_[A-Z_]{2,}\b/;

// LR-specific count expressions the shared Today Mirror validator does not cover: English number
// WORDS + a count noun, and Korean 수사/count expressions. (Arabic-digit counts are already caught by
// scanProhibited's BARE_COUNT.) Narrow to counting contexts to avoid incidental-number false positives.
const EN_COUNT =
  /\b(\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|couple|several|few|dozen)\s+(times?|days?|mornings?|weeks?|nights?|occasions?|returns?|visits?)\b/i;
const KO_COUNT = /(몇\s*번|며칠|(한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)\s*(번|차례|일|날)|[0-9]+\s*(번|차례|회))/;

export type LivingResponseViolation =
  | "PROHIBITED" // scanProhibited hit (metric/diagnosis/identity/explicit-choice/bare-count)
  | "METRIC_POINT"
  | "COUNT_EXPRESSION"
  | "REPORT_LIKE"
  | "NOT_ONE_SENTENCE"
  | "TOO_LONG"
  | "EMPTY"
  | "QUESTION"
  | "RELATIONSHIP_IRRELEVANT"
  | "RESTATES_GUARD"
  | "NOVELTY_REPEAT"
  | "GENERIC_WELLNESS"
  | "INSTRUCTION"
  | "MACHINE_CODE"
  | "ANCHOR_MISSING";

const norm = (s: string) => s.toLowerCase().replace(/[\s.,!?—-]+/g, " ").trim();

// Loose relationship anchors (EN + KO). The line must gesture at the committed relationship's frame,
// not name a person. Absence of any anchor ⇒ irrelevant (→ fallback), never a looser pass.
const RELATIONSHIP_ANCHORS: Record<LivingResponseRelationship, RegExp> = {
  self: /\b(you|your|yourself|inner|quiet|stead|return|carry|own)\b|자신|나|스스로|돌아|안|조용/i,
  others: /\b(someone|people|around you|beside|there for|presence|steadi|show up)\b|누군가|곁|사람|함께|옆/i,
  world: /\b(work|forward|matters|real|thing|move|carry|responsib)\b|일|앞으로|중요|현실|옮/i,
};

export type ValidateLivingResponseInput = {
  relationship: LivingResponseRelationship;
  /** The canonical CTA/benediction phrases (from guardPhrasesFor) this line must not restate. */
  guardPhrases: string[];
  /** Safe evidence concept anchors from the packet — the line must surface at least one naturally. */
  concepts: string[];
  recentTexts: string[];
};

export function validateLivingResponse(
  text: string,
  input: ValidateLivingResponseInput,
): { ok: boolean; violations: LivingResponseViolation[] } {
  const v: LivingResponseViolation[] = [];
  const t = (text ?? "").trim();

  if (t.length === 0) v.push("EMPTY");
  if (t.length > MAX_LEN) v.push("TOO_LONG");
  if (/\?|？/.test(t)) v.push("QUESTION");

  // Exactly one sentence: at most one terminal mark, and no interior sentence break.
  const terminals = (t.match(/[.!。][^\S\n]/g) || []).length; // an interior ". " style break
  const trailingTerminals = (t.match(/[.!?。？]/g) || []).length;
  if (terminals >= 1 || trailingTerminals > 1) v.push("NOT_ONE_SENTENCE");

  // Layer 1 — reused unchanged (metric/diagnosis/identity/explicit-choice/bare Arabic count).
  if (scanProhibited(t).length > 0) v.push("PROHIBITED");
  if (hasMetricPoint(t)) v.push("METRIC_POINT");
  if (checkReportLike(t)) v.push("REPORT_LIKE");

  // Layer 2 — LR-specific count words (EN number-words / KO 수사) beyond BARE_COUNT.
  if (EN_COUNT.test(t) || KO_COUNT.test(t)) v.push("COUNT_EXPRESSION");

  // Generic wellness / motivational / instruction language — a Living Response is observant, not
  // therapeutic or prescriptive.
  if (WELLNESS_FAMILIES.some((r) => r.test(t))) v.push("GENERIC_WELLNESS");
  if (INSTRUCTION.test(t)) v.push("INSTRUCTION");
  if (MACHINE_CODE.test(t)) v.push("MACHINE_CODE");

  // Evidence anchor — the line must surface at least one concept the packet actually supports.
  const hasAnchor = anchorMatcher(input.concepts)(t);
  if (input.concepts.length > 0 && !hasAnchor) v.push("ANCHOR_MISSING");

  // Relevance — satisfied by an explicit relationship anchor OR a packet-derived concept anchor (an
  // evidence concept IS relationship-derived, so evidence-grounded lines needn't restate the label).
  if (!RELATIONSHIP_ANCHORS[input.relationship].test(t) && !hasAnchor) v.push("RELATIONSHIP_IRRELEVANT");

  // Must not restate the canonical CTA/benediction (exact + near-restatement).
  if (isRestatement(t, input.guardPhrases)) v.push("RESTATES_GUARD");

  // Novelty — exact repeat or shared opening pattern against recent Living Responses.
  const nt = norm(t);
  const opening = norm(openingPatternOf(t));
  const repeated = input.recentTexts.some((r) => {
    const nr = norm(r);
    return nr === nt || (opening.length > 0 && norm(openingPatternOf(r)) === opening);
  });
  if (repeated) v.push("NOVELTY_REPEAT");

  return { ok: v.length === 0, violations: v };
}
