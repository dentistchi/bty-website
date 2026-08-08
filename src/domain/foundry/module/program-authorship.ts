/**
 * Guided Program Authorship V1 — domain (pure, Slice 3.2L).
 *
 * The Builder's two Copilots each propose a handful of BUILDER FIELDS. This layer is a
 * different job: ONE whole participant-shaped PROGRAM, authored from the Host's intent
 * and reviewed section by section before anything is applied.
 *
 * It extends the existing Reality-Grounded Journey contract rather than competing with
 * it. The Journey already declares every element kind a program needs; three of them
 * (`scenario`, `action_decision`, `field_application`) were never emitted because the
 * deterministic B3A mapper had no grounded source for them, and `follow_up` did not
 * exist. Those are exactly the elements a program author must supply.
 *
 * The model PROPOSES; this decides validity, fail-closed. There is NO partial success,
 * NO deterministic fabrication, and nothing here writes to a draft.
 *
 * No DB, no I/O, no providers.
 */

import {
  JOURNEY_KIND_ORDER,
  journeyElementId,
  type JourneyElementKind,
  type RealityGroundedJourneyV1,
} from "./journey";
import {
  normalizeLearningNeeds,
  recommendArenaForNeeds,
  stepBlocker,
  AUDIENCE_TYPES_NEEDING_DETAIL,
  FOLLOW_UP_DAY_OPTIONS,
  type AudienceType,
  type BuilderAnswers,
  type LearningNeed,
} from "./module-builder";
import {
  APPLICATION_FIELD_LIMIT,
  ARTIFACT_NOUNS,
  CONTRACT_FIELD_LIMIT,
  SCENARIO_FIELD_LIMIT,
  deriveOperationalConstruct,
  isConfirmer,
  isRenderableAction,
  isInstructionalKind,
  isResponseMode,
  isReviewFocus,
  isVerificationTarget,
  renderApplicationSentence,
  renderCompletionQuestion,
  renderDecisionSentence,
  renderFollowUpSentence,
  validateApplicationContract,
  renderScenarioSentence,
  renderRationaleSentence,
  renderCounterpartQuestion,
  CREATION_FRAME,
  deriveFirstApplicationMoment,
  renderStandardSentence,
  ungroundedExistingEntity,
  validateBehaviorContract,
  validateProgramDependencies,
  validateScenarioContract,
  type ApplicationContract,
  type BehaviorContract,
  type CompletionContract,
  type FollowUpContract,
  type OperationalConstruct,
  type ContractDefect,
  type DependencyDefect,
  type ProgramSection,
  type ScenarioContract,
} from "./program-coherence";

/**
 * MATERIALLY DIFFERENT CONTRACT AGAIN (Slice 3.2L-R6), so v4.
 *
 * v2 derived THE STANDARD from a `behavior_contract`; v3 derived IN CONTEXT from a
 * `scenario_contract` bound to the same behavior. v4 finishes the job: YOUR DECISION,
 * APPLY IT, BEFORE YOU FINISH and WHAT HAPPENS NEXT are derived too, from an
 * `application_contract`, an enumerated `completion_contract` and an enumerated
 * `follow_up_contract` — so all six INSTRUCTIONAL sections are views of ONE behavioral
 * authority instead of six independently authored strings whose order is checked
 * afterwards. WHY THIS MATTERS stays narrative prose and instructs nobody.
 *
 * v5 (Slice 3.2L-R7) keeps that JSON shape byte-for-byte and changes WHAT THE MODEL IS
 * AUTHORISED TO DESIGN. The v4 prompt handed over the Host's "Create a shared handoff
 * standard" labelled as "the behavior expected afterwards", told the model to describe
 * creating the construct, and then refused a standard about creating a construct — with no
 * statement anywhere that designing a future behaviour is permitted at all. The version is
 * bumped even though the schema did not move, because reconciliation has to be able to tell
 * the contradictory authority that refused parent `604d09e5` from the repaired one.
 */
export const PROGRAM_AUTHORSHIP_VERSION = "program_authorship_v9";

// ---------------------------------------------------------------------------
// Provenance — who authored each participant-facing sentence
// ---------------------------------------------------------------------------

/**
 * Honest authorship of one element. `host_statement` is the Host's own words carried
 * verbatim by the deterministic mapper; `ai_proposed` is model output the Host has not
 * touched; `host_edited` is model output the Host rewrote (or any element they edited);
 * `deterministic_derived` is computed by the system from Builder answers, authored by
 * nobody.
 *
 * The learner preview must NEVER attribute `ai_proposed` content to the Host — saying
 * "From your: …" over a sentence the Host never wrote is the specific dishonesty this
 * type exists to prevent.
 */
export type ProgramProvenance = "host_statement" | "ai_proposed" | "host_edited" | "deterministic_derived";

export const PROGRAM_PROVENANCES: readonly ProgramProvenance[] = [
  "host_statement",
  "ai_proposed",
  "host_edited",
  "deterministic_derived",
];

export function isProgramProvenance(v: unknown): v is ProgramProvenance {
  return typeof v === "string" && (PROGRAM_PROVENANCES as readonly string[]).includes(v);
}

/** True when the element's words came from the Host (verbatim or edited). */
export function isHostAuthored(p: ProgramProvenance): boolean {
  return p === "host_statement" || p === "host_edited";
}

/**
 * A Host edit always transfers authorship. Editing AI output makes it the Host's
 * statement; editing their own leaves it theirs. Never silently keeps `ai_proposed`.
 */
export function provenanceAfterHostEdit(prior: ProgramProvenance): ProgramProvenance {
  return prior === "host_statement" ? "host_statement" : "host_edited";
}

// ---------------------------------------------------------------------------
// Required elements — deterministic, driven by the Host's learning design
// ---------------------------------------------------------------------------

/**
 * Which participant-facing elements this specific program MUST contain.
 *
 * Deliberately NOT a fixed count. "7 of 8" is a meaningless bar when the missing one is
 * the element the chosen learning design depends on. The rules:
 *
 *   always                      why_it_matters, observable_standard, completion_check
 *   decide                      + action_decision
 *   practice | arenaRecommended + scenario
 *   followUpDays > 0            + field_application, follow_up
 *   sharedQuestion configured   + reflection
 *
 * `know` alone requires no fabricated Arena scenario — information does not need
 * rehearsal, and inventing one would be exactly the overreach this arc forbids.
 */
export function requiredProgramKinds(answers: BuilderAnswers | undefined): JourneyElementKind[] {
  const a = answers ?? {};
  const needs = normalizeLearningNeeds(a);
  const required = new Set<JourneyElementKind>(["why_it_matters", "observable_standard", "completion_check"]);

  if (needs.includes("decide")) required.add("action_decision");
  if (needs.includes("practice") || a.arenaRecommended === true) required.add("scenario");
  if (typeof a.followUpDays === "number" && a.followUpDays > 0) {
    required.add("field_application");
    required.add("follow_up");
  }
  if ((a.sharedQuestion ?? "").trim().length > 0) required.add("reflection");

  // Canonical render order, never insertion order.
  return JOURNEY_KIND_ORDER.filter((k) => required.has(k));
}

/** Required kinds that are absent or still empty in `journey`. Empty ⇒ complete. */
export function missingProgramKinds(
  answers: BuilderAnswers | undefined,
  journey: RealityGroundedJourneyV1 | undefined,
): JourneyElementKind[] {
  const present = new Map((journey?.elements ?? []).map((e) => [e.kind, (e.content ?? "").trim()]));
  return requiredProgramKinds(answers).filter((k) => (present.get(k) ?? "").length === 0);
}

// ---------------------------------------------------------------------------
// Generation context + stale-context fingerprint
// ---------------------------------------------------------------------------

export type ProgramContext = {
  problemStatement: string;
  audienceType: AudienceType;
  audienceDetail: string | null;
  capabilityCandidate: string | null;
  observableBehavior: string;
  successEvidence: string;
  learningNeeds: LearningNeed[];
  arenaRecommended: boolean;
  followUpDays: number;
  sharedQuestion: string | null;
  completionPrompt: string | null;
  materialIntent: string | null;
};

/**
 * Reconstruct the canonical authorship context, or null when the Builder itself would
 * consider the draft unready. Reuses the EXACT step gates 1–4 so a program can never be
 * authored from an incomplete intent.
 */
export function programContext(answers: BuilderAnswers | undefined): ProgramContext | null {
  const a = answers ?? {};
  for (const step of [1, 2, 3, 4]) {
    if (stepBlocker(step, a)) return null;
  }
  const audienceType = a.audienceType as AudienceType;
  const needsDetail = (AUDIENCE_TYPES_NEEDING_DETAIL as readonly string[]).includes(audienceType);
  const needs = normalizeLearningNeeds(a);
  const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  return {
    problemStatement: text(a.problem),
    audienceType,
    audienceDetail: needsDetail ? text(a.audienceDetail) : null,
    capabilityCandidate: text(a.capabilityCandidate) || null,
    observableBehavior: text(a.observableBehavior),
    successEvidence: text(a.successEvidence),
    learningNeeds: needs,
    arenaRecommended: a.arenaRecommended ?? recommendArenaForNeeds(needs),
    followUpDays: (FOLLOW_UP_DAY_OPTIONS as readonly number[]).includes(a.followUpDays ?? -1) ? (a.followUpDays as number) : 0,
    sharedQuestion: text(a.sharedQuestion) || null,
    completionPrompt: text(a.completionPrompt) || null,
    materialIntent: typeof a.materialIntent === "string" ? a.materialIntent : null,
  };
}

const norm = (s: string): string => s.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * A stable fingerprint of everything a proposal was authored from. Any change to the
 * Host's intent changes it, so a stale proposal can be refused instead of applied over
 * a draft that has moved on.
 */
export function programContextFingerprint(ctx: ProgramContext): string {
  return [
    norm(ctx.problemStatement),
    ctx.audienceType,
    norm(ctx.audienceDetail ?? ""),
    norm(ctx.capabilityCandidate ?? ""),
    norm(ctx.observableBehavior),
    norm(ctx.successEvidence),
    ctx.learningNeeds.join("+"),
    String(ctx.arenaRecommended),
    String(ctx.followUpDays),
    norm(ctx.sharedQuestion ?? ""),
    norm(ctx.completionPrompt ?? ""),
    ctx.materialIntent ?? "",
  ].join("¦");
}

export function programContextsCompatible(a: ProgramContext, b: ProgramContext): boolean {
  return programContextFingerprint(a) === programContextFingerprint(b);
}

// ---------------------------------------------------------------------------
// Proposal contract
// ---------------------------------------------------------------------------

export type ProposedElement = {
  kind: JourneyElementKind;
  /** Participant-facing content. */
  content: string;
  /** Why this element says what it says — advisory display only, never published. */
  rationale: string;
};

export type ProgramProposal = {
  /** Learner-facing program title. Host confirms before publish. */
  displayTitle: string;
  elements: ProposedElement[];
  assumptions: string[];
  warnings: string[];
  /** Honest ceiling on what the configured workflow can establish. */
  evidenceLanguage: string;
  /**
   * The validated behavioral contract THE STANDARD was rendered from (Slice 3.2L-R4).
   *
   * PROPOSAL-ONLY. `applyProgramProposal` reads participant-facing content and nothing
   * else, and no persistence path stores a `ProgramProposal` — the durable ledger records
   * counts and digests, never the program body. So this never reaches a database, and a
   * Host edit cannot leave stale metadata behind in one: there is nowhere for it to go.
   */
  behaviorContract: BehaviorContract;
  /**
   * Present only when the Host's design requires a scenario. Proposal-only, like the
   * behavior contract: Apply reads display content, and no path persists a proposal.
   */
  scenarioContract: ScenarioContract | null;
  /** Present when the design requires APPLY IT / YOUR DECISION. Proposal-only. */
  applicationContract: ApplicationContract | null;
  /** Enumerated: BEFORE YOU FINISH is rendered from a fixed matrix, never authored. */
  completionContract: CompletionContract | null;
  /** Enumerated, with the window taken from canonical context rather than the model. */
  followUpContract: FollowUpContract | null;
  /** The one construct this program is about, system-derived from Host intent. */
  operationalConstruct: OperationalConstruct | null;
};

