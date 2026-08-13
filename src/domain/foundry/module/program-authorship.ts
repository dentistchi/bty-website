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

import { SUPPORTED_EXTENSIONS } from "./draft-asset";
import { audienceAuthorityFor } from "./audience-authority";
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
  CANONICAL_ACTOR,
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
  CONFIRMERS,
  CREATION_FRAME,
  deriveFirstApplicationMoment,
  momentIsConfidentlyOneOff,
  composeObservableAction,
  actionVerbDefect,
  renderStandardSentence,
  ungroundedExistingEntity,
  MODIFIER_TOKEN,
  validateBehaviorContract,
  validateProgramDependencies,
  validateScenarioContract,
  pressureFrameIds,
  renderPressureFrame,
  type PressureFrame,
  scenarioPressurePromptLines,
  type ApplicationContract,
  type BehaviorContract,
  type CompletionContract,
  type FollowUpContract,
  type OperationalConstruct,
  type ContractDefect,
  type DependencyDefect,
  type ProgramSection,
  type ScenarioContract,
  type ScenarioDefect,
} from "./program-coherence";
import {
  assertsOverclaimByPolicy,
  EVIDENCE_POLICY,
  outcomePromiseIndex,
  evidencePolicyPromptLines,
  evidenceScopeLine,
  evidenceFamilyContrasts,
  OUTCOME_OBJECTS,
  OUTCOME_OBJECT_WORDS,
} from "./evidence-policy";

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
/**
 * THE SEMANTIC ACCEPTANCE CONTRACT (Slice 3.2P-W4-R1).
 *
 * This string already answered "which authorship contract produced this proposal" — it is what
 * the ledger stores as `proposal_version`. W4-R1 makes that meaning load-bearing: it is now
 * ALSO the authority a cached or unapplied proposal is bound to, so a proposal accepted under
 * an older contract cannot be restored or adopted under a newer one.
 *
 * IT MOVES ONLY WHEN ACCEPTANCE MOVES. A cosmetic deploy, a UI change, a doc change or a
 * refactor must NOT invalidate a Host's unfinished work — which is exactly why the deploy SHA
 * was rejected for this job. Bump it when a change can alter whether an EXISTING proposal is
 * valid: actor authority, confirmer authority, scenario floors, material grounding, evidence
 * ceilings, required-kind semantics.
 *
 * v9 → v10 corrects a real versioning defect. Between them, acceptance changed four times —
 * the interrogative-action floor, the filename material floor, the server-written participant
 * subject, and confirmer role-head authority — while the version stood still. W3 was generated
 * under v9 and keeps that in its ledger row; it is no longer adoptable, and its history is not
 * rewritten to say it was refused.
 *
 * v10 → v11 (Slice 3.2P-R3.4-R1) changes the accepted proposal SHAPE, not just a floor: the
 * model no longer authors completion at all. Every v10 proposal was generated against a
 * behaviour contract that carried a confirmer this version has no field for, so no unapplied
 * v10 proposal can be adopted under it. W4's refusal and W3's success both keep the versions






 * v21 → v22 (Slice 3.2P-A7-R2) takes WHEN away from the model entirely, and the WIRE moves with
 * it — `PROGRAM_SCHEMA_NAME` advances to `bty_guided_program_v12`, the third time both have
 * moved together.
 *
 * A7 is the whole argument. Its first call named an occasion of its own. Its licensed repair —
 * narrow surface, freeze clean, merged, fully revalidated — was told in its opening sentence
 * that it had put the situation at a different time, was handed all seventeen difficulty
 * families, and returned 32 tokens naming ANOTHER occasion. Explicit prompt, correct validator,
 * sound repair, same defect twice in one attempt. v21 gave that defect a fair correction and
 * the correction lost.
 *
 * So `pressure_condition` and `pressure_detail` are gone. The model returns `pressure_frame`,
 * one id from twelve the server defined, and the server writes the clause. "later that
 * afternoon" is not refused any more — there is nowhere to put it.
 *
 * Measured before building it: all 49 labelled legitimate pressures across the A3-R2 and A5-R1
 * corpora map to one of the twelve, every frame is used, and none of the fourteen non-pressures
 * or eight relocations maps to any. Two of the old seventeen detector families — `named_pressure`
 * and `korean_markers` — are deliberately NOT frames: they read free text, which no longer exists.
 *
 * Acceptance moves in both directions, which is what this constant tracks: a proposal that would
 * have been refused for its pressure prose cannot be written at all, and a frame the old floor
 * would have missed is now simply valid.
 *
 * v20 → v21 (Slice 3.2P-A6-R2) makes a relocated occasion repairable, which changes what a
 * generation can OUTCOME to: a proposal that was terminally refused under v20 can now be
 * corrected and succeed under v21. The validator did not move — the same phrase refuses for the
 * same reason — but the acceptance of an ATTEMPT did, and that is what this constant tracks.
 *
 * A6 (`772a15e2`) was refused on its first call with `scenario_independent_moment` and given no
 * retry, under a rule written when a repair regenerated the whole program. Measured: the model
 * has no field for the actor, the trigger or the moment; `namesIndependentMoment` is called in
 * exactly one place, over the two pressure fields; and the licensed patch cannot reach anything
 * else. So the fault it was protecting against — a scenario rebuilt around the wrong moment —
 * is no longer reachable, while the fault A6 actually committed is two fields wide.
 *
 * `repairLicenseFor` gives it the NARROW `scenario_pressure` licence rather than the wider
 * `element_and_contract` its kind would otherwise select. No other code became repairable, no
 * third call exists — `MAX_ATTEMPTS` is still 2 — and the moment floor is byte-identical.
 *
 * v19 → v20 (Slice 3.2P-A4-R3) closes four measured false negatives in the evidence floor, and
 * this one MOVES ACCEPTANCE — a proposal valid under v19 can be refused under v20, which is
 * exactly what this constant exists to record.
 *
 * A4-R2's corpus found them and left them, because that slice's defect was the prompt. Each was
 * a lexical gap proven by single-variable swap, not a shape fault: `create` was missing from the
 * causal verbs while `improve` was there; `reduce` was already a causal verb and the work that
 * did not happen had no noun; `assign` was missing from the performance verbs while `follow` was
 * there; and mastery was matched only as `mastered`, so "Mastering …" in a TITLE — the most
 * visible sentence in a program — passed.
 *
 * Measured over 68 labelled sentences: recall 0.533 → 1.000, precision 1.000 → 1.000. No
 * ceiling moved, no rung was redefined, no guard was relaxed. The one guard ADDED —
 * `negation-either-side` — is scoped to the single noun-headed rule whose denial can only
 * follow it, because applying it to a causal rule would exempt "This ensures consistency, not
 * confusion" and turn a refusal into a pass.
 *
 * v18 → v19 (Slice 3.2P-A4-R2) tells the model where the evidence ceiling reaches. Every rule
 * has always declared `appliesTo` — "plus assumptions, warnings and the title" — and none of it
 * was ever rendered; the prompt then closed by asking for "participant-facing text", which
 * assumptions and warnings are not. Two live initial-authorship windows were refused there and
 * nowhere else: A1 (v15) and A4 (v18), both `evidence_overclaim` / kind null / path `program`.
 * A4 additionally proved the repair channel is sound — a 72-token patch merged inside its
 * licence — and that a sound repair cannot fix an unstated rule, so the narrative repair now
 * carries the same scope.
 *
 * The advisory commission moved with it. Asking for "warnings when training alone will not fix
 * the problem (a workflow, staffing, access or policy change may be needed)" commissions the
 * remedy clause, and a remedy clause finished with an outcome is the refused shape. It now asks
 * for the condition and stops.
 *
 * Acceptance does NOT move — no validator, guard or ceiling changed, and a proposal valid under
 * v18 is valid under v19. The version moves because the SEMANTIC CONTRACT with the provider did:
 * the model is now told a scope it was previously judged against silently, and a stale cached
 * proposal authored without it should not be adopted as though it had been. The wire shape and
 * every repair patch shape are untouched.
 *
 * v17 → v18 (Slice 3.2P-A3-R2) widens what counts as pressure. A3's first call was refused
 * `scenario_without_pressure`, its licensed patch was asked for "a real constraint of one of
 * these kinds", and the repaired pressure named a different occasion. The moment floor caught
 * that correctly — precision 1.00 — but the pressure floor is what sent the model looking:
 * measured on 36 phrases of ordinary workplace difficulty it recognised 13. Six families later
 * it recognises all 36 with no false positives, and a bare `deadline` — which had been accepting
 * "state the owner and deadline" and "every item has a deadline" since the family was written —
 * now needs to be a close one.
 *
 * Acceptance moves in both directions, so the version moves. The wire shape and the repair patch
 * shapes are untouched; only the pressure policy and the repair PROSE changed.
 *
 * v16 → v17 (Slice 3.2P-A2-R2) states a product requirement the model was never given. A2 passed
 * every floor and still failed acceptance: its reflection asked "How do you currently ensure…",
 * which assumes the trained behaviour already happens and leaves the learner this training
 * exists for no truthful answer. The instruction had described how to ANSWER, never what the
 * question may ASSUME. Acceptance moves, so the version does; the wire shape does not.
 *
 * NOT deterministically enforced, and the boundary is recorded rather than blurred: measured on
 * seventeen labelled questions, every lexical rule refuses ordinary reflections. Neutrality is
 * prompt-enforced and product-reviewed. The server cannot prove it.
 *
 * v15 → v16 (Slice 3.2P-A1-R3) makes a licensed repair winnable. A1's retry asked for the whole
 * program, instructed the model in prose to preserve what it could not see, and was then judged
 * on exact serialisation — so the call was spent before it began. A repair now returns only its
 * licensed surface and the server merges it into a baseline it never released. Acceptance moves:
 * proposals that could not have survived a repair can now survive one.
 *
 * The INITIAL wire shape is untouched, so `PROGRAM_SCHEMA_NAME` stays at v11. The repair schemas
 * carry their own names instead — pretending the authorship contract changed would be less
 * truthful than giving the new contracts an identity of their own.
 *
 * v14 → v15 (Slice 3.2P-R3.7-R2) closes WHO structurally. v14 refused a subject it could see —
 * a pronoun or a determiner — and measurement proved a free string goes no further without
 * refusing real behaviours. The model now returns the verb HEAD and the rest of the phrase
 * separately, so a subject has no position to occupy. The wire shape moves with it, so
 * `PROGRAM_SCHEMA_NAME` advances to v11 — the second time both have moved together.
 *
 * v13 → v14 (Slice 3.2P-R3.7) makes the authority split SEMANTIC rather than schema-deep. W6
 * succeeded under v13 and was unusable: the model wrote the host's own occasion into
 * `observable_action` and the renderer, which owns the moment, prepended it again. An action
 * that names WHO or WHEN is now refused, and — in the other direction — a host moment the
 * English fold cannot parse is no longer refused at all. Acceptance moved both ways, so the
 * version moves. The wire shape did not, so `PROGRAM_SCHEMA_NAME` stays at v10.
 *
 * v12 → v13 (Slice 3.2P-R3.6-R1) removes the last two model-authored contract roles: the
 * trigger becomes the Host's `recurringMoment` and the discarded `actor` field goes with it. The
 * WIRE shape changes too, so `PROGRAM_SCHEMA_NAME` moves to v10 alongside — the first time both
 * have moved together, because this is the first change that is both a new acceptance rule and a
 * new response shape.
 *
 * v11 → v12 (Slice 3.2P-R3.5) is a WIDENING, and it is the first bump this constant has taken
 * for a bug fix rather than a design change. The recurring-moment fold refused any occasion
 * whose head ended in `-ing`, which caught `morning` and `evening`; repairing it means triggers
 * like "at morning huddles" move from REFUSED to ACCEPTED. That is precisely the condition this
 * version exists to track — a change that alters whether an existing proposal is valid — and it
 * does not stop being that because the movement is in the Host's favour.
 *
 * The WIRE contract is untouched, so `PROGRAM_SCHEMA_NAME` stays at v9. That split is the whole
 * reason the two names are separate.
 */
