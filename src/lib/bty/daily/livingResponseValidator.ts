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
import type { LivingResponseProposition } from "@/domain/daily/livingResponseFrame";

// V2.2: adds user-interpretation rejection + repetition grounding. V2.3: adds trajectory grounding
// (commitment-sequence shape) + non-judgment guards. Living Memory V0: adds memory-exposure rejection
// (continuity must be felt, never named). Bumped from lrpol_v6.
export const LIVING_RESPONSE_POLICY_VERSION = "lrpol_v7";

// Living Memory V0 — the response may be SHAPED by yesterday, but must never EXPOSE that it read the
// past. Reject explicit memory/time-reference words. NOTE: "again" is intentionally NOT here — it is
// already context-gated (blocked at commitment depth via HISTORICAL_MARKERS; authorized only when a
// V2.3 recurrence trajectory/repetition legitimately expresses it), so banning it here would regress
// the shipped continuity layer.
const MEMORY_EXPOSURE =
  /\byesterday\b|\b(the )?last time\b|\bpreviously\b|\bthe day before\b|\bearlier (this week|today)\b|\bdays? ago\b|\bback then\b|\bI (remember|recall)\b|어제|지난번|예전에|기억(하|해|나)|지난 며칠/i;

// V2.2 — user-level interpretation: a Living Response describes the action relationship, never the
// user's identity, character, values, motive, emotion, stable tendency, or growth. Unconditional (a
// core safety rule); narrow enough not to reject valid action-centered sentences that merely say "you".
const USER_INTERPRETATION =
  /\bthis (shows|means|reflects|reveals|tells us|suggests|says)( that)? you\b|\byou (value|tend|prefer|fear|avoid|struggle|care about)\b|\byou'?re (becoming|growing|learning)\b|\byou are (becoming|growing|learning|someone who|a person who|the kind of)\b|\b(reveals|reflects|shows) your (character|values|nature|true self)\b|당신은\b|당신이 .*(사람|성향|가치)|가치관을 보여|성격을 (보여|드러)/i;

// V2.2 — recurrence markers (repetition depth REQUIRES one; commitment depth already blocks them via
// HISTORICAL_MARKERS). Recurrence ≠ contrast: "again" is recurrence; "no longer" is contrast (blocked
// separately). A bare recurrence marker is NOT enough on its own — see REPETITION_ANCHOR_MISSING.
const RECURRENCE_MARKER =
  /\b(again|more than once|over and over|time and again|has (returned|been named|been kept|shown up|carried)|keeps? (return|nam|show|carr)\w*|repeatedly|each time)\b|다시|또다시|거듭|여러\s*번|반복/i;

// V2.3 — trajectory anchor markers (EN + KO). A RECURRENCE trajectory (continuation/return/re_entry/
// long_held) must surface a returning/continuing marker; a BEGINNING/widening trajectory (expansion)
// must surface a beginning marker AND must NOT carry a recurrence marker (it is a first-time/widening
// shape, never "again").
const TRAJ_RECURRENCE_MARKER =
  /\b(again|still|back|returns?|returned|returning|continues?|continuing|carried forward|once more|picks?\s+\w+\s+up|keeps?|kept)\b|다시|또|여전|이어|돌아|계속/i;
const TRAJ_BEGINNING_MARKER =
  /\b(first|begins?|beginning|new(er)?|opens?|wider|beyond|further|fresh|starts?|starting|onto|into (newer|wider|new)\s|new ground)\b|처음|새로|넓|열리|나아가/i;

// V2.1 movement + destination anchor patterns (EN + KO). A commitment/repetition line MUST surface at
// least one of its proposition's requiredAnchors (its movement or destination). This IS the
// anti-universal rule: a generic aphorism ("clarity / growth / presence / alignment") contains none of
// these, so it fails MOVEMENT_ANCHOR_MISSING.
const ANCHOR_PATTERNS: Record<string, RegExp> = {
  // movements
  unspoken_to_named: /\b(nam(e|es|ed|ing)|inward|inner|unspoken|honest\w*|take[s]? form|takes shape|into form)\b|이름|안에|내면|정직|또렷|분명|형태/i,
  private_to_relational: /\b(receiv\w*|another person|someone else|reach(es|ed|ing)?|shared|relational|care|between)\b|상대|다른 사람|곁|받|가 닿|마음/i,
  decision_to_action: /\b(built?|build\w*|made|make[s]?|shap(e|es|ed|ing)|created?|into (what|the)|actually (built|made))\b|짓|만들|빚|형태|현실|지은/i,
  // destinations
  self: /\b(yourself|your own|inward|inner|within you)\b|자신|스스로|내면|안에/i,
  another_person: /\b(another person|someone|someone else|others?|receive it|they can)\b|상대|다른 사람|이웃|누군가|곁/i,
  shared_reality: /\b(built?|world|made|created?|what (you )?(make|build)|shared)\b|세상|만든|지은|현실/i,
};