export type ProgramValidated = { proposal: ProgramProposal; version: string };

export type ProgramRejectCode =
  | "not_object"
  | "missing_program"
  | "missing_field"
  | "field_type"
  | "empty_field"
  | "too_long"
  | "unsafe_markup"
  | "unknown_kind"
  | "duplicate_kind"
  | "missing_required_kind"
  | "unrequested_kind"
  | "complaint_replay"
  | "material_fabrication"
  | "invented_specifics"
  | "evidence_overclaim"
  | "decision_is_only_reflection"
  | "application_without_actor"
  /** The first real application names a moment that is not an instance of the trigger. */
  | "application_moment_unrelated"
  /**
   * RETIRED as of program_authorship_v3 (Slice 3.2L-R5) and no longer emitted: relevance
   * is now guaranteed by deriving IN CONTEXT from the behavior contract, not measured by
   * lexical overlap. Kept in the union because live attempt rows still carry it and the
   * Host-facing copy must remain able to explain one.
   */
  | "scenario_unrelated"
  /**
   * The canonical trigger never says the behaviour RECURS, so no honest "next one" can be
   * derived from it (Slice 3.2L-R10-A). Fails before review: a program whose first real
   * chance cannot be named is not ready, and the fix is the trigger, not another sample.
   */
  | "trigger_not_recurring"
  /** The proposed situation carried no pressure, or none that was actually a difficulty. */
  | "scenario_without_pressure"
  /**
   * The situation gave itself an occasion — "during a team meeting", "at the next
   * handover" — so the program would require the behaviour at one moment and rehearse it
   * at another (Slice 3.2L-R8.1). Distinct from `scenario_without_pressure`: the
   * difficulty may be perfectly real, and telling the Host it was missing would be the
   * wrong reason for the right refusal.
   */
  | "scenario_independent_moment"
  | "generic_completion"
  /**
   * The behavioral contract is incomplete or non-observable (Slice 3.2L-R4). The code name
   * is kept; its MEANING is corrected. It previously fired only when the standard had
   * fewer than four words — a bar the live meta-standard cleared sixteen words wide.
   */
  | "non_observable_standard"
  /**
   * A section depends on an operational construct the program never defined, or a closing
   * question supplies the defining content of a construct an earlier section already told
   * the participant to use (Slice 3.2L-R4).
   */
  | "dependency_inversion"
  | "section_contradiction"
  | "duplicate_content"
  | "internal_jargon"
  | "person_evaluation"
  | "invalid_assumptions"
  | "invalid_warnings";

/**
 * The same codes as a runtime value, so a Host-facing copy map can be checked for exact
 * coverage rather than merely for the absence of a compile error. Kept beside the union so
 * the two cannot drift.
 */
export const PROGRAM_REJECT_CODES: readonly ProgramRejectCode[] = [
  "not_object", "missing_program", "missing_field", "field_type", "empty_field", "too_long",
  "unsafe_markup", "unknown_kind", "duplicate_kind", "missing_required_kind", "unrequested_kind",
  "complaint_replay", "material_fabrication", "invented_specifics", "evidence_overclaim",
  "decision_is_only_reflection", "application_without_actor", "application_moment_unrelated", "scenario_unrelated",
  "scenario_without_pressure", "scenario_independent_moment", "generic_completion", "non_observable_standard",
  "trigger_not_recurring",
  "dependency_inversion", "section_contradiction", "duplicate_content", "internal_jargon",
  "person_evaluation", "invalid_assumptions", "invalid_warnings",
];

export type ProgramValidation =
  | { ok: true; value: ProgramValidated }
  | {
      ok: false;
      code: ProgramRejectCode;
      kind?: JourneyElementKind;
      diagnosis?: StructuralDiagnosis;
      /** Present only for `dependency_inversion` — closed vocabulary, never prose. */
      dependency?: DependencyDefect;
      /** Present only for `non_observable_standard` — closed vocabulary, never prose. */
      contract?: ContractDefect;
    };

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

const LIMITS = {
  title: 90,
  content: 700,
  rationale: 300,
  assumption: 240,
  warning: 240,
  evidenceLanguage: 320,
} as const;
const MAX_LIST = 6;
const MIN_CONTENT = 15;

