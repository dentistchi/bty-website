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

export const PROGRAM_AUTHORSHIP_VERSION = "program_authorship_v1";

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
  | "scenario_unrelated"
  | "generic_completion"
  | "non_observable_standard"
  | "section_contradiction"
  | "duplicate_content"
  | "internal_jargon"
  | "person_evaluation"
  | "invalid_assumptions"
  | "invalid_warnings";

export type ProgramValidation =
  | { ok: true; value: ProgramValidated }
  | { ok: false; code: ProgramRejectCode; kind?: JourneyElementKind };

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
const CONTROL_CHARS = /[ --]/;
const UNSAFE = [/<[^>]+>/, /```|~~~/, /data:\s*[\w.+-]+\/[\w.+-]+/i, /<\s*script|javascript:|onerror\s*=|onload\s*=/i];
function hasUnsafeMarkup(raw: string): boolean {
  return CONTROL_CHARS.test(raw) || UNSAFE.some((re) => re.test(raw));
}

/** Phrases that, ASSERTED, claim what only later observation could show. */
const OVERCLAIM_PHRASES = [
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
const NEGATOR = /\b(?:not|never|cannot|can't|doesn't|does not|don't|do not|isn't|is not|won't|will not|without|neither|nor|rather than|instead of)\b|않|아니|없/i;
const NEGATION_WINDOW = 48;

/** True only when an overclaim phrase is ASSERTED rather than denied. */
function assertsOverclaim(text: string): boolean {
  OVERCLAIM.lastIndex = 0;
  for (let m = OVERCLAIM.exec(text); m !== null; m = OVERCLAIM.exec(text)) {
    const before = text.slice(Math.max(0, m.index - NEGATION_WINDOW), m.index);
    if (!NEGATOR.test(before)) return true;
  }
  return false;
}

/** Claims a concrete asset or policy already exists. */
const MATERIAL_EXISTS = [
  /\bis attached\b/i,
  /\bhas been (attached|uploaded|added|created|approved)\b/i,
  /\balready (exists|attached|uploaded)\b/i,
  /\b(the|our|this|your) (?:(?:attached|uploaded|official|approved|existing|current)\s+){1,3}(file|document|policy|checklist|video|pdf|guide|manual|sop|procedure)\b/i,
];

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
// Validator — fail-closed, whole-proposal rejection
// ---------------------------------------------------------------------------

const REJECT = (code: ProgramRejectCode, kind?: JourneyElementKind): ProgramValidation => ({ ok: false, code, kind });

/**
 * Validate one raw parsed provider program against the Host's actual context.
 *
 * Fail-closed and whole-proposal: any structural, safety, honesty or coherence failure
 * rejects everything with a stable code. A partially-valid program is not applied,
 * because a Host reviewing eight sections cannot be expected to notice that the third
 * one silently fabricated a policy number.
 */
export function validateProgramProposal(raw: unknown, answers: BuilderAnswers | undefined): ProgramValidation {
  if (!isPlainObject(raw)) return REJECT("not_object");
  const p = raw.program;
  if (!isPlainObject(p)) return REJECT("missing_program");
  for (const k of ["display_title", "elements", "evidence_language"]) if (!(k in p)) return REJECT("missing_field");

  const title = cleanString(p.display_title, LIMITS.title, 4);
  if (!title.ok) return REJECT(title.code);

  const evidenceLanguage = cleanString(p.evidence_language, LIMITS.evidenceLanguage, 10);
  if (!evidenceLanguage.ok) return REJECT(evidenceLanguage.code);

  if (!Array.isArray(p.elements) || p.elements.length === 0) return REJECT("field_type");

  const ctx = programContext(answers);
  const required = requiredProgramKinds(answers);
  const allowed = new Set<JourneyElementKind>([...required, "evidence", "reflection"]);

  const seen = new Set<JourneyElementKind>();
  const elements: ProposedElement[] = [];

  for (const rawEl of p.elements) {
    if (!isPlainObject(rawEl)) return REJECT("field_type");
    const kind = rawEl.kind as JourneyElementKind;
    if (!JOURNEY_KIND_ORDER.includes(kind)) return REJECT("unknown_kind");
    if (seen.has(kind)) return REJECT("duplicate_kind", kind);
    if (!allowed.has(kind)) return REJECT("unrequested_kind", kind);
    seen.add(kind);

    const content = cleanString(rawEl.content, LIMITS.content, MIN_CONTENT);
    if (!content.ok) return REJECT(content.code, kind);
    const rationale = cleanString(rawEl.rationale, LIMITS.rationale, 5);
    if (!rationale.ok) return REJECT(rationale.code, kind);

    const c = content.value;

    // --- honesty ---------------------------------------------------------
    if (assertsOverclaim(c)) return REJECT("evidence_overclaim", kind);
    if (MATERIAL_EXISTS.some((re) => re.test(c))) return REJECT("material_fabrication", kind);
    if (INVENTED_SPECIFICS.some((re) => re.test(c))) return REJECT("invented_specifics", kind);
    if (PERSON_EVALUATION.some((re) => re.test(c))) return REJECT("person_evaluation", kind);
    if (INTERNAL_JARGON.some((re) => re.test(c))) return REJECT("internal_jargon", kind);

    // --- per-kind meaning ------------------------------------------------
    if (kind === "why_it_matters" && ctx) {
      // The manager's complaint replayed at the team is the R2F defect this closes.
      if (overlapRatio(c, ctx.problemStatement) >= 0.8) return REJECT("complaint_replay", kind);
    }
    if (kind === "observable_standard") {
      const wordCount = c.split(/\s+/).filter(Boolean).length;
      if (wordCount < 4) return REJECT("non_observable_standard", kind);
    }
    if (kind === "action_decision") {
      if (ONLY_REFLECTION.test(c) || !DECISION_COMMITMENT.test(c)) return REJECT("decision_is_only_reflection", kind);
    }
    if (kind === "field_application") {
      if (!APPLICATION_ACTOR.test(c)) return REJECT("application_without_actor", kind);
    }
    if (kind === "scenario" && ctx) {
      // A scenario about something else teaches nothing about this behavior.
      const related = Math.max(overlapRatio(c, ctx.observableBehavior), overlapRatio(c, ctx.problemStatement));
      if (related < 0.12) return REJECT("scenario_unrelated", kind);
    }
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

  if (assertsOverclaim(evidenceLanguage.value)) return REJECT("evidence_overclaim");

  const assumptions = cleanList(p.assumptions, LIMITS.assumption, "invalid_assumptions");
  if (!assumptions.ok) return REJECT(assumptions.code);
  const warnings = cleanList(p.warnings, LIMITS.warning, "invalid_warnings");
  if (!warnings.ok) return REJECT(warnings.code);

  // Canonical order, never the model's order.
  elements.sort((a, b) => JOURNEY_KIND_ORDER.indexOf(a.kind) - JOURNEY_KIND_ORDER.indexOf(b.kind));

  return {
    ok: true,
    value: {
      version: PROGRAM_AUTHORSHIP_VERSION,
      proposal: {
        displayTitle: title.value,
        elements,
        assumptions: assumptions.value,
        warnings: warnings.value,
        evidenceLanguage: evidenceLanguage.value,
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