// Contrast markers — FORBIDDEN at every V2.1 depth (V2.1 never authorizes a previous-vs-today claim).
const CONTRAST_MARKERS =
  /\b(no longer|used to|previously|before now|unlike before|has changed|now different|instead of before|once (was|were))\b|더\s*이상|예전|이전엔|전에는|바뀌었|달라졌/i;

// Historical / repetition markers — FORBIDDEN at commitment depth (allowed only at repetition depth).
const HISTORICAL_MARKERS =
  /\b(again|repeatedly|keeps? \w+ing|kept \w+ing|as before|each time|over and over|consistently|every day|day after day)\b|다시|계속|반복|매번|여전/i;

// Praise / evaluation — a Living Response observes; it never congratulates or grades the user.
const PRAISE =
  /\b(well done|good job|great job|nicely done|so proud|proud of you|you did (great|well|so well)|doing (so |really )?well|impressive|amazing (work|job)|way to go)\b|잘\s*했|훌륭|대단|자랑스/i;

// The Today Path `select` copy (cores, EN + KO) — a Living Response must not paraphrase/restate it.
// Kept here (not in the shell-mirrored guard set) so this stays a pure LR-validator concern.
const PATH_PHRASES: Record<LivingResponseRelationship, string[]> = {
  self: ["Return to yourself with honesty", "정직하게 자신에게 돌아갑니다"],
  others: ["Carry care into one relationship", "한 관계 안으로 조심스럽게 들어갑니다"],
  world: ["Build with stewardship today", "맡겨진 것을 오늘도 빚어갑니다"],
};

// Narrow lexical markers for the proposition-forbidden CLAIMS that have a clear surface form and do
// NOT collide with any authorized movement/destination anchor (e.g. "another person"/"receive" stay
// legal for Others). Only claims listed in the proposition's prohibitedClaims are checked.
const CLAIM_MARKERS: Record<string, RegExp> = {
  productivity: /\bproductiv\w*|efficien\w*/i,
  achievement: /\bachiev\w*|accomplish\w*|succe(ed|ss)\w*/i,
  procrastination: /\bprocrastinat\w*/i,
  completion: /\b(finish(ed|es|ing)?|completed|all done)\b|완료|끝냈/i,
  business_result: /\b(revenue|profit|sales)\b|매출|이익/i,
  repair: /\brepair\w*|mend\w*|fix(ed|es|ing)?\b|고치|바로잡/i,
  apology: /\bapolog\w*|sorry\b|사과|미안/i,
  conversation: /\bconversation|talk to|speak to|tell them\b|대화|말을 걸/i,
  dishonesty: /\bdishonest\w*|\blie[ds]?\b|lying|deceiv\w*/i,
  avoidance: /\bavoid\w*|escap\w*|evad\w*/i,
  emotion: /\b(anxious|afraid|scared|sad|angry|depress\w*|ashamed|guilt\w*)\b|불안|두려|슬프|우울/i,
  // V2.2 repetition-prohibited extensions (recurrence alone cannot support these). Collision-checked
  // against frame/repetition safe anchors: none of these overlap "returned/inward/named/carried/…".
  improvement: /\bimprov\w*|\bbetter\b|\bprogress\w*|\bstronger\b/i,
  growth: /\bgrow(s|ing|th)?\b/i,
  values: /\bvalue[sd]?\b|matters to you/i,
  tendency: /\btend(s|ency)?\b|habitually|usually you/i,
  fear: /\bfear\w*|afraid|scared\b|두려|겁/i,
  delay: /\bdelay\w*|put off|postpon\w*/i,
  withheld: /\bwithh\w*|held back|kept inside\b/i,
  distance: /\bdistanc\w*|withdrawn|pulled away|apart\b/i,
  private: /\bprivate(ly)?\b|in secret|hidden away\b|비밀|숨긴/i,
  spoken: /\bspoken|said aloud|voiced|out loud\b|소리 내어/i,
  hearing: /\bhearing\b|heard by|listen(s|ed|ing)?\b|듣는|들리/i,
  another_person: /\banother person|someone else\b|다른 사람|남에게/i,
  // V2.3 trajectory-prohibited extensions — a commitment-sequence SHAPE never becomes judgment,
  // failure/abandonment, mastery/superiority, or an absolute. (Scoped: only checked when the id is in
  // the proposition's prohibitedClaims, i.e. a trajectory/repetition proposition.)
  failure: /\bfail(s|ed|ure|ing)?\b|실패/i,
  gave_up: /\bgave up|giving up|give up\b|포기/i,
  abandoned: /\babandon\w*\b|저버리|내버려/i,
  always: /\balways\b|항상|언제나/i,
  never_left: /\bnever (left|stopped|gone|abandoned)\b|떠난 적 (없|이 없)/i,
  disappeared: /\bdisappear\w*|vanish\w*\b|사라(졌|진)/i,
  mastery: /\bmaster(ed|y|ing)?\b|perfected\b|통달|완벽히/i,
  finished: /\bfinished\b|done with\b|끝냈|다 끝/i,
  superiority: /\bbetter than|superior(ity)?\b|우월|더 나은/i,
};
// Geometry-aligned length contract: short enough to fit the reserved 2-line slot at mobile width,
// so the line can never grow the card. One sentence, ≤ MAX_WORDS words, ≤ MAX_LEN chars.
const MAX_LEN = 100;
const MAX_WORDS = 16;