// ---------------------------------------------------------------------------
// Safety gates — lexical, fail-closed minimum floor
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
const UNSAFE = [/<[^>]+>/, /```|~~~/, /data:\s*[\w.+-]+\/[\w.+-]+/i, /<\s*script|javascript:|onerror\s*=|onload\s*=/i];
function hasUnsafeMarkup(raw: string): boolean {
  return CONTROL_CHARS.test(raw) || UNSAFE.some((re) => re.test(raw));
}

/** Phrases that, ASSERTED, claim what only later observation could show. */
/**
 * CAUSAL OUTCOME CLAIMS (Slice 3.2L-R8). The live v5 WHY THIS MATTERS ended "…which
 * ultimately affects project success and team collaboration" — an organisational result the
 * Host never established. Training can address the operational problem they described; it
 * cannot promise the outcome.
 */
/**
 * Where an outcome promise starts in a piece of narrative, or -1.
 *
 * Exported so the one place that has to HANDLE an authentic overclaim rather than merely
 * refuse it — the physical-preview fixture, which replays a real proposal that shipped one —
 * cuts at the same phrase list the validator refuses on, instead of hard-coding a substring
 * that would silently stop matching if the list moved (Slice 3.2L-R8.1).
 */
export function outcomeClaimIndex(text: string): number {
  let best = -1;
  for (const p of OUTCOME_CLAIM_PHRASES) {
    const m = new RegExp(p, "i").exec(text);
    if (m && (best < 0 || m.index < best)) best = m.index;
  }
  const structural = OUTCOME_CLAIM_STRUCTURE.exec(text);
  if (structural && (best < 0 || structural.index < best)) best = structural.index;
  return best;
}

const OUTCOME_CLAIM_PHRASES = [
  "ultimately (?:affects?|improves?|leads? to|results? in|drives?)",
  "(?:improves?|increases?|boosts?|drives?|ensures?) (?:project success|team collaboration|productivity|morale|safety|quality|outcomes|performance|efficiency|retention)",
  "leads? to (?:better|improved|stronger|greater)",
  "results? in (?:better|improved|fewer|greater)",
  "equipped to",
  "ready to (?:implement|lead|deliver)",
];

/**
 * WHY A PHRASE LIST WAS NEVER GOING TO HOLD (Slice 3.2L-R9).
 *
 * The v5 window promised "…ultimately affects project success and team collaboration" and
 * the list learned that sentence. The v7 window made the SAME unsupported causal claim in
 * four new sentences — "ensures that everyone is clear on responsibilities", "prevents
 * important tasks from falling through the cracks", "supports team collaboration",
 * "improves overall workflow efficiency" — and every one passed. Three independent reasons:
 * `prevents` and `supports` were not in the verb list at all; `improves` was, but only when
 * a listed noun followed IMMEDIATELY, and "overall" sat between them; and no entry covered
 * an idiom like "falling through the cracks".
 *
 * Accumulating those four would buy one more window. The claim is STRUCTURAL — a causal
 * verb pointed at an organisational outcome — so it is matched structurally: any verb from
 * the first set, any outcome from the second, within a short window. Synonym substitution
 * inside those sets no longer reopens the defect.
 */
const CAUSAL_VERB =
  "ensur\\w*|prevent\\w*|improv\\w*|increas\\w*|boost\\w*|driv\\w*|support\\w*|strengthen\\w*|eliminat\\w*|reduc\\w*|enhanc\\w*|guarantee\\w*|maximi[sz]\\w*|minimi[sz]\\w*|optimi[sz]\\w*|foster\\w*|promot\\w*|achiev\\w*|deliver\\w*|lead(?:s|ing)? to|result(?:s|ing)? in|make(?:s)? sure|so that";
const OUTCOME_OBJECT =
  "collaborat\\w*|cooperat\\w*|teamwork|efficien\\w*|productivit\\w*|moral\\w*|safet\\w*|qualit\\w*|performanc\\w*|retention|success|workflows?|outcomes?|results?|clarity|responsibilit\\w*|communicat\\w*|accountabilit\\w*|consisten\\w*|adoption|engagement|alignment|throughput|error\\w*|mistakes?|delays?|risks?|rework|falling through the cracks|slipping through|being missed|getting missed";
/** A causal verb aimed at an organisational outcome, with room for modifiers between them. */
const OUTCOME_CLAIM_STRUCTURE = new RegExp(
  `\\b(?:${CAUSAL_VERB})\\b[^.!?]{0,48}?\\b(?:${OUTCOME_OBJECT})\\b`,
  "i",
);

const OVERCLAIM_PHRASES = [
  ...OUTCOME_CLAIM_PHRASES,
  "now competent", "fully (?:understand|understood|understands)", "permanently",
  "trust (?:was|is|has been) restored", "behaviou?r (?:has |was )?(?:permanently )?changed",
  "mastered", "no longer needs?", "performance improved", "guarantees?",
  "proves? (?:that )?(?:you|they) (?:can|will)", "sustained change", "has been verified",
];
const OVERCLAIM = new RegExp(OVERCLAIM_PHRASES.join("|"), "gi");

/**
 * Negation immediately before an overclaim phrase. This gate exists to stop a program
 * CLAIMING behaviour changed — but the honest sentence the slice actively wants,
 * "this does not show behaviour changed", contains the very same words. A purely lexical
 * matcher rejects exactly the language it should encourage, so the assertion has to be
 * distinguished from its denial.
 *
 * Deliberately a short backward window: "not" three words earlier negates the claim,
 * "not" two sentences earlier does not.
 */
const NEGATOR = /\b(?:not|never|cannot|can't|doesn't|does not|don't|do not|isn't|is not|won't|will not|without|neither|nor|nothing|none|no|rather than|instead of)\b|않|아니|없/i;
const NEGATION_WINDOW = 48;

/**
 * CLAIMING A RUNG THE PRODUCT CANNOT REACH (Slice 3.2L-R11.4H).
 *
 * The phrase list and the causal-outcome structure between them missed every one of the
 * four claims this slice had to refuse — measured, not assumed:
 *
 *   "Participant now consistently performs complete handoffs."   passed
 *   "Training proved handoff quality improved."                  passed
 *   "Completion demonstrates sustained behavior change."         passed
 *   "Follow-up confirms the new standard is reliably used."      passed
 *
 * None is an organisational-outcome promise, so the R9 structural rule had nothing to
 * match; none uses a listed phrase. What they share is a LEVEL: each asserts applied,
 * observed or sustained evidence, and no training interaction can produce any of the three.
 *
 * Two shapes cover them. HABITUALITY — an adverb of regularity attached to performing the
 * behaviour. PROOF — a verb of demonstration pointed at a high rung. Both are assertions,
 * so both defer to the existing negation rule and to a prospective frame: "review WHETHER
 * the standard was used in a real handover" is the sentence the follow-up SHOULD contain,
 * and it must stay legal.
 */
const HABITUAL_PERFORMANCE = new RegExp(
  "\\b(?:consistently|reliably|routinely|habitually|regularly|always|every time|each time)\\b[^.!?]{0,40}?" +
    "\\b(?:perform\\w*|follow\\w*|appl(?:y|ies|ied)|us(?:e|es|ed|ing)|execut\\w*|carr(?:y|ies|ied)\\s+out|conduct\\w*|do(?:es)?)\\b" +
    "|\\b(?:perform\\w*|follow\\w*|appl(?:y|ies|ied)|us(?:e|es|ed|ing)|execut\\w*|conduct\\w*)\\b[^.!?]{0,40}?" +
    "\\b(?:consistently|reliably|routinely|habitually|regularly)\\b",
  "i",
);
const PROOF_VERB = "demonstrat\\w*|prov(?:e|es|ed|en)|confirm\\w*|verif\\w*|validat\\w*|establish(?:es|ed)";
const HIGH_RUNG =
  "sustained|lasting|permanent\\w*|behaviou?r change|competenc\\w*|mastery|master(?:ed|y)|improvement\\w*|improv(?:es|ed)|adoption|applied|application|reliab\\w*|consisten\\w*";
const PROOF_OF_HIGH_RUNG = new RegExp(`\\b(?:${PROOF_VERB})\\b[^.!?]{0,48}?\\b(?:${HIGH_RUNG})\\b`, "i");

/** Framing that ASKS rather than asserts — the shape a follow-up is supposed to have. */
const PROSPECTIVE_FRAME =
  /\b(?:whether|ask|asks|asked|review|reviews|reviewing|check|checks|checking|if|invite|prompt|consider|discuss)\b/i;
const PROSPECTIVE_WINDOW = 70;

/**
 * True when the text asserts evidence this product cannot produce — applied, observed or
 * sustained — rather than what the training interaction actually shows.
 */
export function claimsAboveCeiling(text: string): boolean {
  for (const re of [HABITUAL_PERFORMANCE, PROOF_OF_HIGH_RUNG]) {
    const m = re.exec(text);
    if (!m) continue;
    const before = text.slice(Math.max(0, m.index - PROSPECTIVE_WINDOW), m.index);
    if (NEGATOR.test(text.slice(Math.max(0, m.index - NEGATION_WINDOW), m.index))) continue;
    if (PROSPECTIVE_FRAME.test(before)) continue;
    return true;
  }
  return false;
}

/** True only when an overclaim phrase is ASSERTED rather than denied. */
function assertsOverclaim(text: string): boolean {
  // The structural causal-outcome claim carries the same negation rule: "does not improve
  // collaboration" is the honest sentence, not the claim (Slice 3.2L-R9).
  const structural = OUTCOME_CLAIM_STRUCTURE.exec(text);
  if (structural) {
    const before = text.slice(Math.max(0, structural.index - NEGATION_WINDOW), structural.index);
    if (!NEGATOR.test(before)) return true;
  }
  // A rung this product cannot reach, however it is phrased (Slice 3.2L-R11.4H).
  if (claimsAboveCeiling(text)) return true;
  OVERCLAIM.lastIndex = 0;
  for (let m = OVERCLAIM.exec(text); m !== null; m = OVERCLAIM.exec(text)) {
    const before = text.slice(Math.max(0, m.index - NEGATION_WINDOW), m.index);
    if (!NEGATOR.test(before)) return true;
  }
  return false;
}

/** Claims a concrete asset or policy already exists — the blunt, obvious phrasings. */
const MATERIAL_EXISTS = [
  /\bis attached\b/i,
  /\bhas been (attached|uploaded|added|created|approved)\b/i,
  /\balready (exists|attached|uploaded)\b/i,
];

// ---------------------------------------------------------------------------
// Artifact-existence grounding (Slice 3.2L-R2)
// ---------------------------------------------------------------------------

/**
 * THE LIVE MISS. The third controlled window generated, against the canonical draft:
 *
 *   APPLY IT     "I will use the handoff record template …"
 *   THIS ASSUMES "There is access to the necessary tools and templates …"
 *
 * The draft establishes a YouTube URL, `successEvidence: "Handoff record"` and
 * `observableBehavior: "Create a shared handoff standard."` — it establishes that a
 * handoff record is the DESIRED OUTPUT. It establishes nothing about a template, a tool,
 * or anyone's access to either. The program directed a participant to use an artifact
 * whose existence was never established, and an advisory "this assumes" does not make an
 * unsupported operational dependency safe.
 *
 * The old rule missed both because it required an adjective from a closed set between the
 * determiner and the noun ("the ATTACHED policy"), and its noun list contained neither
 * "template" nor "tool". Patching those two phrases would fix two sentences; this repairs
 * the semantic class.
 *
 * THE RULE: a DEFINITE reference to an artifact presupposes it exists, and may only be
 * made when the Host's own supplied context names that kind of artifact. An INDEFINITE
 * or creation-framed reference proposes a future artifact and is always fine.
 */
/**
 * The noun inventories, the greedy head-noun matcher and the creation/conditional framing
 * now live in `program-coherence`, which owns ONE entity lifecycle for artifacts AND
 * operational constructs. Re-exported here so the module's public surface is unchanged.
 */
export { ARTIFACT_NOUNS, CONSTRUCT_NOUNS } from "./program-coherence";

/**
 * The only text that can ground an artifact: what the HOST supplied, plus the identities
 * of materials the application has actually verified (e.g. an uploaded file's title).
 *
 * A URL is deliberately excluded. A link proves a material exists; it says nothing about
 * that material's CONTENTS, and the application never retrieved them. A YouTube URL can
 * therefore never ground "the template".
 *
 * A model-authored assumption can never ground anything either — that is precisely the
 * circularity the live miss exploited.
 */
/**
 * MATERIAL AUTHORITY — what the generator is actually entitled to say about materials
 * (Slice 3.2L-R11.4G).
 *
 * The canonical draft's one authorized generation was refused for `material_fabrication`,
 * and the validator was RIGHT: the draft has a YouTube link and no uploaded file, so
 * nothing established the template the program leaned on. The defect was upstream. The
 * model was given a bare `Participants will learn from: youtube` and a wall of
 * prohibitions, and had to infer its own authority — the same shape of failure R7 found in
 * the behaviour prompt, where prohibitions without a counterweight produced a refusal.
 *
 * Four authorities exist in this product, and only three are reachable:
 *
 *   A HOST-AUTHORED FACT      "Handoff record" as success evidence — the host said this
 *                             output matters. Authoritative, and usable.
 *   B ARTIFACT EXISTENCE      a link or an uploaded file's title. Proves something EXISTS.
 *   C ARTIFACT CONTENT        what is inside it. **The application never extracts this.**
 *                             There is no code path that reads a linked video or an
 *                             uploaded file's body, so this authority is UNREACHABLE and
 *                             no program may ever speak from it.
 *   D GENERATED LEARNER OUTPUT what the training asks people to make. Not a claim that
 *                             anything already exists.
 *
 * The refusal came from conflating A/D with B/C. This function states the true position so
 * the model is told what it MAY author, not only what it may not.
 */
export type MaterialAuthority = {
  /** Anything at all named as material — a link, an upload, or nothing. */
  readonly exists: readonly string[];
  /** Always false in this architecture. Named so the day it changes, this is the seam. */
  readonly contentsVerified: false;
};

export function deriveMaterialAuthority(
  answers: BuilderAnswers | undefined,
  verifiedArtifacts: readonly string[] = [],
): MaterialAuthority {
  const intent = typeof answers?.materialIntent === "string" ? answers.materialIntent.trim() : "";
  const titles = verifiedArtifacts.map((t) => t.trim()).filter((t) => t.length > 0);
  const exists = [...(intent ? [intent] : []), ...titles];
  return { exists, contentsVerified: false };
}

/**
 * The prompt's material section. Positive first — what the model MAY do — because the
 * refused attempt proves prohibitions alone leave it guessing.
 *
 * Deliberately generic: it never mentions handoffs, records or any other subject. A
 * training with no materials at all and a training with three uploaded files both get an
 * honest statement of the same rule.
 */
export function materialAuthorityBrief(auth: MaterialAuthority): string[] {
  const lines: string[] = ["MATERIAL AUTHORITY — what you may say about materials:"];
  if (auth.exists.length === 0) {
    lines.push("- There is NO material of any kind. Do not refer to one, and do not imply one is coming.");
  } else {
    lines.push(
      `- The host has named: ${auth.exists.join(", ")}. That is proof it EXISTS and nothing else.`,
      "- Its CONTENTS have not been read by this system and are not available to you. You cannot know what it says, teaches, shows, lists or requires.",
      "- So never attribute content to it — not 'the video explains…', not 'as described in the document', not 'the five steps covered in the material'.",
      "- You may leave it out of the program entirely. That is the honest choice when you cannot use it truthfully.",
    );
  }
  lines.push(
    "- No template, checklist, worksheet, form, tool, guide or system is available to anyone. Write the program as if none exists, because none does.",
    "- WHAT YOU MAY DO INSTEAD — this is the intended path, not a fallback: the program is SELF-CONTAINED. Build the whole training from what the host told you.",
    "- A record, checklist or standard may be an OUTPUT the participant CREATES during the training: 'agree which three items every handover must include, and write them down'. That is a future action, and it is always allowed.",
    "- What is forbidden is the opposite framing — telling a participant to USE, COMPLETE, FOLLOW or REFER TO something as if it were already in their hands.",
    "- 'Create a handoff record that names the owner, the next action and how completion is confirmed' — ALLOWED. 'Use the provided handoff template' — FORBIDDEN. The difference is who makes it and when.",
  );
  return lines;
}

export function groundingCorpus(answers: BuilderAnswers | undefined, verifiedArtifacts: readonly string[] = []): string {
  const a = answers ?? {};
  const parts = [
    a.problem, a.observableBehavior, a.successEvidence, a.capabilityCandidate,
    a.audienceDetail, a.sharedQuestion, a.completionPrompt,
    ...verifiedArtifacts,
  ];
  return parts.filter((v): v is string => typeof v === "string").join(" \n ").toLowerCase();
}

/**
 * The first artifact this text claims exists without grounding, or null.
 *
 * Returns the offending head noun so a refusal can be diagnosed without echoing the
 * generated prose back into logs.
 */
export function ungroundedArtifact(text: string, corpus: string): string | null {
  return ungroundedExistingEntity(text, corpus);
}

/**
 * CONTENT ATTRIBUTION TO AN UNREAD MATERIAL (Slice 3.2L-R11.4G).
 *
 * `ungroundedArtifact` catches a claim that something EXISTS. It does not catch a claim
 * about what is INSIDE something whose existence is real — "the video explains the five
 * required steps" names no ungrounded artifact, because the link genuinely exists, and
 * "video" is deliberately not an artifact noun (adding it would refuse "the video call").
 * The claim is still false: this system has never read the material.
 *
 * So the rule targets attribution, not mention. A program may say the material exists and
 * may point at it; it may not speak for it.
 */
const MATERIAL_SOURCES = "video|recording|webinar|clip|footage|document|file|pdf|link|material|materials|article|slides|deck|handout|reading";
const ATTRIBUTION_VERBS =
  "says|state[sd]?|explains?|explained|teaches|taught|shows?|showed|covers?|covered|describes?|described|outlines?|outlined|lists?|listed|demonstrates?|demonstrated|walks? through|contains?|contained|includes?|included|recommends?|recommended|specifies|specified|details|detailed|introduces?|introduced";
const MATERIAL_CONTENT_CLAIM = [
  // "the video explains …", "this document lists …"
  new RegExp(`\\b(?:the|this|that|our|your|their)\\s+(?:[\\w'-]+\\s+){0,2}(?:${MATERIAL_SOURCES})\\s+(?:${ATTRIBUTION_VERBS})\\b`, "i"),
  // "as described in the video", "covered in the material"
  new RegExp(`\\b(?:${ATTRIBUTION_VERBS})\\s+in\\s+(?:the|this|that)\\s+(?:[\\w'-]+\\s+){0,2}(?:${MATERIAL_SOURCES})\\b`, "i"),
  // "according to the video"
  new RegExp(`\\baccording to\\s+(?:the|this|that)\\s+(?:[\\w'-]+\\s+){0,2}(?:${MATERIAL_SOURCES})\\b`, "i"),
];

/**
 * An UPLOAD does not unlock its contents either. The application stores a file's title and
 * nothing else, so "the handoff template lists the four required fields" invents contents
 * for a real file just as surely as the video claim invents them for a real link.
 *
 * Applied only to prescriptive artifacts (a template, a checklist, a policy), never to the
 * things a participant MAKES — a record, a log, a note. And a creation frame in the same
 * sentence exempts it, so "agree which three items the checklist must include" survives:
 * that is CASE F, the learner writing one, not a claim about one they were handed.
 */
const PRESCRIPTIVE_ARTIFACTS =
  "template|templates|checklist|checklists|form|forms|policy|policies|guide|guides|manual|manuals|sop|sops|playbook|playbooks|handbook|handbooks|protocol|protocols|worksheet|worksheets|procedure|procedures";
const PRESCRIPTIVE_CONTENT_CLAIM = new RegExp(
  `\\b(?:the|this|that|our|your|their)\\s+(?:[\\w'-]+\\s+){0,2}(?:${PRESCRIPTIVE_ARTIFACTS})\\s+(?:${ATTRIBUTION_VERBS})\\b`,
  "i",
);

/**
 * True when the text speaks for a material this system has never read.
 *
 * Verified CONTENT authority does not exist anywhere in this product, so there is no
 * corpus that could ground such a claim — the answer does not depend on what the Host
 * supplied. `deriveMaterialAuthority().contentsVerified` is the seam that would change
 * that, and it is permanently false today.
 */
export function claimsMaterialContent(text: string): boolean {
  if (MATERIAL_CONTENT_CLAIM.some((re) => re.test(text))) return true;
  const m = PRESCRIPTIVE_CONTENT_CLAIM.exec(text);
  if (!m) return false;
  // Creation framing anywhere in the surrounding sentence — the participant is making it.
  const around = text.slice(Math.max(0, m.index - 70), Math.min(text.length, m.index + m[0].length + 70));
  return !CREATION_FRAME.test(around);
}

/** Invented concrete specifics the Host never supplied. */
const INVENTED_SPECIFICS = [
  /\bsection \d+(\.\d+)*\b/i,
  /\bpolicy (?:no\.?|number|#)\s*\d+/i,
  /\bform [A-Z]{1,4}-?\d+/,
  /\bper (?:the )?\d{4} (?:policy|guideline|standard|regulation)/i,
  /\b(?:last|this) (?:tuesday|monday|wednesday|thursday|friday|saturday|sunday)\b/i,
];

/** Language that judges a person rather than describing an action. */
const PERSON_EVALUATION = [
  /\b(lazy|careless|incompetent|unmotivated|disloyal|untrustworthy|difficult employee)\b/i,
  /\b(?:poor|bad|weak) (?:attitude|character|work ethic)\b/i,
  /\bnot (?:committed|loyal|dedicated) (?:to|enough)\b/i,
];

/** Builder/architecture vocabulary that must never reach a participant. */
const INTERNAL_JARGON = [
  /\bevidence ladder\b/i, /\bcapability candidate\b/i, /\bobservable behavio(u)?r field\b/i,
  /\bmodule (?:snapshot|draft)\b/i, /\bbuilder step\b/i, /\blearning need[s]?\b/i,
  /\bjourney element\b/i, /\bcompletion prompt field\b/i, /\bsuccess evidence field\b/i,
];

const GENERIC_COMPLETION = [
  /one thing you(?:'ll| will)? (?:apply|do|try)/i,
  /what did you learn/i,
  /how (?:did|do) you feel/i,
  /^\s*summar/i,
];
const WH_WORD = /\b(what|which|how|when|where|who|whom|why)\b|무엇|무슨|어떤|어떻게|언제|어디|누구|왜/i;

/** A decision must commit to an action, not merely invite reflection. */
const DECISION_COMMITMENT = /\b(will|commit|choose|decide|select|pick|agree to|going to|plan to)\b|하겠|선택|결정|약속/i;
const ONLY_REFLECTION = /^\s*(?:think about|reflect on|consider|ponder|contemplate)\b/i;

/** Field application must name someone doing something somewhere. */
const APPLICATION_ACTOR = /\b(you|your team|each|every|the|when|during|before|after|at the|in the)\b|당신|팀|각|모든/i;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

type Clean = { ok: true; value: string } | { ok: false; code: ProgramRejectCode };

function cleanString(v: unknown, max: number, min = 1): Clean {
  if (typeof v !== "string") return { ok: false, code: "field_type" };
  if (hasUnsafeMarkup(v)) return { ok: false, code: "unsafe_markup" };
  const n = v.replace(/[ \t]+/g, " ").trim();
  if (n.length === 0) return { ok: false, code: "empty_field" };
  if (n.length < min) return { ok: false, code: "empty_field" };
  if (n.length > max) return { ok: false, code: "too_long" };
  return { ok: true, value: n };
}

function cleanList(v: unknown, max: number, code: ProgramRejectCode): { ok: true; value: string[] } | { ok: false; code: ProgramRejectCode } {
  if (v === undefined || v === null) return { ok: true, value: [] };
  if (!Array.isArray(v) || v.length > MAX_LIST) return { ok: false, code };
  const out: string[] = [];
  for (const item of v) {
    const c = cleanString(item, max);
    if (!c.ok) return { ok: false, code };
    out.push(c.value);
  }
  return { ok: true, value: out };
}

/** Overlap ratio of significant words — used for complaint replay and contradiction. */
function overlapRatio(a: string, b: string): number {
  const words = (s: string) =>
    new Set(
      norm(s)
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3),
    );
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.min(wa.size, wb.size);
}

// ---------------------------------------------------------------------------
// Provider-facing strict JSON Schema (Slice 3.2L-R3)
// ---------------------------------------------------------------------------

export const PROGRAM_SCHEMA_NAME = "bty_guided_program_v8";

/**
 * The shape the provider must return, enforced by the transport rather than hoped for in
 * prose. The practice arc already proved this pattern (Slice 3.2I-R2.16): a provider that
 * cannot honour the schema fails CLOSED, never silently downgraded to unconstrained JSON.
 *
 * `strict: true` requires every property to appear in `required` and
 * `additionalProperties: false` everywhere — so `rationale`, which is advisory, is typed
 * as nullable rather than omitted. The domain treats null exactly as absent.
 *
 * Element ORDER and WHICH kinds are required stay in the domain: they depend on the Host's
 * learning design, and a JSON Schema cannot express "scenario is required only when this
 * draft asks for practice".
 */
export const PROGRAM_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["program"],
  properties: {
    program: {
      type: "object",
      additionalProperties: false,
      required: ["display_title", "elements", "assumptions", "warnings", "behavior_contract", "scenario_contract", "completion_contract", "follow_up_contract"],
      properties: {
        display_title: { type: "string" },
        assumptions: { type: "array", items: { type: "string" } },
        warnings: { type: "array", items: { type: "string" } },
        /**
         * The behavioral contract THE STANDARD is rendered from (Slice 3.2L-R4).
         *
         * PROGRAM-LEVEL, not per-element, and deliberately so. A program has exactly one
         * `observable_standard`, so there is no ambiguity about which element it belongs
         * to — and hanging a nullable object off every element instead would make the
         * elements array non-uniform for the sake of one kind, which strict mode handles
         * badly and reviewers read worse.
         */
        behavior_contract: {
          type: "object",
          additionalProperties: false,
          required: ["actor", "trigger", "observable_action", "completion"],
          properties: {
            actor: { type: "string" },
            trigger: { type: "string" },
            observable_action: { type: "string" },
            /**
             * WHO confirms and WHAT they are seen doing (Slice 3.2L-R8). A single free-text
             * completion_signal let the model return a bare infinitive, and the renderer
             * pasted it after "It is complete when …". A named confirmer makes the sentence's
             * subject structural instead of hoped for.
             */
            completion: {
              type: "object",
              additionalProperties: false,
              required: ["confirmed_by", "confirmation_action"],
              properties: {
                confirmed_by: { type: "string" },
                confirmation_action: { type: "string" },
              },
            },
          },
        },
        /**
         * What the behavior contract cannot supply: what makes the moment hard, and where
         * it happens. IN CONTEXT is rendered from BOTH contracts, so the scenario is
         * relevant by construction rather than by sharing a word with the Host's problem.
         *
         * NULLABLE, because a `know`-only design requires no scenario. Strict mode needs
         * every property in `required`, so absence is expressed as null — the same pattern
         * `rationale` already uses. The DOMAIN decides when null is acceptable; a JSON
         * Schema cannot express "required only when this draft asks for practice".
         */
        /**
         * TRIGGER-ANCHORED (Slice 3.2L-R8.1). `context_detail` is GONE: the scenario no
         * longer owns a moment, only the difficulty of holding the behaviour at the one
         * moment the behaviour contract already named. `pressure_detail` is nullable
         * because most situations need a single condition, not two.
         */
        scenario_contract: {
          type: ["object", "null"],
          additionalProperties: false,
          required: ["pressure_condition", "pressure_detail"],
          properties: {
            pressure_condition: { type: "string" },
            pressure_detail: { type: ["string", "null"] },
          },
        },
        /**
         * APPLY IT and YOUR DECISION. Actor and observable action are INHERITED from the
         * behavior contract and deliberately NOT re-authored here — three independently
         * written versions of the same action is exactly how the live programs drifted.
         */
        /*
          NO application_contract (Slice 3.2L-R10-A). v8 let the model author its own first
          moment and BTY checked afterwards that it overlapped the trigger — the v8 live
          window died on that check, and the audit showed it cannot separate a paraphrased
          instance from an unrelated event. The first instance is now DERIVED from the
          trigger, so a second occasion is not something this response can carry.
        */
        completion_contract: {
          type: ["object", "null"],
          additionalProperties: false,
          required: ["verification_target", "response_mode"],
          properties: {
            verification_target: { type: "string", enum: ["the_behaviour", "the_application_plan", "the_confirmation_step"] },
            response_mode: { type: "string", enum: ["name_the_moment", "state_what_you_will_say", "name_what_could_stop_you"] },
          },
        },
        /**
         * WHAT HAPPENS NEXT — ENUMS ONLY, and the window comes from canonical context, not
         * from the model, so a follow-up cannot invent a schedule, a construct or an action.
         */
        follow_up_contract: {
          type: ["object", "null"],
          additionalProperties: false,
          required: ["review_focus", "confirmer"],
          properties: {
            review_focus: { type: "string", enum: ["what_you_said", "what_happened_next", "the_confirmation"] },
            confirmer: { type: "string", enum: ["self_report", "the_other_person", "the_host"] },
          },
        },
        elements: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["kind", "content", "rationale"],
            properties: {
              kind: { type: "string", enum: [...JOURNEY_KIND_ORDER] },
              content: { type: "string" },
              // Advisory: the model may return null, and the domain reads null as absent.
              rationale: { type: ["string", "null"] },
            },
          },
        },
      },
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Structural diagnosis (Slice 3.2L-R3)
// ---------------------------------------------------------------------------

/**
 * THE LIVE FAILURE. The fourth controlled window burned BOTH provider calls on the same
 * structural fault and never reached a single safety rule:
 *
 *   outcome validation_refused · refusal_code field_type · refusal_kind why_it_matters
 *   call 1 schema_invalid · call 2 schema_invalid
 *
 * `field_type` says only "some value was not a string". TWO paths inside one element can
 * emit it — `content` and `rationale` — and `refusal_kind` carries a Journey kind, so it
 * cannot name which. Title, assumptions, warnings and the evidence ceiling reject with no
 * kind at all. The retry was handed the CODE and nothing else, so the model could not
 * know which field to fix, and the second call failed identically.
 *
 * A diagnosis names the exact path and the type actually received, so the repair call can
 * be targeted and the next live failure is readable without ever storing model prose.
 */
export type JsonType = "missing" | "null" | "string" | "object" | "array" | "number" | "boolean";

export type StructuralDiagnosis = {
  /** Which gate refused: a shape fault, or a meaning fault. */
  stage: "structural" | "semantic";
  /** Exact location, e.g. `elements[0].content`. Never contains model prose. */
  path: string;
  expected: string;
  actual: JsonType;
  /** Whether one targeted repair call could plausibly fix it. */
  retryable: boolean;
};

export function jsonTypeOf(v: unknown): JsonType {
  if (v === undefined) return "missing";
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v as JsonType;
}

/**
 * A shape fault is repairable; a meaning fault is not. Asking the model again to "be
 * honest" after it fabricated a template just spends a second call — the semantic
 * refusals deliberately do NOT retry.
 */
const STRUCTURAL_CODES: readonly ProgramRejectCode[] = [
  "not_object", "missing_program", "missing_field", "field_type", "empty_field", "too_long",
  "unknown_kind", "duplicate_kind", "missing_required_kind", "unrequested_kind",
  "invalid_assumptions", "invalid_warnings",
];

export function isStructuralCode(code: ProgramRejectCode): boolean {
  return STRUCTURAL_CODES.includes(code);
}

/** One human-readable repair instruction — shape only, never the model's own words. */
export function repairInstruction(d: StructuralDiagnosis): string {
  if (d.actual === "missing") return `${d.path} is required but was missing. It must be ${d.expected}.`;
  return `${d.path} must be ${d.expected}, but was ${d.actual}.`;
}

// ---------------------------------------------------------------------------
// Validator — fail-closed, whole-proposal rejection
// ---------------------------------------------------------------------------

const REJECT = (code: ProgramRejectCode, kind?: JourneyElementKind): ProgramValidation => ({ ok: false, code, kind });

/** Refuse with an exact path + received type, so the repair call can be targeted. */
const REJECT_AT = (
  code: ProgramRejectCode,
  path: string,
  expected: string,
  actual: JsonType,
  kind?: JourneyElementKind,
): ProgramValidation => ({
  ok: false,
  code,
  kind,
  diagnosis: { stage: "structural", path, expected, actual, retryable: isStructuralCode(code) },
});

/**
 * Validate one raw parsed provider program against the Host's actual context.
 *
 * Fail-closed and whole-proposal: any structural, safety, honesty or coherence failure
 * rejects everything with a stable code. A partially-valid program is not applied,
 * because a Host reviewing eight sections cannot be expected to notice that the third
 * one silently fabricated a policy number.
 */
export function validateProgramProposal(
  raw: unknown,
  answers: BuilderAnswers | undefined,
  /** Identities of materials the application has VERIFIED (e.g. uploaded file titles). */
  verifiedArtifacts: readonly string[] = [],
): ProgramValidation {
  if (!isPlainObject(raw)) return REJECT_AT("not_object", "$", "object", jsonTypeOf(raw));
  const p = raw.program;
  if (!isPlainObject(p)) return REJECT_AT("missing_program", "program", "object", jsonTypeOf(p));
  // `evidence_language` is no longer requested: BTY derives the ceiling itself (R8).
  for (const k of ["display_title", "elements"]) {
    if (!(k in p)) return REJECT_AT("missing_field", `program.${k}`, k === "elements" ? "array" : "string", "missing");
  }

  const title = cleanString(p.display_title, LIMITS.title, 4);
  if (!title.ok) return REJECT_AT(title.code, "program.display_title", "string", jsonTypeOf(p.display_title));

  /**
   * DERIVED, never authored (Slice 3.2L-R8). The live v5 program displayed the honest
   * static ceiling — "A written answer shows reflection, not competence" — beside the
   * model's own claim that completing it shows "you are equipped to implement a shared
   * handoff standard". Both on one screen. A ceiling the model can write is not a ceiling.
   */
  const evidenceLanguage = { ok: true as const, value: deriveEvidenceCeiling(answers) };

  if (!Array.isArray(p.elements) || p.elements.length === 0) {
    return REJECT_AT("field_type", "program.elements", "non-empty array", jsonTypeOf(p.elements));
  }

  const ctx = programContext(answers);
  const required = requiredProgramKinds(answers);
  const corpus = groundingCorpus(answers, verifiedArtifacts);

  /**
   * Every safety rule, applied to EVERY generated string.
   *
   * The live miss slipped through an advisory field: `assumptions`, `warnings` and each
   * section's `rationale` previously received only markup and length checks, so
   * "There is access to the necessary tools and templates" was never examined. An
   * advisory field cannot bypass a safety rule merely because it is not written into the
   * draft — the Host still reads it, and it still justifies the program.
   */
  const unsafe = (text: string): ProgramRejectCode | null => {
    if (assertsOverclaim(text)) return "evidence_overclaim";
    if (MATERIAL_EXISTS.some((re) => re.test(text))) return "material_fabrication";
    // Speaking for a material nobody read (Slice 3.2L-R11.4G) — a content claim, not an
    // existence claim, so the grounding corpus cannot and must not rescue it.
    if (claimsMaterialContent(text)) return "material_fabrication";
    // Invented specifics first: "section 4.2 of the policy" is BOTH, and the more precise
    // diagnosis is the more useful one to record and to show.
    if (INVENTED_SPECIFICS.some((re) => re.test(text))) return "invented_specifics";
    if (ungroundedArtifact(text, corpus) !== null) return "material_fabrication";
    if (PERSON_EVALUATION.some((re) => re.test(text))) return "person_evaluation";
    if (INTERNAL_JARGON.some((re) => re.test(text))) return "internal_jargon";
    return null;
  };
  const allowed = new Set<JourneyElementKind>([...required, "evidence", "reflection"]);

  /**
   * THE BEHAVIORAL CONTRACT (Slice 3.2L-R4), validated BEFORE any element, because
   * `observable_standard`'s participant-facing sentence is rendered from it.
   *
   * A missing or wrong-typed contract is a SHAPE fault and repairable — the model can be
   * told exactly which field was wrong. A contract that is present and well-typed but
   * describes no observable behavior is a MEANING fault, and asking again does not fix
   * meaning, so it refuses without a repair call.
   */
  const rawContract = (p as Record<string, unknown>).behavior_contract;
  if (rawContract === undefined || rawContract === null) {
    return REJECT_AT("missing_field", "program.behavior_contract", "an object with actor, trigger, observable_action and completion_signal", jsonTypeOf(rawContract), "observable_standard");
  }
  if (!isPlainObject(rawContract)) {
    return REJECT_AT("field_type", "program.behavior_contract", "an object", jsonTypeOf(rawContract), "observable_standard");
  }
  for (const key of ["actor", "trigger", "observable_action"] as const) {
    const v = (rawContract as Record<string, unknown>)[key];
    if (typeof v !== "string") {
      return REJECT_AT("field_type", `program.behavior_contract.${key}`, `a non-empty string of at most ${CONTRACT_FIELD_LIMIT} characters`, jsonTypeOf(v), "observable_standard");
    }
    // The contract is rendered into participant-facing text, so it carries the SAME
    // honesty rules as any other content — a fabricated template cannot enter through it.
    const bad = unsafe(v);
    if (bad) return REJECT(bad, "observable_standard");
  }
  /** The completion authority is an OBJECT now: a named confirmer plus what they do (R8). */
  const rawCompletion = (rawContract as Record<string, unknown>).completion;
  if (!isPlainObject(rawCompletion)) {
    return REJECT_AT(rawCompletion === undefined || rawCompletion === null ? "missing_field" : "field_type", "program.behavior_contract.completion", "an object with confirmed_by and confirmation_action", jsonTypeOf(rawCompletion), "observable_standard");
  }
  for (const key of ["confirmed_by", "confirmation_action"] as const) {
    const v = (rawCompletion as Record<string, unknown>)[key];
    if (typeof v !== "string") {
      return REJECT_AT("field_type", `program.behavior_contract.completion.${key}`, `a non-empty string of at most ${CONTRACT_FIELD_LIMIT} characters`, jsonTypeOf(v), "observable_standard");
    }
    const bad = unsafe(v);
    if (bad) return REJECT(bad, "observable_standard");
  }
  const contractResult = validateBehaviorContract(rawContract);
  // A well-formed contract that states no behavior. Not retryable: the shape was right.
  if (!contractResult.ok) {
    // The defect travels with the refusal so the ledger records WHICH of the four roles
    // failed and why — the gap that made the R6 window undiagnosable.
    return { ...REJECT("non_observable_standard", "observable_standard"), contract: contractResult.defect } as ProgramValidation;
  }
  const contract: BehaviorContract = contractResult.value;

  /**
   * THE SCENARIO CONTRACT (Slice 3.2L-R5). Required exactly when the Host's design asks
   * for a scenario, and ignored otherwise — a `know`-only program rehearses nothing, and
   * demanding a pressure for a scenario that will not exist would be fabrication.
   */
  const scenarioRequired = required.includes("scenario");
  const rawScenario = (p as Record<string, unknown>).scenario_contract;
  let scenarioContract: ScenarioContract | null = null;
  if (scenarioRequired) {
    if (rawScenario === undefined || rawScenario === null) {
      return REJECT_AT("missing_field", "program.scenario_contract", "an object with pressure_condition and pressure_detail", jsonTypeOf(rawScenario), "scenario");
    }
    if (!isPlainObject(rawScenario)) {
      return REJECT_AT("field_type", "program.scenario_contract", "an object", jsonTypeOf(rawScenario), "scenario");
    }
    for (const key of ["pressure_condition", "pressure_detail"] as const) {
      const v = (rawScenario as Record<string, unknown>)[key];
      // `pressure_detail` is genuinely optional; only its type is enforced here.
      if (v === null || v === undefined) {
        if (key === "pressure_detail") continue;
        return REJECT_AT("missing_field", `program.scenario_contract.${key}`, `a non-empty string of at most ${SCENARIO_FIELD_LIMIT} characters`, jsonTypeOf(v), "scenario");
      }
      if (typeof v !== "string") {
        return REJECT_AT("field_type", `program.scenario_contract.${key}`, `a non-empty string of at most ${SCENARIO_FIELD_LIMIT} characters`, jsonTypeOf(v), "scenario");
      }
      // Rendered into participant-facing text, so it carries the same honesty rules.
      const bad = unsafe(v);
      if (bad) return REJECT(bad, "scenario");
    }
    const sc = validateScenarioContract(rawScenario, contract);
    /*
      Two distinct meaning faults, reported as two. A situation with no difficulty teaches
      nothing; a situation with its own occasion moves the trained action somewhere the
      standard never asked for. Collapsing the second into the first would hand the Host a
      refusal reason that is simply untrue about their program (Slice 3.2L-R8.1).
    */
    if (!sc.ok) {
      return REJECT(
        sc.defect.reason === "independent_moment" ? "scenario_independent_moment" : "scenario_without_pressure",
        "scenario",
      );
    }
    scenarioContract = sc.value;
  }

  /**
   * THE CANONICAL CONSTRUCT — system-derived from the Host's own answers, never asserted by
   * the model. `authorityMode` is a claim about the world, and a model has no standing to
   * make one: "Create a shared handoff standard" authorises BTY to PROPOSE the standard and
   * says nothing about it existing, being approved, or having fields.
   */
  const operationalConstruct: OperationalConstruct | null = deriveOperationalConstruct(
    {
      observableBehavior: answers?.observableBehavior,
      successEvidence: answers?.successEvidence,
      capabilityCandidate: answers?.capabilityCandidate,
      problem: answers?.problem,
    },
    verifiedArtifacts,
  );

  /**
   * APPLY IT / YOUR DECISION authority — DERIVED, not read (Slice 3.2L-R10-A).
   *
   * The model no longer sends an application contract; the first real chance to do the
   * behaviour is the next occurrence of the trigger it already established. If that
   * trigger does not express recurrence, no honest "next one" exists and the program is
   * refused here — before review — rather than shipped with a moment somebody invented.
   */
  const applicationRequired = required.includes("field_application") || required.includes("action_decision");
  let applicationContract: ApplicationContract | null = null;
  if (applicationRequired) {
    const first = deriveFirstApplicationMoment(contract.trigger);
    if (!first.ok) return REJECT("trigger_not_recurring", "observable_standard");
    applicationContract = { applicationMoment: first.value };
  }

  /** BEFORE YOU FINISH authority — enumerated, so it cannot define anything. */
  let completionContract: CompletionContract | null = null;
  if (required.includes("completion_check")) {
    const raw2 = (p as Record<string, unknown>).completion_contract;
    if (!isPlainObject(raw2)) {
      return REJECT_AT(raw2 === undefined || raw2 === null ? "missing_field" : "field_type", "program.completion_contract", "an object with verification_target and response_mode", jsonTypeOf(raw2), "completion_check");
    }
    const vt = (raw2 as Record<string, unknown>).verification_target;
    const rm = (raw2 as Record<string, unknown>).response_mode;
    if (!isVerificationTarget(vt)) return REJECT_AT("field_type", "program.completion_contract.verification_target", "one of the allowed verification targets", jsonTypeOf(vt), "completion_check");
    if (!isResponseMode(rm)) return REJECT_AT("field_type", "program.completion_contract.response_mode", "one of the allowed response modes", jsonTypeOf(rm), "completion_check");
    completionContract = { verificationTarget: vt, responseMode: rm };
  }

  /** WHAT HAPPENS NEXT authority — enumerated; the window comes from context. */
  let followUpContract: FollowUpContract | null = null;
  if (required.includes("follow_up")) {
    const raw3 = (p as Record<string, unknown>).follow_up_contract;
    if (!isPlainObject(raw3)) {
      return REJECT_AT(raw3 === undefined || raw3 === null ? "missing_field" : "field_type", "program.follow_up_contract", "an object with review_focus and confirmer", jsonTypeOf(raw3), "follow_up");
    }
    const rf = (raw3 as Record<string, unknown>).review_focus;
    const cf = (raw3 as Record<string, unknown>).confirmer;
    if (!isReviewFocus(rf)) return REJECT_AT("field_type", "program.follow_up_contract.review_focus", "one of the allowed review focuses", jsonTypeOf(rf), "follow_up");
    if (!isConfirmer(cf)) return REJECT_AT("field_type", "program.follow_up_contract.confirmer", "one of the allowed confirmers", jsonTypeOf(cf), "follow_up");
    followUpContract = { reviewFocus: rf, confirmer: cf };
  }

  /**
   * DERIVED-LENGTH BACKSTOP. Each contract field is individually bounded, but a rendered
   * sentence concatenates several of them, so the element ceiling is an invariant of the
   * arithmetic rather than of any one check. Asserting it here makes it explicit and
   * refuses honestly instead of shipping an over-long section — and never truncates, which
   * would silently drop the completion signal off the end.
   */
  for (const [path, text] of [
    ["program.behavior_contract", renderStandardSentence(contract)],
    ...(scenarioContract ? [["program.scenario_contract", renderScenarioSentence(contract, scenarioContract)] as const] : []),
  ] as const) {
    if (text.length > LIMITS.content) {
      return REJECT_AT("too_long", path, `fields short enough to render within ${LIMITS.content} characters`, "string");
    }
  }

  /** The derived participant-facing text for an instructional kind, or null for narrative. */
  const deriveContent = (kind: JourneyElementKind): string | null => {
    // WHY THIS MATTERS is rendered from the Host's own problem and the behaviour contract
    // (Slice 3.2L-R9), so the model's prose for it is discarded like the instructional ones.
    if (kind === "why_it_matters" && ctx && ctx.problemStatement.trim().length > 0) {
      return renderRationaleSentence(ctx.problemStatement, contract, operationalConstruct);
    }
    if (kind === "observable_standard") return renderStandardSentence(contract);
    if (kind === "scenario" && scenarioContract) return renderScenarioSentence(contract, scenarioContract);
    if (kind === "action_decision" && applicationContract) return renderDecisionSentence(contract, applicationContract);
    if (kind === "field_application" && applicationContract) return renderApplicationSentence(contract, applicationContract, operationalConstruct);
    if (kind === "completion_check" && completionContract) return renderCompletionQuestion(contract, completionContract);
    if (kind === "follow_up" && followUpContract) return renderFollowUpSentence(contract, followUpContract, ctx?.followUpDays ?? 0);
    return null;
  };

  const seen = new Set<JourneyElementKind>();
  const elements: ProposedElement[] = [];

  for (let i = 0; i < p.elements.length; i++) {
    const rawEl = p.elements[i];
    const at = (f: string) => `elements[${i}].${f}`;
    if (!isPlainObject(rawEl)) return REJECT_AT("field_type", `elements[${i}]`, "object", jsonTypeOf(rawEl));
    const kind = rawEl.kind as JourneyElementKind;
    if (!JOURNEY_KIND_ORDER.includes(kind)) return REJECT_AT("unknown_kind", at("kind"), "a known program section", jsonTypeOf(rawEl.kind));
    if (seen.has(kind)) return REJECT("duplicate_kind", kind);
    if (!allowed.has(kind)) return REJECT("unrequested_kind", kind);
    seen.add(kind);

    // PROGRAM-REQUIRED: this is the participant-facing sentence itself.
    const content = cleanString(rawEl.content, LIMITS.content, MIN_CONTENT);
    if (!content.ok) return REJECT_AT(content.code, at("content"), `a string of at least ${MIN_CONTENT} characters`, jsonTypeOf(rawEl.content), kind);

    /**
     * REVIEW-ADVISORY, decided from measured usage — not to reduce refusals. `rationale`
     * is rendered once in the Host's review panel and NOWHERE else: zero references in
     * `applyProgramProposal`, zero in the Journey contract, zero in the publish snapshot.
     * A learner never sees it. Losing an otherwise-valid seven-section program because one
     * advisory line came back null is a bad trade, so absence is accepted deterministically
     * — and nothing is fabricated in its place.
     *
     * Present-but-wrong-type is still a structural fault: a rationale that is an object is
     * a shape error the model can repair, not an intentional omission.
     */
    let rationaleText = "";
    if (rawEl.rationale !== undefined && rawEl.rationale !== null) {
      const r = cleanString(rawEl.rationale, LIMITS.rationale, 1);
      if (!r.ok) return REJECT_AT(r.code, at("rationale"), "a string, or omitted", jsonTypeOf(rawEl.rationale), kind);
      rationaleText = r.value;
    }
    const rationale = { ok: true as const, value: rationaleText };

    /**
     * ONE SOURCE OF TRUTH. THE STANDARD the Host reads is RENDERED from the validated
     * contract; the model's own sentence for that kind is discarded. It is still required
     * by the schema (the elements array stays uniform), and it still has to pass the
     * string checks above — but it cannot become the displayed standard, so the displayed
     * standard can never say something the structured contract does not.
     */
    /**
     * ONE BEHAVIOURAL AUTHORITY, SIX VIEWS. Every INSTRUCTIONAL section is rendered from
     * the contracts; the model's own sentence for those kinds is still schema-required and
     * still safety-checked, but it cannot become the displayed text. WHY THIS MATTERS and
     * the other narrative kinds keep the model's prose.
     */
    const c = deriveContent(kind) ?? content.value;

    // --- honesty (participant-facing content AND its Host-facing rationale) ---
    /**
     * Checked on the DISPLAYED content and, when they differ, on the model's discarded
     * original too. THE STANDARD's sentence is replaced by the rendered contract, and
     * dropping the honesty check with it would mean a model that fabricated a template
     * there was quietly ignored rather than refused. Nothing dishonest could reach the
     * Host either way — but fail-closed means refusing the proposal, not editing around it.
     */
    /*
      ONE EXCEPTION, ADDED DELIBERATELY (Slice 3.2L-R9). The discarded original is still
      checked for fabrication, invented specifics, person evaluation and jargon — a model
      that invents a template here would likely invent one elsewhere. But an OUTCOME CLAIM
      in text that is never displayed cannot mislead anyone, and refusing a whole paid
      window over an invisible sentence is the wrong trade. The derivation is what makes
      the claim unreachable; the gate stays where prose still reaches a participant —
      assumptions, warnings, the title and any Host-edited narrative.
    */
    const discarded = c === content.value ? null : content.value;
    const discardedUnsafe = discarded === null ? null : unsafe(discarded);
    const contentUnsafe = unsafe(c) ?? (discardedUnsafe === "evidence_overclaim" ? null : discardedUnsafe);
    if (contentUnsafe) return REJECT(contentUnsafe, kind);
    // Safety still applies to a rationale whenever one is PRESENT — advisory does not
    // mean unchecked; it only means absence is tolerated.
    if (rationale.value.length > 0) {
      const rationaleUnsafe = unsafe(rationale.value);
      if (rationaleUnsafe) return REJECT(rationaleUnsafe, kind);
    }

    // --- per-kind meaning ------------------------------------------------
    if (kind === "why_it_matters" && ctx && c === content.value) {
      /*
        The manager's complaint replayed at the team is the R2F defect this closes — and it
        applies to MODEL PROSE only. The derived rationale opens on the Host's problem by
        design and then says what the program introduces about it, which is the opposite of
        a bare replay (Slice 3.2L-R9).
      */
      if (overlapRatio(c, ctx.problemStatement) >= 0.8) return REJECT("complaint_replay", kind);
    }
    // `observable_standard` needs no per-kind text gate: its content IS the validated
    // contract, rendered. The word-count check this replaces measured nothing about
    // observability — the live meta-standard cleared it by twelve words.
    if (kind === "action_decision") {
      if (ONLY_REFLECTION.test(c) || !DECISION_COMMITMENT.test(c)) return REJECT("decision_is_only_reflection", kind);
    }
    if (kind === "field_application") {
      if (!APPLICATION_ACTOR.test(c)) return REJECT("application_without_actor", kind);
    }
    /**
     * The lexical `scenario_unrelated` gate is GONE (Slice 3.2L-R5). It asked whether the
     * scenario shared one >3-character token with a two-to-four word reference, with no
     * stemming — so `handover` failed where `handoff` passed, and an unrelated sentence
     * containing "standard" would have passed. It produced a live false negative on a
     * valid program. Relevance is now structural: IN CONTEXT is rendered FROM the behavior
     * contract, so it cannot be about a different behavior.
     */
    if (kind === "completion_check") {
      if (!WH_WORD.test(c) || GENERIC_COMPLETION.some((re) => re.test(c))) return REJECT("generic_completion", kind);
    }

    elements.push({ kind, content: c, rationale: rationale.value });
  }

  // --- completeness against the Host's own learning design ---------------
  for (const kind of required) if (!seen.has(kind)) return REJECT("missing_required_kind", kind);

  // --- cross-section coherence -------------------------------------------
  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      if (norm(elements[i].content) === norm(elements[j].content)) return REJECT("duplicate_content", elements[j].kind);
    }
  }
  const standard = elements.find((e) => e.kind === "observable_standard");
  const decision = elements.find((e) => e.kind === "action_decision");
  if (standard && decision && overlapRatio(standard.content, decision.content) < 0.05) {
    // A decision that shares no vocabulary with the standard is about something else.
    return REJECT("section_contradiction", "action_decision");
  }

  /**
   * ORDERED DEPENDENCY GRAPH (Slice 3.2L-R4). The two rules above are lexical and treat
   * the program as seven independent strings; the live defect was a relationship BETWEEN
   * sections — use the standard at the next handoff, then ask at the end what the standard
   * should contain. Nothing that reads one section at a time can see that.
   */
  const dependency = validateProgramDependencies(
    elements.map((e): ProgramSection => ({ kind: e.kind, content: e.content })),
    contract,
    operationalConstruct,
  );
  if (dependency) {
    // The branch, the construct noun and the counterpart travel with the refusal so the
    // ledger can record what the R5 window could only let us infer.
    return { ...REJECT("dependency_inversion", dependency.kind), dependency } as ProgramValidation;
  }

  // Derived text cannot be unsafe, but the check stays: it is cheap and it is a guarantee.
  const ceilingUnsafe = unsafe(evidenceLanguage.value);
  if (ceilingUnsafe) return REJECT(ceilingUnsafe);

  const assumptions = cleanList(p.assumptions, LIMITS.assumption, "invalid_assumptions");
  if (!assumptions.ok) return REJECT_AT(assumptions.code, "program.assumptions", "an array of strings, or omitted", jsonTypeOf(p.assumptions));
  const warnings = cleanList(p.warnings, LIMITS.warning, "invalid_warnings");
  if (!warnings.ok) return REJECT_AT(warnings.code, "program.warnings", "an array of strings, or omitted", jsonTypeOf(p.warnings));

  // An ungrounded dependency stated as an ASSUMPTION is exactly how the live miss
  // justified itself. A model-authored assumption can never ground an artifact — only the
  // Host's own context can — so the same battery decides these too, and a failure rejects
  // the WHOLE proposal rather than dropping one advisory line.
  for (const text of [...assumptions.value, ...warnings.value, title.value]) {
    const bad = unsafe(text);
    if (bad) return REJECT(bad);
  }

  // Canonical order, never the model's order.
  elements.sort((a, b) => JOURNEY_KIND_ORDER.indexOf(a.kind) - JOURNEY_KIND_ORDER.indexOf(b.kind));

  return {
    ok: true,
    value: {
      version: PROGRAM_AUTHORSHIP_VERSION,
      proposal: {
        displayTitle: title.value,
        elements,
        assumptions: retainGroundedAssumptions(assumptions.value),
        warnings: warnings.value,
        evidenceLanguage: evidenceLanguage.value,
        behaviorContract: contract,
        scenarioContract,
        applicationContract,
        completionContract,
        followUpContract,
        operationalConstruct,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Apply — proposal + Host decisions → one coherent Journey
// ---------------------------------------------------------------------------

/** What the Host decided for one section. */
export type SectionDecision = "use" | "keep" | "edit";

export type SectionChoice = {
  kind: JourneyElementKind;
  decision: SectionDecision;
  /** Present only for `edit` — the Host's rewritten content. */
  editedContent?: string;
};

/**
 * Build the Journey the Host approved. Pure and total: it takes the current Journey (so
 * `keep` really keeps), the proposal, and the per-section decisions, and returns ONE
 * complete Journey. The caller persists it in a single write — there is deliberately no
 * per-element apply, so a transport failure can never leave a half-applied program.
 */
export function applyProgramProposal(
  current: RealityGroundedJourneyV1 | undefined,
  proposal: ProgramProposal,
  choices: readonly SectionChoice[],
  opts: { titleDecision: SectionDecision; editedTitle?: string },
): RealityGroundedJourneyV1 {
  const currentByKind = new Map((current?.elements ?? []).map((e) => [e.kind, e]));
  const proposedByKind = new Map(proposal.elements.map((e) => [e.kind, e]));
  const choiceByKind = new Map(choices.map((c) => [c.kind, c]));

  const out: RealityGroundedJourneyV1["elements"] = [];
  for (const kind of JOURNEY_KIND_ORDER) {
    const choice = choiceByKind.get(kind);
    const existing = currentByKind.get(kind);
    const proposed = proposedByKind.get(kind);

    let content: string | undefined;
    let provenance: ProgramProvenance | undefined;

    if (choice?.decision === "edit" && (choice.editedContent ?? "").trim().length > 0) {
      content = (choice.editedContent ?? "").trim();
      provenance = provenanceAfterHostEdit(readProvenance(existing) ?? "ai_proposed");
    } else if (choice?.decision === "use" && proposed) {
      content = proposed.content;
      provenance = "ai_proposed";
    } else if (existing && (existing.content ?? "").trim().length > 0) {
      content = existing.content.trim();
      provenance = readProvenance(existing) ?? "host_statement";
    }

    if (content === undefined || provenance === undefined) continue;
    out.push({
      id: journeyElementId(kind),
      kind,
      content,
      grounding: [{ sourceType: provenance as never, field: groundingFieldFor(kind) }],
      confirmationStatus: "grounded",
    });
  }

  const title =
    opts.titleDecision === "edit" && (opts.editedTitle ?? "").trim().length > 0
      ? (opts.editedTitle ?? "").trim()
      : opts.titleDecision === "use"
        ? proposal.displayTitle
        : (current?.displayTitle ?? proposal.displayTitle);

  return {
    version: 1,
    displayTitle: title,
    // The Host chose this title in the authorship review, so it is confirmed.
    displayTitleStatus: "grounded",
    elements: out,
  };
}

/** The Builder field each kind traces to, for the provenance record. */
function groundingFieldFor(kind: JourneyElementKind): keyof BuilderAnswers {
  switch (kind) {
    case "why_it_matters":
      return "problem";
    case "observable_standard":
      return "observableBehavior";
    case "evidence":
      return "successEvidence";
    case "reflection":
      return "sharedQuestion";
    case "completion_check":
      return "completionPrompt";
    case "follow_up":
      return "followUpDays";
    default:
      return "problem";
  }
}

/** Read an element's recorded provenance, tolerating the legacy `host_statement` shape. */
export function readProvenance(el: { grounding?: { sourceType?: unknown }[] } | undefined): ProgramProvenance | null {
  const s = el?.grounding?.[0]?.sourceType;
  return isProgramProvenance(s) ? s : null;
}

/**
 * The learner-preview attribution label key for one element, or null when the content is
 * not the Host's and must NOT be attributed to them. The UI localizes; the domain stays
 * string-free.
 */
export function attributionKind(el: { grounding?: { sourceType?: unknown }[] } | undefined): "from_host" | "bty_authored" | "host_edited" | "derived" | null {
  const p = readProvenance(el);
  if (p === null) return null;
  if (p === "host_statement") return "from_host";
  if (p === "host_edited") return "host_edited";
  if (p === "ai_proposed") return "bty_authored";
  return "derived";
}

/**
 * What the CONFIGURED journey can honestly show, computed from the Host's own design.
 * Nothing here promises competence, adoption, consistency or organisational result.
 */
/**
 * ASSUMPTIONS THE PROGRAM DOES NOT ACTUALLY DEPEND ON (Slice 3.2L-R9).
 *
 * The live v7 window offered two: "Participants have a basic understanding of handoff
 * processes" and "Participants are willing to commit to adopting new practices." Labelling
 * them as assumptions did stop them being presented as fact — but neither is something this
 * program depends on, and the second quietly assumes the adoption the evidence ceiling
 * explicitly says the training cannot show. A Host reading "this assumes people are willing
 * to adopt it" learns nothing they can act on.
 *
 * So an assumption about someone's motivation, willingness, competence, prior understanding,
 * access or adoption is dropped rather than displayed. What survives is an assumption about
 * the WORLD the behaviour needs — that the moment exists, that the other person is there —
 * which a Host can actually check or fix.
 */
const UNGROUNDED_ASSUMPTION = [
  /\b(?:willing(?:ness)?|motivat\w*|commit(?:ted|ment)?\s+to|buy[- ]?in|eager|open\s+to|receptive)\b/i,
  /\b(?:adopt\w*|embrac\w*|engag\w*\s+with)\b/i,
  /\b(?:understand\w*|familiar\w*|aware(?:ness)?|knowledge\s+of|competen\w*|capable|skilled|trained)\b/i,
  /\b(?:have\s+access|has\s+access|access\s+to\s+(?:the\s+)?(?:tool|system|template|training|material))\b/i,
];

/** Keep only the assumptions a Host could act on. Order and wording are never altered. */
export function retainGroundedAssumptions(assumptions: readonly string[]): string[] {
  return assumptions.filter((a) => !UNGROUNDED_ASSUMPTION.some((re) => re.test(a)));
}

/**
 * THE EVIDENCE LADDER, MADE LEGIBLE (Slice 3.2L-R11.4H).
 *
 * The ladder is not new — it has been encoded in `deriveEvidenceCeiling` since R8, one
 * sentence per rung, each gated by the same Host answer that creates the rung. What was
 * missing is a NAME for each level, so the authorship prompt can be built from the same
 * authority the Host-visible ceiling is built from instead of restating it by hand.
 *
 * The top three are deliberately unreachable from a training interaction: nothing a
 * participant does inside a program can show they applied it in real work, that anyone
 * observed them, or that it lasted. Only real-world evidence could, and this product does
 * not collect any.
 */
export const EVIDENCE_LADDER = [
  "exposed", "reflected", "decided", "practiced", "applied", "observed", "sustained",
] as const;
export type EvidenceLevel = (typeof EVIDENCE_LADDER)[number];

/** What THIS configuration can actually establish, lowest rung first. */
export function availableEvidenceLevels(answers: BuilderAnswers | undefined): EvidenceLevel[] {
  const ctx = programContext(answers);
  const out: EvidenceLevel[] = ["exposed"];
  if (ctx?.completionPrompt) out.push("reflected");
  if (ctx?.learningNeeds.includes("decide")) out.push("decided");
  if (ctx?.arenaRecommended) out.push("practiced");
  // `applied`, `observed` and `sustained` are never added: a self-report says what someone
  // CLAIMS they did, which is not evidence that they did it.
  return out;
}

/**
 * The prompt's evidence section — the counterweight the refused attempt did not have.
 *
 * `cdd16aaf` was refused for `evidence_overclaim` while the prompt DID carry an evidence
 * ceiling. The instruction was simply narrower than the rule: it named five outcomes
 * ("project success, collaboration, productivity, safety or results") while the validator
 * refuses a causal verb pointed at any of ~25, including consistency, clarity,
 * responsibilities, communication, errors, delays and "falling through the cracks". A model
 * can obey every word it was given and still be refused.
 *
 * So the forbidden list is DERIVED from the validator's own outcome set — it cannot be
 * narrower than the rule again — and the allowed list is stated first, because a prompt
 * made only of prohibitions is what produced the last two refusals.
 */
/** The validator's outcome set, as bare stems — the ground truth the prompt must cover. */
export function outcomeObjectStems(): string[] {
  return OUTCOME_OBJECT.split("|")
    .map((alt) => alt.replace(/\\w\*/g, "").replace(/\\/g, "").replace(/[()?:]/g, "").replace(/s\?$/, "").trim())
    .filter((w) => w.length > 0);
}

/**
 * The same set, written the way a person says it. Hand-worded for readability, but a test
 * asserts every stem in `outcomeObjectStems()` is covered here — so the prompt can never
 * silently become narrower than the rule again, which is exactly what refused `cdd16aaf`.
 */
export function outcomeNounsForPrompt(): string[] {
  return [
    "collaboration", "cooperation", "teamwork", "efficiency", "productivity", "morale",
    "safety", "quality", "performance", "retention", "success", "workflow", "outcomes",
    "results", "workflows", "clarity", "responsibilities", "communication", "accountability",
    "consistency", "adoption", "engagement", "alignment", "throughput", "errors",
    "mistakes", "delays", "risks", "rework",
    "things falling through the cracks", "things slipping through", "work being missed",
    "anything getting missed",
  ];
}

export function evidenceClaimBrief(answers: BuilderAnswers | undefined): string[] {
  const available = availableEvidenceLevels(answers);
  const ctx = programContext(answers);
  const may: string[] = ["that people read or watched what the host provided"];
  if (available.includes("reflected")) may.push("that someone wrote an answer");
  if (available.includes("decided")) may.push("that someone made and recorded a decision");
  if (available.includes("practiced")) may.push("that someone rehearsed the behaviour");
  return [
    "WHAT THIS TRAINING CAN PROVE — do not write past this line:",
    `- The most this program can establish: ${may.join("; ")}. Nothing more.`,
    "- ALLOWED, because the interaction really produces them: 'completed the practice'; 'identified the three items they would include'; 'created a practice record'; 'stated what they will do next'; 'made a decision and wrote it down'.",
    "- FORBIDDEN, because nothing here could show it: that the behaviour is now performed consistently, reliably or routinely; that it was applied in real work; that anyone observed it; that it improved, was demonstrated, was verified, was proven, was mastered, or lasted.",
    `- ALSO FORBIDDEN — pointing ANY causal verb at an organisational outcome. Not only "improves productivity": "ensures consistency", "prevents work being missed", "so that responsibilities are clear" are the same claim. The outcomes that trigger this include: ${outcomeNounsForPrompt().join(", ")}.`,
    "- Describe what the training ASKS people to do, not what it will achieve.",
    ctx && ctx.followUpDays > 0
      ? "- WHAT HAPPENS NEXT is PROSPECTIVE. Write what will be REVIEWED, never what will be confirmed: 'At follow-up, review whether the record was used in a real handover' — NOT 'the follow-up confirms the standard is now reliably used'. A self-report is what someone says they did."
      : "- There is no follow-up, so nothing in the program may refer to checking back later.",
  ];
}

export function deriveEvidenceCeiling(answers: BuilderAnswers | undefined): string {
  const ctx = programContext(answers);
  // Built from the SAME rungs `availableEvidenceLevels` reports, so the Host-visible ceiling
  // and the authorship instruction can never describe different limits (Slice 3.2L-R11.4H).
  const levels = availableEvidenceLevels(answers);
  const parts = ["Reading or watching the material can show only that people were exposed to it."];
  if (levels.includes("reflected")) parts.push("A written answer shows reflection, not competence.");
  if (levels.includes("decided")) parts.push("An action decision records a decision, never a completed action.");
  if (levels.includes("practiced")) parts.push("Practice is rehearsal, never field mastery.");
  if ((ctx?.followUpDays ?? 0) > 0) parts.push("A scheduled self-report is what someone says they did, not observed behavior.");
  parts.push("Nothing here can show that behaviour changed, that it was adopted, or that it lasted.");
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Structured review authority (Slice 3.2L-R6.1)
// ---------------------------------------------------------------------------

/**
 * THE OPEN DEFECT R6 LEFT. R6 derived six instructional sections from shared contracts, but
 * the review surface still handed the Host six free textareas. Nothing is persisted, so
 * this was never a stale-database problem — it was a product one: a Host could edit APPLY IT
 * so it described a different behaviour than THE STANDARD, and apply both.
 *
 * The fix is not to lock the Host out. It is to let them adjust the CONTRACT and re-render
 * every dependent sentence, so the program cannot disagree with itself by construction.
 * The initial Guided Builder stays conversational; this exists only inside review.
 */
export type ProgramContracts = {
  /**
   * The Host's own problem, verbatim. WHY THIS MATTERS is rendered from it (Slice
   * 3.2L-R9), so the rationale cannot describe a problem the Host never stated.
   */
  problemStatement: string;
  behavior: BehaviorContract;
  scenario: ScenarioContract | null;
  application: ApplicationContract | null;
  completion: CompletionContract | null;
  followUp: FollowUpContract | null;
  construct: OperationalConstruct | null;
  followUpDays: number;
};

/** The contracts a proposal was generated with, as the starting point for review. */
export function contractsFromProposal(
  proposal: ProgramProposal,
  followUpDays: number,
  problemStatement = "",
): ProgramContracts | null {
  // A proposal without a behaviour contract cannot derive anything. Only reachable from a
  // pre-v4 shape; returning null keeps the review surface honest rather than crashing.
  if (!proposal.behaviorContract) return null;
  return {
    problemStatement,
    behavior: proposal.behaviorContract,
    scenario: proposal.scenarioContract,
    application: proposal.applicationContract,
    completion: proposal.completionContract,
    followUp: proposal.followUpContract,
    construct: proposal.operationalConstruct,
    followUpDays,
  };
}

/**
 * The participant-facing sentence for one INSTRUCTIONAL kind, or null for a narrative kind
 * whose text the Host owns directly. One function, used by the validator, the review
 * surface and the tests — so what the Host sees and what Apply writes cannot diverge.
 */
/**
 * The first real chance to do the behaviour, for a review state (Slice 3.2L-R10-A).
 *
 * DERIVED from the current trigger, so editing "When should they do it?" moves YOUR
 * DECISION and APPLY IT with it and the Host is never asked the same question twice. The
 * stored contract is the fallback ONLY for a legacy v1-v8 proposal, whose moment the model
 * wrote and which must still replay exactly as it was accepted.
 */
export function applicationMomentFor(c: ProgramContracts): string | null {
  const derived = deriveFirstApplicationMoment(c.behavior.trigger);
  if (derived.ok) return derived.value;
  return c.application?.applicationMoment ?? null;
}

/**
 * Does BTY OWN this section's sentence under these contracts? (Slice 3.2L-R10-A.1)
 *
 * `deriveInstructionalContent` returns null for two very different reasons — "the Host owns
 * this one" and "BTY owns it but cannot render it right now" — and the review surface read
 * both as the first. So a v9 trigger that stopped deriving turned YOUR DECISION and APPLY
 * IT back into Host narrative showing the sentence captured at generation time, which is
 * how a program came to display two different moments at once.
 *
 * This answers OWNERSHIP, which does not change while the Host edits. Availability is
 * `deriveInstructionalContent` returning a string.
 */
export function derivesFrom(kind: JourneyElementKind, c: ProgramContracts): boolean {
  switch (kind) {
    case "why_it_matters":
      return c.problemStatement.trim().length > 0;
    case "observable_standard":
    // YOUR DECISION and APPLY IT are always BTY's — their moment comes from the trigger.
    case "action_decision":
    case "field_application":
      return true;
    case "scenario":
      return c.scenario !== null;
    case "completion_check":
      return c.completion !== null;
    case "follow_up":
      return c.followUp !== null;
    default:
      return false;
  }
}

export function deriveInstructionalContent(kind: JourneyElementKind, c: ProgramContracts): string | null {
  // WHY THIS MATTERS is derived only when the Host actually stated a problem; without one
  // there is nothing to ground it in and the model's prose stays (Slice 3.2L-R9).
  if (kind === "why_it_matters") {
    return c.problemStatement.trim().length > 0
      ? renderRationaleSentence(c.problemStatement, c.behavior, c.construct)
      : null;
  }
  if (kind === "observable_standard") return renderStandardSentence(c.behavior);
  if (kind === "scenario" && c.scenario) return renderScenarioSentence(c.behavior, c.scenario);
  if (kind === "action_decision" || kind === "field_application") {
    const moment = applicationMomentFor(c);
    if (moment === null) return null;
    const a = { applicationMoment: moment };
    return kind === "action_decision"
      ? renderDecisionSentence(c.behavior, a)
      : renderApplicationSentence(c.behavior, a, c.construct);
  }
  if (kind === "completion_check" && c.completion) return renderCompletionQuestion(c.behavior, c.completion);
  if (kind === "follow_up" && c.followUp) return renderFollowUpSentence(c.behavior, c.followUp, c.followUpDays);
  return null;
}

/** Why an edited review state cannot be applied. The UI owns the wording. */
export type ReviewBlockReason =
  | "standard_incomplete"
  | "standard_not_observable"
  /** The action cannot be rendered into a sentence people could follow. */
  | "action_unusable"
  /** The completion authority is missing a confirmer or a visible confirming act. */
  | "completion_incomplete"
  /** The first application moment is not an instance of the required trigger. */
  | "application_unrelated"
  | "scenario_incomplete"
  | "application_incomplete"
  | "completion_invalid"
  | "follow_up_invalid"
  | "narrative_unsafe"
  | "derived_too_long";

export type ReviewValidation =
  | { ok: true }
  | { ok: false; reason: ReviewBlockReason; kind: JourneyElementKind };

/**
 * Validate the CURRENT edited review state as one program, deterministically and with no
 * provider call. This runs on the Host's own adjustments, so it checks the same properties
 * the generated contracts had to satisfy — a Host may write a worse standard than BTY did,
 * but not one the product would have refused from the model.
 */
export function validateEditedReview(
  c: ProgramContracts,
  required: readonly JourneyElementKind[],
  narrative: Readonly<Record<string, string>>,
  answers: BuilderAnswers | undefined,
  verifiedArtifacts: readonly string[] = [],
): ReviewValidation {
  const corpus = groundingCorpus(answers, verifiedArtifacts);

  // Checked before the contract rules so the Host gets the specific guidance, not a
  // generic "not observable" for what is really an unrenderable phrase.
  if (!isRenderableAction(c.behavior.observableAction)) {
    return { ok: false, reason: "action_unusable", kind: "observable_standard" };
  }

  const behavior = validateBehaviorContract({
    actor: c.behavior.actor,
    trigger: c.behavior.trigger,
    observable_action: c.behavior.observableAction,
    completion: { confirmed_by: c.behavior.completion.confirmedBy, confirmation_action: c.behavior.completion.confirmationAction },
  });
  if (!behavior.ok) {
    const reason: ReviewBlockReason = behavior.defect.reason === "missing" || behavior.defect.reason === "too_long"
      ? "standard_incomplete"
      : "standard_not_observable";
    return { ok: false, reason, kind: "observable_standard" };
  }

  if (required.includes("scenario")) {
    if (!c.scenario) return { ok: false, reason: "scenario_incomplete", kind: "scenario" };
    const sc = validateScenarioContract(
      { pressure_condition: c.scenario.pressureCondition, pressure_detail: c.scenario.pressureDetail },
      c.behavior,
    );
    if (!sc.ok) return { ok: false, reason: "scenario_incomplete", kind: "scenario" };
  }

  if (required.includes("field_application") || required.includes("action_decision")) {
    /*
      The Host edits ONE moment — the trigger — and the first instance follows it. So what
      is checked here is that the edited trigger still expresses recurrence; a legacy
      proposal whose moment the model wrote keeps its own (Slice 3.2L-R10-A).
    */
    if (applicationMomentFor(c) === null) {
      return { ok: false, reason: "application_incomplete", kind: "observable_standard" };
    }
  }

  if (required.includes("completion_check") && !c.completion) {
    return { ok: false, reason: "completion_invalid", kind: "completion_check" };
  }
  if (required.includes("follow_up") && !c.followUp) {
    return { ok: false, reason: "follow_up_invalid", kind: "follow_up" };
  }

  // Host-editable free text carries the same honesty rules the model's did.
  for (const kind of required) {
    const text = (narrative[kind] ?? "").trim();
    if (text.length === 0 || deriveInstructionalContent(kind, c) !== null) continue;
    if (assertsOverclaim(text) || PERSON_EVALUATION.some((re) => re.test(text)) || INTERNAL_JARGON.some((re) => re.test(text))) {
      return { ok: false, reason: "narrative_unsafe", kind };
    }
    if (ungroundedArtifact(text, corpus) !== null || INVENTED_SPECIFICS.some((re) => re.test(text))) {
      return { ok: false, reason: "narrative_unsafe", kind };
    }
    if (kind === "why_it_matters" && programContext(answers) && overlapRatio(text, programContext(answers)!.problemStatement) >= 0.8) {
      return { ok: false, reason: "narrative_unsafe", kind };
    }
  }

  // Every rendered sentence must still fit the element ceiling.
  for (const kind of required) {
    const derived = deriveInstructionalContent(kind, c);
    if (derived !== null && derived.length > LIMITS.content) {
      return { ok: false, reason: "derived_too_long", kind };
    }
  }

  return { ok: true };
}