export const PROGRAM_AUTHORSHIP_VERSION = "program_authorship_v22";

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
  /** The Host's own recurring workplace occasion (Slice 3.2P-R3.6-R1). The program's ONE moment. */
  recurringMoment: string;
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
  /*
    FIVE STEPS NOW (Slice 3.2P-R3.6-R1) — the recurring moment joined problem, audience,
    behaviour and evidence as source the program cannot be authored without. The list still
    reuses the EXACT Builder gates rather than restating them, so the Host's screen and the
    generation boundary can never disagree about what "ready" means.
  */
  for (const step of [1, 2, 3, 4, 5]) {
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
    recurringMoment: text(a.recurringMoment),
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

/**
 * IS THE SOURCE READY TO AUTHOR FROM? (Slice 3.2P-R3.6-R1)
 *
 * WHY THIS EXISTS SEPARATELY FROM `programContext`. Absence and unusability are different
 * faults with different sentences, and only one of them is about a blank field. A Host who
 * wrote "At the next huddle" has answered the question — honestly, in their own words — and
 * telling them to add a moment would be false. So this reports which of the two it is.
 *
 * BOTH BLOCK BEFORE SPEND, and that is the whole point. W5 (attempt `65923a21`) paid for a
 * provider call, got a program back, and refused it `trigger_not_recurring` — a paid semantic
 * refusal for something knowable from the draft alone, before an attempt row existed. Host
 * input quality is a readiness question; it is not something to discover by generating.
 *
 * Returns null when the source can be authored from.
 */
export type ProgramSourceBlocker = "recurring_moment_required" | "recurring_moment_not_repeatable";

/**
 * THE HOST IS THE AUTHORITY ON THEIR OWN MOMENT (Slice 3.2P-R3.7).
 *
 * R3.6-R1 blocked generation when `deriveFirstApplicationMoment` could not fold the Host's
 * phrase, because a renderer then needed that fold. No renderer needs it any more, and the
 * measurement of what it refuses is damning: "During the weekly scheduling review" — an
 * ordinary answer to "when does this usually happen?" — is rejected, and so is every Korean
 * moment, because the fold is an English noun-phrase grammar.
 *
 * That would make a narrow parser a stronger authority than the Host, which is exactly the
 * mistake R3.4 refused to make with `CONFIRMATION_MARKER` and the Host's own evidence sentence.
 *
 * So absence still blocks — there is nothing to build a program around — and phrasing does not.
 * A phrase the parser cannot fold earns NON-BLOCKING guidance on the Builder step, where the
 * Host can act on it or overrule it. Nothing is normalized, and "At the next huddle" is never
 * silently turned into "At each huddle".
 */
export function programSourceBlocker(answers: BuilderAnswers | undefined): ProgramSourceBlocker | null {
  const moment = typeof answers?.recurringMoment === "string" ? answers.recurringMoment.trim() : "";
  if (moment.length === 0) return "recurring_moment_required";
  /*
    CONFIDENTLY one-off blocks; UNCERTAIN does not (Slice 3.2P-R3.7-R2). The product renders
    "The next time this happens", which is simply false if the host named a date — so a moment
    that can only mean one occasion is refused before spend. Everything the rule cannot prove is
    accepted, which is what keeps Korean and ordinary English answers working.
  */
  return momentIsConfidentlyOneOff(moment) ? "recurring_moment_not_repeatable" : null;
}


/**
 * THE COMPLETION CRITERION, from the one place it lives (Slice 3.2P-R3.4-R1).
 *
 * ONE accessor, so the criterion cannot be copied into the prompt, the validator and the
 * renderers as three drifting reads of the same answer. `programContext` is the canonical
 * route and already guarantees presence; this is the direct-answers fallback for callers that
 * hold answers without a full context (the review surface, tests).
 */
export function completionCriterionFrom(answers: BuilderAnswers | undefined): string {
  const v = answers?.successEvidence;
  return typeof v === "string" ? v.trim() : "";
}

/** The same accessor for the Host's moment (Slice 3.2P-R3.6-R1). One read, never re-derived. */
export function recurringMomentFrom(answers: BuilderAnswers | undefined): string {
  const v = answers?.recurringMoment;
  return typeof v === "string" ? v.trim() : "";
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
    /*
      Appended INSIDE the joined string, so changing only the moment changes the fingerprint —
      and so every proposal authored before this field existed reads as stale context as well as
      stale authority. Both are true, and neither record is rewritten.
    */
    norm(ctx.recurringMoment),
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
      /**
       * WHICH SCENARIO FAULT (Slice 3.2P-A5-R2). Present only for a scenario-contract refusal.
       *
       * `scenario_without_pressure` is an UMBRELLA: five distinct defect reasons collapse into
       * it, and A5-R1 could not answer its own central question — did the pressure floor miss
       * real difficulty, or did the model write none — because the discriminator was computed
       * and dropped one line later. Closed vocabulary, never the rejected phrase.
       */
      scenario?: ScenarioDefect;
      /**
       * WHICH EVIDENCE RULE (Slice 3.2P-A5-R2). Present only for `evidence_overclaim`.
       *
       * `assertsOverclaimByPolicy` already returns the exact rule; `assertsOverclaim` threw it
       * away, so A1's and A4's family are permanently unknowable. A policy id — BTY's own
       * classification — never a sentence.
       */
      evidenceRule?: string;
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
  return outcomePromiseIndex(text);
}

/**
 * True only when an overclaim is ASSERTED rather than denied (Slice 3.2L-R11.4I).
 *
 * The rules themselves moved to `evidence-policy`, where each one carries the sentence the
 * model is told. Three windows were refused against a prompt that described only part of
 * this set; two hand-maintained lists could not be kept honest, so there is now one.
 */
function assertsOverclaim(text: string): boolean {
  return assertsOverclaimByPolicy(text) !== null;
}

/** Which rule refused it — for the bounded repair instruction, never for a Host. */
export function overclaimRuleId(text: string): string | null {
  return assertsOverclaimByPolicy(text)?.id ?? null;
}

/** Retained name: a rung this product cannot reach, however it is phrased. */
export function claimsAboveCeiling(text: string): boolean {
  const rule = assertsOverclaimByPolicy(text);
  return rule !== null && rule.id !== "organisational_outcome";
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
  "says|state[sd]?|explains?|explained|teaches|taught|shows?|showed|covers?|covered|describes?|described|outlines?|outlined|lists?|listed|demonstrates?|demonstrated|walks? through|contains?|contained|includes?|included|recommends?|recommended|specifies|specified|details|detailed|introduces?|introduced|requires?|required";
const MATERIAL_CONTENT_CLAIM = [
  // "the video explains …", "this document lists …"
  new RegExp(`\\b(?:the|this|that|our|your|their)\\s+(?:${MODIFIER_TOKEN}\\s+){0,2}(?:${MATERIAL_SOURCES})\\s+(?:${ATTRIBUTION_VERBS})\\b`, "iu"),
  // "as described in the video", "covered in the material"
  new RegExp(`\\b(?:${ATTRIBUTION_VERBS})\\s+in\\s+(?:the|this|that)\\s+(?:${MODIFIER_TOKEN}\\s+){0,2}(?:${MATERIAL_SOURCES})\\b`, "iu"),
  // "according to the video"
  new RegExp(`\\baccording to\\s+(?:the|this|that)\\s+(?:${MODIFIER_TOKEN}\\s+){0,2}(?:${MATERIAL_SOURCES})\\b`, "iu"),
];

/**
 * A FILE, NAMED, SPEAKING FOR ITSELF (Slice 3.2P-R3.1).
 *
 * The patterns above all need a determiner and a generic source noun, so they never saw
 * "education.pdf says to name an owner" — the filename IS the subject, and no article
 * introduces it. Measured: that sentence, "education.pdf requires every leader to…" and
 * "the slides.pptx require a named owner" all passed every honesty check.
 *
 * Naming a verified file is authority for its EXISTENCE and nothing else, so a filename
 * followed by an attribution verb is a content claim regardless of who supplied the file.
 * The extension list is the application's own upload allowlist, which keeps this from firing
 * on ordinary dotted prose ("e.g." and "i.e." are not file types).
 *
 * BOUNDED DELIBERATELY. At most two intervening words, and none of them a connective — so
 * "the education.pdf checklist lists…" matches while "Open education.pdf and the team lists
 * the owners" does not. A trailing sentence stop also breaks the match, because the
 * whitespace this requires is not there.
 */
const FILE_EXTENSIONS = SUPPORTED_EXTENSIONS.join("|");
const CLAUSE_CONNECTIVES = "and|or|but|then|so|because|which|that|who|while|before|after";
const FILE_CONTENT_CLAIM = new RegExp(
  `\\b${MODIFIER_TOKEN}\\.(?:${FILE_EXTENSIONS})\\b` +
    `(?:\\s+(?!(?:${CLAUSE_CONNECTIVES})\\b)[\\p{L}\\p{N}_'-]+){0,2}` +
    `\\s+(?:${ATTRIBUTION_VERBS})\\b`,
  "iu",
);

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
  `\\b(?:the|this|that|our|your|their)\\s+(?:${MODIFIER_TOKEN}\\s+){0,2}(?:${PRESCRIPTIVE_ARTIFACTS})\\s+(?:${ATTRIBUTION_VERBS})\\b`,
  "iu",
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
  if (FILE_CONTENT_CLAIM.test(text)) return true;
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

/**
 * The WIRE contract's name, which moves only when the JSON shape does — unlike
 * `PROGRAM_AUTHORSHIP_VERSION`, which moves whenever ACCEPTANCE does. v8 → v9 because v11
 * removed `behavior_contract.completion` from the response (Slice 3.2P-R3.4-R1).
 */
export const PROGRAM_SCHEMA_NAME = "bty_guided_program_v12";

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
          /**
           * ONE FIELD (Slice 3.2P-R3.6-R1). The behaviour contract has four roles and the model
           * now authors exactly one of them.
           *
           *   actor      → `CANONICAL_ACTOR`, from the Host's audience    (removed at v11)
           *   completion → the Host's `successEvidence`                    (removed at v11)
           *   trigger    → the Host's `recurringMoment`                    (removed here)
           *   observable_action → still the model's, and genuinely creative
           *
           * `actor` went with `trigger` in the same edit. It had been discarded by
           * `withCanonicalActor` since v10 and validated only for shape — asking a model for a
           * string that is thrown away is not freedom, it is noise that reads like authority.
           *
           * REMOVED, not deprecated. `additionalProperties: false` makes a returned trigger or
           * actor a schema violation rather than a rule violation.
           */
          required: ["action_verb", "action_detail"],
          properties: {
            /**
             * THE VERB HEAD, ALONE (Slice 3.2P-R3.7-R2). Splitting the action here is what makes
             * a model-authored SUBJECT unrepresentable rather than merely refused: the server
             * composes `you must {action_verb} {action_detail}`, so the verb sits immediately
             * after the modal by construction and nothing can precede it.
             */
            action_verb: { type: "string" },
            /**
             * The rest of the phrase — NOT necessarily an object. Phrasal verbs put a particle
             * here ("up with the owner", "off on the checklist"), and demanding a grammatical
             * object would mean inventing one.
             */
            action_detail: { type: "string" },
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
          /*
            NO FREE PRESSURE PROSE (Slice 3.2P-A7-R2). The model selects WHICH KIND of
            difficulty; the server writes the sentence. A7 proved that a field able to hold a
            time will eventually hold one, however explicitly the prompt forbids it — twice in
            one attempt, the second time inside a repair whose opening sentence named the
            defect. "later that afternoon" now has nowhere to be written.
          */
          required: ["pressure_frame"],
          properties: {
            pressure_frame: { type: "string", enum: pressureFrameIds() },
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
            confirmer: { type: "string", enum: [...CONFIRMERS] },
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

/**
 * BOUNDED SEMANTIC REPAIR (Slice 3.2L-R11.4I).
 *
 * A meaning fault used to end the attempt immediately, on the reasoning that asking again
 * spends a second call to be told the same thing. Three consecutive paid windows have now
 * proved the opposite for the honesty family: the program was structurally complete every
 * time and failed on individual SENTENCES, which is precisely what a targeted instruction
 * can fix without changing anything else.
 *
 * Only these two are repairable, and only because a repair instruction for them can be
 * written entirely in BTY's own vocabulary — the refusal category, the ceiling, and "change
 * nothing else". Every other meaning fault stays terminal: a program that describes the
 * wrong behaviour is not one sentence away from being right.
 */
const SEMANTIC_REPAIRABLE_CODES: readonly ProgramRejectCode[] = [
  "evidence_overclaim",
  "material_fabrication",
  /*
    BOTH SCENARIO CODES RETIRED FROM THIS SET (Slice 3.2P-A7-R2), and not because they stopped
    mattering — because no v22 proposal can produce them. `scenario_contract` is one id from a
    closed server-owned set, so "no real difficulty", "generic", "restates the action" and "a
    second occasion" are shape faults or nothing at all. A malformed id is handled by the
    structural retry that already exists.

    `scenario_without_pressure` was repairable from 3.2O-R4 and `scenario_independent_moment`
    for exactly one slice, A6-R2 — long enough for A7 to prove the repair could not win, which
    is what justified removing the field instead. Both codes stay in `ProgramRejectCode` and in
    the ledger vocabulary: A3, A5, A6 and A7 carry them, and history has to stay readable.
  */
];

export function isSemanticRepairableCode(code: ProgramRejectCode): boolean {
  return SEMANTIC_REPAIRABLE_CODES.includes(code);
}

/**
 * What the one repair call is told. Carries the refusal CATEGORY — BTY's own classification,
 * never the model's words — the ceiling it must write inside, and an explicit instruction to
 * preserve everything that was already right.
 */
export function semanticRepairInstruction(
  code: ProgramRejectCode,
  answers: BuilderAnswers | undefined,
): string {
  /**
   * PARITY WITH THE RESPONSE SHAPE (Slice 3.2P-R0, rewritten 3.2P-A3-R2).
   *
   * R0's wording named the licensed surface and told the model to return "the SAME program with
   * every other section exactly as it was". That was true of the whole-program retry it was
   * written for. A1-R3 retired that retry: a semantic repair now answers a PATCH schema
   * containing only its licensed fields, and the server merges it into a baseline the model never
   * receives. So every instruction about preserving, not reordering, and returning the whole
   * program describes a contract that no longer exists — A3's repair returned 32 tokens and
   * followed the schema, not this text.
   *
   * Telling a model to preserve fields it is not sent is worse than saying nothing: it implies
   * the response should contain them.
   */
  const patchOnly =
    "You are given the current value of every field you may change, and the response shape contains those fields and nothing else. Return ONLY those fields, corrected. Do not describe, repeat or recreate any other part of the program — BTY keeps it exactly as it is.";
  if (code === "scenario_without_pressure" || code === "scenario_independent_moment") {
    /*
      ONE BODY, TWO DIAGNOSES (Slice 3.2P-A6-R2). Everything after the first line already says
      exactly what an independent-moment repair needs — the moment is fixed, the pressure makes
      THAT moment harder, no second occasion, patch fields only — so nothing is added.
      Measured on the composed instruction, not assumed.

      Only the opening sentence differs, and it has to: telling a model its pressure "named
      nothing that competes" when the actual fault was a relocated occasion describes a defect
      it did not commit, and the first thing it would do is add difficulty it already had.
    */
    return [
      code === "scenario_without_pressure"
        ? "Your previous response gave the practice situation no real difficulty — the pressure field named nothing that competes with doing the behaviour properly."
        : "Your previous response put the practice situation at a different time or event from the behaviour itself — a pressure field named an occasion of its own.",
      "The situation still happens at the host's own moment, which is fixed. Your pressure makes THAT moment harder — it never moves the learner to a different one.",
      "Replace the pressure with a real difficulty of one of these kinds:",
      ...scenarioPressurePromptLines(),
      "Do NOT introduce another time, meeting, call, appointment, shift or occasion — the pressure is a difficulty inside the moment, never a second moment.",
      "Do NOT restate the trained action as the pressure.",
      patchOnly,
    ].join(" ");
  }
  if (code === "material_fabrication") {
    return [
      "Your previous response relied on a material that does not exist, or spoke for one nobody has read.",
      "No template, checklist, worksheet, form, tool or guide is available to anyone, and the contents of any link or file are unknown to you.",
      "Rewrite those sentences so the participant CREATES what they need during the training, or so the material is left out entirely.",
      patchOnly,
    ].join(" ");
  }
  /*
    THE REPAIR SEES THE SAME SCOPE AS THE AUTHOR (Slice 3.2P-A4-R2).

    A4's narrative patch worked mechanically — 72 tokens, freeze false, merged, revalidated —
    and the merged candidate was refused for the same code on the same surface. The licensed
    fields ARE the title, the assumptions and the warnings, so a repair that is not told those
    are inside the ceiling is being asked to fix a rule it has not been given. Same authority as
    the initial brief, same relation, nothing whole-program.
  */
  return [
    "Your previous response claimed the training proves more than it can.",
    deriveEvidenceCeiling(answers),
    evidenceScopeLine(),
    "Rewrite every sentence that claims a result, an improvement, an organisational outcome, or that the behaviour is now performed, verified or sustained. Say what the training ASKS people to do instead.",
    "A warning may still say what is outside this training's control and what else may be needed — it may NOT say what that other thing will achieve.",
    patchOnly,
  ].join(" ");
}

/**
 * THE REPAIR ENVELOPE (Slice 3.2P-R0) — enforcement, not trust, for EVERY repair class.
 *
 * R4 built a freeze and scoped it to `scenario_without_pressure` alone. The fourth pilot
 * window then proved why that was too narrow: a repair licensed to fix a reflection sentence
 * DELETED the `follow_up` element, and the attempt died on `missing_required_kind` — the
 * consequence — instead of on the refusal that actually happened. A repair that is only asked
 * to stay in its lane will eventually leave it.
 *
 * So every repairable class now carries an explicit LICENSE naming the smallest surface it may
 * change, and everything outside it must survive byte-identical.
 *
 * WHAT IS FROZEN IN EVERY CASE, whatever the license: the number of elements, their kinds,
 * their order, every element not named by the license, both enum contracts, and — unless the
 * license says otherwise — the title, the assumptions, the warnings and the behaviour contract.
 *
 * ONE TRADE-OFF, STATED. `unsafe()` also guards the behaviour and scenario CONTRACT fields, and
 * a hit there is reported as kind `observable_standard` / `scenario` — indistinguishable at
 * repair time from a hit on the element's own prose. Licensing only the element would make
 * those repairs impossible rather than merely bounded, so those two kinds license their
 * backing contract as well. Every other kind licenses prose alone.
 */
export type RepairLicense =
  /** Only the two scenario pressure fields. The measured R4 minimum, unchanged. */
  | { readonly surface: "scenario_pressure" }
  /** One element's own prose. Presence, kind and order still frozen. */
  | { readonly surface: "element"; readonly kind: JourneyElementKind }
  /** One element's prose plus the contract it is rendered from. */
  | { readonly surface: "element_and_contract"; readonly kind: JourneyElementKind; readonly contract: "behavior_contract" | "scenario_contract" }
  /** Title, assumptions and warnings — the prose that belongs to no element. */
  | { readonly surface: "narrative" };

/**
 * What this refusal is allowed to have changed. Derived from the code and the kind the
 * validator itself reported — never from the model's claim about what it fixed.
 */
export function repairLicenseFor(code: ProgramRejectCode, kind: JourneyElementKind | undefined): RepairLicense {
  /*
    BOTH scenario faults take the NARROW licence (Slice 3.2P-A6-R2). Falling through to the
    `kind === "scenario"` branch below would hand an independent-moment repair
    `element_and_contract` — the model's scenario prose plus the contract — which is wider than
    the defect and wider than it needs. The prose is discarded and re-rendered from the contract
    anyway, so the only writable surface that matters is the two pressure fields.
  */
  if (code === "scenario_without_pressure" || code === "scenario_independent_moment") {
    return { surface: "scenario_pressure" };
  }
  if (kind === undefined) return { surface: "narrative" };
  if (kind === "observable_standard") return { surface: "element_and_contract", kind, contract: "behavior_contract" };
  if (kind === "scenario") return { surface: "element_and_contract", kind, contract: "scenario_contract" };
  return { surface: "element", kind };
}

/**
 * THE REPAIR PATCH CONTRACT (Slice 3.2P-A1-R3).
 *
 * WHAT A1 PROVED. The retry asked the model for the WHOLE program again, told it in prose to
 * preserve everything it was not licensed to change — and never showed it what that was. No
 * assistant turn is appended; `base` is the original prompt. So the model had to reproduce
 * ~2 000 bytes of JSON byte-identically, from a `temperature: 0.7` sample, against a target it
 * could not see, while `repairFreezeViolated` compares exact serialisation. Measured across
 * twelve synthetic cases: one dropped full stop, one extra space, one array reorder, one object
 * key order — every single one is a violation.
 *
 * That is not a strict retry. It is a retry that cannot be won, and A1 spent a real call on it.
 *
 * So the licence stops being a post-hoc diff and becomes the RESPONSE SHAPE. The model returns
 * only what it may change; the server owns everything else and merges. An unlicensed field is
 * not refused after the fact — it has nowhere to be written.
 *
 *   ONE LICENCE  →  patch schema (what the provider may return)
 *                →  licensed context (what the model is shown)
 *                →  server merge allowlist (what may be written)
 *
 * All three read the same `RepairLicense`, so they cannot drift into three lists.
 */

/** A patch response schema, named truthfully so the ledger and the provider agree. */
export type RepairPatchContract = {
  /** Distinct from `PROGRAM_SCHEMA_NAME`: the INITIAL wire shape did not change. */
  readonly name: string;
  readonly schema: Record<string, unknown>;
};

const strictObject = (properties: Record<string, unknown>): Record<string, unknown> => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});

/**
 * EVERY field is required, because strict structured output demands it — and because §6's real
 * invariant is not minimal textual difference, it is that no unlicensed field can be returned.
 * Asking for the whole licensed surface is safe; asking for one field of it is not expressible.
 */
export function repairPatchContract(license: RepairLicense): RepairPatchContract | null {
  switch (license.surface) {
    case "narrative":
      return {
        name: "bty_guided_program_repair_narrative_v1",
        schema: strictObject({
          display_title: { type: "string" },
          assumptions: { type: "array", items: { type: "string" } },
          warnings: { type: "array", items: { type: "string" } },
        }),
      };
    case "element":
      return {
        name: "bty_guided_program_repair_element_v1",
        schema: strictObject({ content: { type: "string" }, rationale: { type: "string" } }),
      };
    /*
      RETAINED, UNREACHABLE (Slice 3.2P-A7-R2). No v22 proposal can produce a semantic scenario
      refusal, so nothing licenses this surface any more. It stays because the ledger holds
      attempts that used it — A3, A5 and A7 — and a reader of those rows should be able to find
      what the contract was. Its shape moves to the frame so it cannot describe a wire that no
      longer exists.
    */
    case "scenario_pressure":
      return {
        name: "bty_guided_program_repair_scenario_pressure_v1",
        schema: strictObject({ pressure_frame: { type: "string", enum: pressureFrameIds() } }),
      };
    case "element_and_contract":
      return {
        name: `bty_guided_program_repair_${license.contract}_v1`,
        schema: strictObject({
          content: { type: "string" },
          rationale: { type: "string" },
          contract:
            license.contract === "behavior_contract"
              ? strictObject({ action_verb: { type: "string" }, action_detail: { type: "string" } })
              : strictObject({ pressure_frame: { type: "string", enum: pressureFrameIds() } }),
        }),
      };
  }
}

/**
 * WHAT THE MODEL IS SHOWN — the licensed values only (Slice 3.2P-A1-R3).
 *
 * The second half of the A1 defect: a model cannot repair what it has never seen. This returns
 * the CURRENT value of every field the licence permits, and nothing else. Sending the whole
 * frozen program back merely because it is convenient would hand the model content it has no
 * authority over and invite it to re-author it.
 *
 * Transient by construction: the caller holds this for one request execution. No proposal prose
 * becomes durable, so R7 is untouched.
 */
export function licensedRepairContext(candidate: unknown, license: RepairLicense): Record<string, unknown> | null {
  if (!isPlainObject(candidate)) return null;
  const program = (candidate as Record<string, unknown>).program;
  if (!isPlainObject(program)) return null;
  const p = program as Record<string, unknown>;
  const element = (kind: JourneyElementKind): Record<string, unknown> | null => {
    const els = p.elements;
    if (!Array.isArray(els)) return null;
    const found = els.find((e) => isPlainObject(e) && (e as Record<string, unknown>).kind === kind);
    return isPlainObject(found) ? (found as Record<string, unknown>) : null;
  };
  switch (license.surface) {
    case "narrative":
      return { display_title: p.display_title, assumptions: p.assumptions, warnings: p.warnings };
    case "element": {
      const e = element(license.kind);
      return e ? { content: e.content, rationale: e.rationale } : null;
    }
    case "scenario_pressure": {
      const sc = p.scenario_contract;
      return isPlainObject(sc)
        ? { pressure_frame: (sc as Record<string, unknown>).pressure_frame }
        : null;
    }
    case "element_and_contract": {
      const e = element(license.kind);
      const c = p[license.contract];
      return e && isPlainObject(c) ? { content: e.content, rationale: e.rationale, contract: c } : null;
    }
  }
}

/** Why a patch could not be merged. Closed vocabulary; never the model's prose. */
export type RepairMergeFailure = "malformed_baseline" | "malformed_patch" | "unlicensed_field" | "surface_missing";

/**
 * THE ONE MERGE BOUNDARY (Slice 3.2P-A1-R3).
 *
 * Deep-copies the baseline and writes ONLY what the licence names. A patch key outside the
 * licence is refused rather than ignored: the schema should already have made it impossible, so
 * its presence means something upstream is wrong and continuing would hide that.
 *
 * No call site merges independently — this is the only place a repair can change a candidate.
 */
export function applyRepairPatch(input: {
  readonly baseline: unknown;
  readonly license: RepairLicense;
  readonly patch: unknown;
}): { ok: true; merged: unknown } | { ok: false; reason: RepairMergeFailure } {
  const { baseline, license, patch } = input;
  if (!isPlainObject(baseline) || !isPlainObject((baseline as Record<string, unknown>).program)) {
    return { ok: false, reason: "malformed_baseline" };
  }
  if (!isPlainObject(patch)) return { ok: false, reason: "malformed_patch" };

  const contract = repairPatchContract(license);
  if (!contract) return { ok: false, reason: "surface_missing" };
  const allowed = new Set(Object.keys((contract.schema.properties ?? {}) as Record<string, unknown>));
  for (const key of Object.keys(patch as Record<string, unknown>)) {
    if (!allowed.has(key)) return { ok: false, reason: "unlicensed_field" };
  }

  const merged = JSON.parse(JSON.stringify(baseline)) as Record<string, unknown>;
  const program = merged.program as Record<string, unknown>;
  const pv = patch as Record<string, unknown>;
  const writeElement = (kind: JourneyElementKind): boolean => {
    const els = program.elements;
    if (!Array.isArray(els)) return false;
    const found = els.find((e) => isPlainObject(e) && (e as Record<string, unknown>).kind === kind);
    if (!isPlainObject(found)) return false;
    (found as Record<string, unknown>).content = pv.content;
    (found as Record<string, unknown>).rationale = pv.rationale;
    return true;
  };

  switch (license.surface) {
    case "narrative":
      program.display_title = pv.display_title;
      program.assumptions = pv.assumptions;
      program.warnings = pv.warnings;
      return { ok: true, merged };
    case "element":
      return writeElement(license.kind) ? { ok: true, merged } : { ok: false, reason: "surface_missing" };
    case "scenario_pressure": {
      const sc = program.scenario_contract;
      if (!isPlainObject(sc)) return { ok: false, reason: "surface_missing" };
      (sc as Record<string, unknown>).pressure_frame = pv.pressure_frame;
      return { ok: true, merged };
    }
    case "element_and_contract": {
      if (!writeElement(license.kind)) return { ok: false, reason: "surface_missing" };
      const target = program[license.contract];
      if (!isPlainObject(pv.contract) || !isPlainObject(target)) return { ok: false, reason: "malformed_patch" };
      /*
        FIELDS, NOT THE OBJECT. Replacing the whole contract would DELETE any key the patch
        schema does not name — and the patch names only what the model owns. Caught by a real
        test: a legacy contract carrying server-owned keys came back two keys shorter, which the
        freeze then correctly reported as a change outside the licence. Assigning field by field
        keeps everything the model was never asked about exactly where it was.
      */
      Object.assign(target as Record<string, unknown>, pv.contract as Record<string, unknown>);
      return { ok: true, merged };
    }
  }
}

const FROZEN = "\u0000FROZEN";

/** Blank exactly the licensed surface, leaving all structure in place to be compared. */
function applyLicense(program: Record<string, unknown>, license: RepairLicense): void {
  const blankElement = (k: JourneyElementKind) => {
    const els = program.elements;
    if (!Array.isArray(els)) return;
    for (const el of els) {
      if (isPlainObject(el) && (el as Record<string, unknown>).kind === k) {
        (el as Record<string, unknown>).content = FROZEN;
        (el as Record<string, unknown>).rationale = FROZEN;
      }
    }
  };
  const blankObject = (key: string, fields: readonly string[] | "all") => {
    const o = program[key];
    if (!isPlainObject(o)) return;
    const rec = o as Record<string, unknown>;
    for (const f of fields === "all" ? Object.keys(rec) : fields) {
      if (isPlainObject(rec[f])) {
        for (const sub of Object.keys(rec[f] as Record<string, unknown>)) {
          (rec[f] as Record<string, unknown>)[sub] = FROZEN;
        }
      } else if (f in rec) rec[f] = FROZEN;
    }
  };
  switch (license.surface) {
    case "scenario_pressure":
      blankObject("scenario_contract", ["pressure_frame"]);
      return;
    case "element":
      blankElement(license.kind);
      return;
    case "element_and_contract":
      blankElement(license.kind);
      blankObject(license.contract, "all");
      return;
    case "narrative":
      program.display_title = FROZEN;
      program.assumptions = FROZEN;
      program.warnings = FROZEN;
      return;
  }
}

/**
 * Did the repair change anything it was not licensed to change?
 *
 * Compared on the RAW parsed proposals rather than the validated ones, because the validated
 * shape is partly derived and would hide a model edit behind BTY's own rendering.
 */
export function repairFreezeViolated(input: {
  readonly code: ProgramRejectCode;
  readonly kind: JourneyElementKind | undefined;
  readonly before: unknown;
  readonly after: unknown;
}): boolean {
  const license = repairLicenseFor(input.code, input.kind);
  const normalise = (v: unknown): string | null => {
    if (!isPlainObject(v)) return null;
    const raw = (v as Record<string, unknown>).program;
    if (!isPlainObject(raw)) return null;
    const program = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
    // A repair that drops the contract its license names has left its envelope.
    if (license.surface === "scenario_pressure" && !isPlainObject(program.scenario_contract)) return null;
    if (license.surface === "element_and_contract" && !isPlainObject(program[license.contract])) return null;
    applyLicense(program, license);
    return JSON.stringify(program);
  };
  const a = normalise(input.before);
  const b = normalise(input.after);
  if (a === null || b === null) return true;
  return a !== b;
}

/** The R4 entry point, preserved. Scenario pressure is one license among several now. */
export function scenarioRepairFreezeViolated(before: unknown, after: unknown): boolean {
  return repairFreezeViolated({ code: "scenario_without_pressure", kind: "scenario", before, after });
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

/**
 * WHAT THE SAFETY BATTERY FOUND (Slice 3.2P-A5-R2).
 *
 * `unsafe()` used to return a bare code, so the exact evidence rule — which
 * `assertsOverclaimByPolicy` had just computed — was discarded at the boundary. Carrying it in
 * the return value keeps the ledger's answer and the runtime's decision the SAME evaluation
 * rather than a re-derivation from text later, which could disagree.
 */
type UnsafeFinding = { code: ProgramRejectCode; evidenceRule?: string };

/** Refuse on a safety finding, preserving whichever policy id produced it. */
const REJECT_UNSAFE = (found: UnsafeFinding, kind?: JourneyElementKind): ProgramValidation =>
  ({ ok: false, code: found.code, kind, evidenceRule: found.evidenceRule });

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
  const unsafe = (text: string): UnsafeFinding | null => {
    /*
      The rule id travels with the code (Slice 3.2P-A5-R2). Same call, same result — the
      ledger records what actually refused the text, not a second opinion formed later.
    */
    const overclaim = assertsOverclaimByPolicy(text);
    if (overclaim) return { code: "evidence_overclaim", evidenceRule: overclaim.id };
    if (MATERIAL_EXISTS.some((re) => re.test(text))) return { code: "material_fabrication" };
    // Speaking for a material nobody read (Slice 3.2L-R11.4G) — a content claim, not an
    // existence claim, so the grounding corpus cannot and must not rescue it.
    if (claimsMaterialContent(text)) return { code: "material_fabrication" };
    // Invented specifics first: "section 4.2 of the policy" is BOTH, and the more precise
    // diagnosis is the more useful one to record and to show.
    if (INVENTED_SPECIFICS.some((re) => re.test(text))) return { code: "invented_specifics" };
    if (ungroundedArtifact(text, corpus) !== null) return { code: "material_fabrication" };
    if (PERSON_EVALUATION.some((re) => re.test(text))) return { code: "person_evaluation" };
    if (INTERNAL_JARGON.some((re) => re.test(text))) return { code: "internal_jargon" };
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
    return REJECT_AT("missing_field", "program.behavior_contract", "an object with actor, trigger and observable_action", jsonTypeOf(rawContract), "observable_standard");
  }
  if (!isPlainObject(rawContract)) {
    return REJECT_AT("field_type", "program.behavior_contract", "an object", jsonTypeOf(rawContract), "observable_standard");
  }
  /**
   * THE TWO ACTION FIELDS (Slice 3.2P-R3.7-R2), shape-checked before they are composed.
   *
   * A malformed `action_verb` is a SHAPE fault and reported as one — "team members" in a field
   * that takes one word is the model misreading the contract, not reclaiming an authority. The
   * semantic reason is reserved for a well-formed action that says WHO or WHEN anyway.
   */
  const rawVerb = (rawContract as Record<string, unknown>).action_verb;
  const rawDetail = (rawContract as Record<string, unknown>).action_detail;
  for (const [key, v] of [["action_verb", rawVerb], ["action_detail", rawDetail]] as const) {
    if (typeof v !== "string") {
      return REJECT_AT("field_type", `program.behavior_contract.${key}`, `a string of at most ${CONTRACT_FIELD_LIMIT} characters`, jsonTypeOf(v), "observable_standard");
    }
    // Rendered into participant-facing text, so it carries the same honesty rules as any other
    // content — a fabricated template cannot enter through it.
    const bad = unsafe(v);
    if (bad) return REJECT_UNSAFE(bad, "observable_standard");
  }
  if (actionVerbDefect(rawVerb as string) !== null) {
    /*
      A SHAPE fault, and reported as one. "team members" in a field that takes one word is the
      model misreading the contract; `action_reclaims_authority` is reserved for a well-formed
      action that says WHO or WHEN anyway. The offending value is never echoed — the path names
      the field, which is all a reader needs.
    */
    return REJECT_AT(
      "field_type",
      "program.behavior_contract.action_verb",
      "one verb, in the form it takes after \u201cmust\u201d",
      "string",
      "observable_standard",
    );
  }
  const composedAction = composeObservableAction(rawVerb as string, rawDetail as string);
  /**
   * COMPLETION COMES FROM THE HOST (Slice 3.2P-R3.4-R1).
   *
   * Not read off the response, not merged with it, not defaulted from it: passed in as the
   * Host's `successEvidence`. Anything the model puts under `completion` — strict mode
   * forbids it, but a non-strict provider path or a hand-built payload could — is ignored
   * rather than validated, so there is no shape of response that can supply one.
   *
   * `programContext` returns non-null only when Builder steps 1–4 pass, and step 4 is
   * `evidence_required`, so a criterion exists by the time a generation is legal. The
   * `answers` fallback keeps this honest for direct callers that hold answers but no context.
   */
  const contractResult = validateBehaviorContract({ observable_action: composedAction }, {
    /*
      THE SERVER'S THREE ROLES, assembled here and nowhere else. Every one of them traces to a
      Host answer or to a product decision; none of them can be reached by anything in the
      response. `programContext` is the canonical route and guarantees all three are present —
      the `answers` fallbacks keep direct callers honest without inventing values.
    */
    actor: CANONICAL_ACTOR,
    trigger: ctx?.recurringMoment ?? recurringMomentFrom(answers),
    criterion: ctx?.successEvidence ?? completionCriterionFrom(answers),
  });
  // A well-formed contract that states no behavior. Not retryable: the shape was right.
  if (!contractResult.ok) {
    // The defect travels with the refusal so the ledger records WHICH of the four roles
    // failed and why — the gap that made the R6 window undiagnosable.
    return { ...REJECT("non_observable_standard", "observable_standard"), contract: contractResult.defect } as ProgramValidation;
  }
  /**
   * THE ACTOR IS SERVER-WRITTEN (Slice 3.2P-R3.2-R1). The model's label is validated for shape
   * and then replaced: every participant-facing sentence addresses the learner as `you`, which is
   * exactly the population the Host's audience already selected and cannot drift from it. W3
   * produced "a team member" for a `leaders` audience; there is now nothing for that to reach.
   */
  /*
    `withCanonicalActor` is gone: since R3.6-R1 the actor is passed IN as server authority, so
    there is no model label left to overwrite. Keeping the overwrite would have implied one.
  */
  const contract: BehaviorContract = contractResult.value;

  /*
    NO CONFIRMER AUTHORITY CHECK (Slice 3.2P-R3.4-R1).

    R3.2-R2 built one — relational counterpart, then role-head grounding, then corpus — because
    W3 named "the team lead" for a source that never mentions one. It worked, and W4 was refused
    by it. But it was a floor under a field that should not have existed: the model was being
    asked to name a person for a completion the Host had already described without one, and the
    floor's job was to catch the invention afterwards.

    v11 removes the field, so there is no confirmer to authorise. `confirmer_unauthorized` stays
    in the ledger vocabulary for the W4 row that carries it; nothing on this path emits it.
  */

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
      return REJECT_AT("missing_field", "program.scenario_contract", "an object with pressure_frame", jsonTypeOf(rawScenario), "scenario");
    }
    if (!isPlainObject(rawScenario)) {
      return REJECT_AT("field_type", "program.scenario_contract", "an object", jsonTypeOf(rawScenario), "scenario");
    }
    /*
      ONE FIELD, AND IT IS AN ID (Slice 3.2P-A7-R2). There is no prose here to sweep for
      honesty rules: the participant-facing clause is written by the server from
      `PRESSURE_FRAMES`, so it cannot fabricate a material, evaluate a person or over-claim.
      An unknown id is a SHAPE fault the structural retry can fix, not a meaning fault.
    */
    const rawFrame = (rawScenario as Record<string, unknown>).pressure_frame;
    /*
      AN UNKNOWN ID IS A SHAPE FAULT, and it has to be reported as one. Left to fall through,
      `validateScenarioContract` returns `missing`, which maps to the umbrella
      `scenario_without_pressure` — a MEANING fault that v22 deliberately made non-repairable,
      so a model that simply mistyped an enum value would end the attempt with no retry. Caught
      by the recurring-moment suite, which fed it a frame that does not exist.
    */
    if (typeof rawFrame !== "string" || !pressureFrameIds().includes(rawFrame as PressureFrame)) {
      return REJECT_AT("field_type", "program.scenario_contract.pressure_frame", "one of the offered pressure frames", jsonTypeOf(rawFrame), "scenario");
    }
    const sc = validateScenarioContract(rawScenario, contract);
    /*
      Two distinct meaning faults, reported as two. A situation with no difficulty teaches
      nothing; a situation with its own occasion moves the trained action somewhere the
      standard never asked for. Collapsing the second into the first would hand the Host a
      refusal reason that is simply untrue about their program (Slice 3.2L-R8.1).
    */
    if (!sc.ok) {
      /*
        The DEFECT travels with the code (Slice 3.2P-A5-R2). Five reasons share
        `scenario_without_pressure`, and A5 could not be classified because only the umbrella
        survived. One evaluation, two representations: the product refusal the Host sees, and
        the exact reason the validator computed.
      */
      return {
        ...REJECT(
          sc.defect.reason === "independent_moment" ? "scenario_independent_moment" : "scenario_without_pressure",
          "scenario",
        ),
        scenario: sc.defect,
      } as ProgramValidation;
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
  /*
    NO FOLD, SO NO REFUSAL (Slice 3.2P-R3.7). This built a noun phrase from the Host's moment and
    refused the program when English grammar would not cooperate — which cost W5 a paid window
    and, once the Host owned the moment, would have refused their own ordinary wording. The
    application sections now point at "the next time this happens", so there is nothing to derive
    and nothing to fail. `trigger_not_recurring` stays in the vocabulary for the rows that hold it.
  */
  const applicationRequired = required.includes("field_application") || required.includes("action_decision");
  const applicationContract: ApplicationContract | null = applicationRequired
    ? { applicationMoment: contract.trigger }
    : null;

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
    const contentUnsafe = unsafe(c) ?? (discardedUnsafe?.code === "evidence_overclaim" ? null : discardedUnsafe);
    if (contentUnsafe) return REJECT_UNSAFE(contentUnsafe, kind);
    // Safety still applies to a rationale whenever one is PRESENT — advisory does not
    // mean unchecked; it only means absence is tolerated.
    if (rationale.value.length > 0) {
      const rationaleUnsafe = unsafe(rationale.value);
      if (rationaleUnsafe) return REJECT_UNSAFE(rationaleUnsafe, kind);
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
  if (ceilingUnsafe) return REJECT_UNSAFE(ceilingUnsafe);

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
    if (bad) return REJECT_UNSAFE(bad);
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
  return OUTCOME_OBJECTS.map((alt) =>
    // `\w*` and `\w+` both stand for "the rest of the word / the noun it qualifies" — neither
    // belongs in a stem the prompt has to name (Slice 3.2P-A4-R3 added the `+` form).
    alt.replace(/s\?$/, "").replace(/\\w[*+]/g, "").replace(/\\/g, "").replace(/[()?:]/g, "").trim(),
  ).filter((w) => w.length > 0);
}

/** The same set, written the way a person says it — one source, in `evidence-policy`. */
export function outcomeNounsForPrompt(): string[] {
  return [...OUTCOME_OBJECT_WORDS];
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
    /*
      EVERY rule the validator can refuse on, in its own words (Slice 3.2L-R11.4I). Not a
      summary of them — the list itself, generated from `EVIDENCE_POLICY`. R11.4H described
      part of the set by hand and the next window was refused for a rule the prompt never
      mentioned; a hand-written summary is exactly what cannot be kept true.
    */
    "- FORBIDDEN, every one of these:",
    ...evidencePolicyPromptLines().map((l) => `  ${l}`),
    "- Describe what the training ASKS people to do, not what it will achieve.",
    /*
      SCOPE (Slice 3.2P-A4-R2). The rules above were rendered without the one thing every one
      of them already declared: where they apply. A1 (v15) and A4 (v18) were both refused on
      `program` — the title, the assumptions and the warnings — and no element has ever been
      refused for evidence. The model was obeying a ceiling it had been told was about
      participant-facing prose, in fields that are not participant-facing.
    */
    `- ${evidenceScopeLine()}`,
    /*
      THE REMEDY CLAUSE (Slice 3.2P-A4-R2). The advisory instruction ASKS for what else may be
      needed, and "a policy change may be required to improve communication" is the natural way
      to write that — a causal verb at an outcome noun, with no negator in front of it to save
      it. Measured: of thirteen plausible advisory sentences, the three that were refused were
      all of this shape. So the distinction is stated as a relation, not as a word list, and
      honest limitation language is explicitly protected — a warning that cannot say what the
      training will not do is not a warning.
    */
    "- LIMITATIONS ARE WELCOME; THE OUTCOME OF A REMEDY IS NOT. Name what sits outside this training's control, what else may be needed, and what stays unknown — never what that other thing will achieve.",
    '  ALLOWED, and wanted: "Training alone cannot ensure consistency." "A shared workflow may also be needed." "Coverage may need to be addressed separately from this training." "This training does not show whether the behaviour was used in real work."',
    '  REFUSED, the same sentence finished with an outcome: "A workflow change will improve communication." "Managers must reinforce this so the team performs consistently."',
    "- The five ways this goes wrong, and the honest form of each:",
    ...evidenceFamilyContrasts().map((c) => `  NEVER "${c.forbidden}"  →  INSTEAD "${c.legal}"`),
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
  /*
    THE HOST'S MOMENT, VERBATIM (Slice 3.2P-R3.7). It used to be a folded noun phrase; the
    renderers no longer read it as one, and this answers only "is there a moment to apply at",
    which the Host's own answer settles.
  */
  const moment = c.behavior.trigger.trim();
  return moment.length > 0 ? moment : c.application?.applicationMoment ?? null;
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

  const behavior = validateBehaviorContract(
    { observable_action: c.behavior.observableAction },
    /*
      Taken from the REVIEW STATE, not re-read from answers: a Host editing in review is working
      from the contracts they were shown, and silently swapping in a different moment or evidence
      mid-review would change sentences they never touched. All three came from the Host (or from
      `CANONICAL_ACTOR`) when the state was built.
    */
    { actor: c.behavior.actor, trigger: c.behavior.trigger, criterion: c.behavior.completion.criterion },
  );
  if (!behavior.ok) {
    const reason: ReviewBlockReason = behavior.defect.reason === "missing" || behavior.defect.reason === "too_long"
      ? "standard_incomplete"
      : "standard_not_observable";
    return { ok: false, reason, kind: "observable_standard" };
  }

  if (required.includes("scenario")) {
    if (!c.scenario) return { ok: false, reason: "scenario_incomplete", kind: "scenario" };
    const sc = validateScenarioContract({ pressure_frame: c.scenario.frame }, c.behavior);
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