// Generic wellness / meditation / motivational phrase families — a Living Response must never read
// like a wellness app. Reject if ANY family matches (case-insensitive), EN + KO.
const WELLNESS_FAMILIES: RegExp[] = [
  /\bembrace\b/i,
  /\bnurtur\w*/i,
  /\bessence\b/i,
  /\banchor\b/i,
  /\bjourney\b/i,
  /\binner peace\b/i,
  /\bspace for (your|yourself)\b/i,
  /\bdaily distractions\b/i,
  /\byour (own )?(essence|journey|power|center|truth|light|being)\b/i,
  /\b(inner|true|authentic) (self|strength|peace|child|voice|wisdom)\b/i,
  /\bsteady (presence|anchor)\b/i,
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
const INSTRUCTION =
  /\b(try|remember|consider|practice|regularly|make sure|be sure to|take time|focus on|begin by|continue to|keep|allow yourself|you should|you must|don'?t forget|take a moment to)\b|하세요|하십시오|해야 합니다|기억하세요|잊지 마|규칙적으로/i;

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
  | "ANCHOR_MISSING"
  // V2.1 proposition-aware
  | "MOVEMENT_ANCHOR_MISSING" // sentence surfaces neither the authorized movement nor destination
  | "HISTORICAL_CLAIM" // repetition/history marker at commitment depth
  | "CONTRAST_CLAIM" // previous-vs-today claim (never authorized in V2.1)
  | "PATH_PARAPHRASE" // restates/paraphrases the Today Path copy
  | "PROHIBITED_CLAIM" // surfaces a meaning the proposition explicitly forbids
  | "PRAISE" // congratulates or grades the user
  // V2.2
  | "USER_INTERPRETATION" // claims identity/character/values/motive/emotion/tendency/growth
  | "REPETITION_ANCHOR_MISSING" // repetition depth but no provenance-backed recurrence expressed
  // V2.3
  | "TRAJECTORY_ANCHOR_MISSING" // trajectory present but the sequence shape is not expressed (or a
                                 // beginning/widening shape wrongly carries a recurrence marker)
  // Living Memory V0
  | "MEMORY_EXPOSURE"; // explicitly names/reads the past (yesterday, last time, I remember, …)

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
  /** V2.1: the authorized proposition. When present, the line must surface the movement/destination
   *  anchor (anti-universal), must not carry contrast markers, and — at commitment depth — must not
   *  carry historical/repetition markers. Absent → legacy V1 validation only. */
  proposition?: LivingResponseProposition;
};

export function validateLivingResponse(
  text: string,
  input: ValidateLivingResponseInput,
): { ok: boolean; violations: LivingResponseViolation[] } {
  const v: LivingResponseViolation[] = [];
  const t = (text ?? "").trim();

  if (t.length === 0) v.push("EMPTY");
  if (t.length > MAX_LEN || t.split(/\s+/).filter(Boolean).length > MAX_WORDS) v.push("TOO_LONG");
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
  // V2.2 — never interpret the user (identity/character/values/motive/emotion/tendency/growth).
  if (USER_INTERPRETATION.test(t)) v.push("USER_INTERPRETATION");
  // Living Memory V0 — continuity may shape the line but must never be NAMED (yesterday / last time / …).
  if (MEMORY_EXPOSURE.test(t)) v.push("MEMORY_EXPOSURE");

  // V2.1 proposition-aware checks — the sentence must EXPRESS the authorized meaning, specifically.
  let hasFrameAnchor = false;
  if (input.proposition) {
    // Anti-universal rule: the line must surface the authorized movement OR destination — a generic
    // aphorism (clarity / growth / presence / alignment) surfaces neither.
    hasFrameAnchor = input.proposition.requiredAnchors.some((a) => ANCHOR_PATTERNS[a]?.test(t));
    if (!hasFrameAnchor) v.push("MOVEMENT_ANCHOR_MISSING");
    // No previous-vs-today claim is ever authorized in V2.1.
    if (CONTRAST_MARKERS.test(t)) v.push("CONTRAST_CLAIM");
    // Commitment depth may not lean on repetition/history — EXCEPT when a recurrence trajectory (V2.3)
    // authorizes exactly that sequence language (continuation/return/re_entry/long_held). A
    // beginning/widening trajectory (expansion) is NOT authorized to use history markers.
    const trajectoryAuthorizesHistory = !!input.proposition.trajectory?.recurrence;
    if (input.proposition.depth === "commitment" && HISTORICAL_MARKERS.test(t) && !trajectoryAuthorizesHistory)
      v.push("HISTORICAL_CLAIM");
    // Must not paraphrase the Today Path copy.
    if (isRestatement(t, PATH_PHRASES[input.relationship])) v.push("PATH_PARAPHRASE");
    // Must not surface any meaning the proposition explicitly forbids (frame meaning limits, §5;
    // V2.2 repetition-prohibited extensions: privacy/relational/improvement/change/…).
    if (input.proposition.prohibitedClaims.some((c) => CLAIM_MARKERS[c]?.test(t))) v.push("PROHIBITED_CLAIM");
    // A Living Response observes; it never praises.
    if (PRAISE.test(t)) v.push("PRAISE");

    // V2.2 repetition grounding — at repetition depth the line must EXPRESS the provenance-backed
    // recurrence, not merely carry several frame tokens. Requires BOTH (a) a recurrence marker (EN+KO)
    // AND (b) the frame movement/destination anchor (hasFrameAnchor above, EN+KO) — the anchor ties the
    // recurrence to THIS specific behavior. A frame-only line (no recurrence marker) or a "again"-only
    // line (no frame anchor) fails. Both signals are proposition-derived, not a global token list.
    if (input.proposition.repetition) {
      const hasRecurrence = RECURRENCE_MARKER.test(t);
      if (!hasRecurrence || !hasFrameAnchor) v.push("REPETITION_ANCHOR_MISSING");
    }

    // V2.3 trajectory grounding — the line must EXPRESS the commitment-sequence shape AND tie it to the
    // frame (hasFrameAnchor). A recurrence trajectory requires a returning/continuing marker; a
    // beginning/widening trajectory requires a beginning marker AND must carry NO recurrence marker (an
    // "again" would contradict a first-time/expansion shape). Non-judgment is enforced separately via
    // USER_INTERPRETATION + the proposition's prohibitedClaims (PROHIBITED_CLAIM).
    if (input.proposition.trajectory) {
      if (input.proposition.trajectory.recurrence) {
        if (!TRAJ_RECURRENCE_MARKER.test(t) || !hasFrameAnchor) v.push("TRAJECTORY_ANCHOR_MISSING");
      } else {
        if (!TRAJ_BEGINNING_MARKER.test(t) || !hasFrameAnchor || TRAJ_RECURRENCE_MARKER.test(t))
          v.push("TRAJECTORY_ANCHOR_MISSING");
      }
    }
  }

  // Evidence anchor — the line must ground in a packet concept OR (V2.1) the authorized frame anchor.
  const hasConceptAnchor = anchorMatcher(input.concepts)(t);
  if (input.concepts.length > 0 && !hasConceptAnchor && !hasFrameAnchor) v.push("ANCHOR_MISSING");

  // Relevance — satisfied by a relationship anchor, a packet concept anchor, OR the frame anchor (the
  // movement/destination IS relationship-derived, so a frame-grounded line needn't restate the label).
  const hasAnyAnchor = hasConceptAnchor || hasFrameAnchor;
  if (!RELATIONSHIP_ANCHORS[input.relationship].test(t) && !hasAnyAnchor) v.push("RELATIONSHIP_IRRELEVANT");

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
