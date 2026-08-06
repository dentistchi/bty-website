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
  | { ok: false; code: ProgramRejectCode; kind?: JourneyElementKind; diagnosis?: StructuralDiagnosis };

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
export const ARTIFACT_NOUNS = [
  "template", "templates", "checklist", "checklists", "form", "forms", "guide", "guides",
  "manual", "manuals", "policy", "policies", "procedure", "procedures", "sop", "sops",
  "document", "documents", "file", "files", "pdf", "pdfs", "spreadsheet", "spreadsheets",
  "dashboard", "dashboards", "tool", "tools", "system", "systems", "tracker", "trackers",
  "portal", "portals", "playbook", "playbooks", "handbook", "handbooks", "protocol", "protocols",
  "worksheet", "worksheets", "questionnaire", "questionnaires", "software", "platform", "platforms",
  "database", "databases", "app", "apps", "wiki", "wikis", "logbook", "logbooks",
  "record", "records", "log", "logs", "register", "registers", "sheet", "sheets",
] as const;

/** Singularise just enough to compare an artifact head against the Host's own words. */
function artifactStem(noun: string): string {
  const n = noun.toLowerCase();
  if (n.endsWith("ies")) return `${n.slice(0, -3)}y`;
  if (n.endsWith("es") && /(ch|sh|s|x|z)es$/.test(n)) return n.slice(0, -2);
  if (n.endsWith("s") && !n.endsWith("ss")) return n.slice(0, -1);
  return n;
}

const NOUN_ALT = ARTIFACT_NOUNS.join("|");

/**
 * GREEDY modifiers on purpose. "the handoff record template" contains TWO artifact nouns;
 * a lazy match stops at "record", finds it grounded (the Host wrote "Handoff record") and
 * never examines "template" — which is the ungrounded one. Measured: that made the live
 * miss pass. Greedy matching reaches the HEAD noun, which is the artifact being claimed.
 *
 * A definite/possessive reference presupposes the artifact already exists:
 *   "the handoff record template", "our checklist", "your workflow tool".
 * An INDEFINITE reference ("a shared handoff record") proposes one, and never matches.
 */
const DEFINITE_ARTIFACT = new RegExp(
  `\\b(?:the|our|your|its|their|this|that|these|those|existing|available|current|ready-made|pre-made)\\s+((?:[\\w'-]+\\s+){0,3}(${NOUN_ALT}))\\b`,
  "gi",
);

/** "access to the necessary tools and templates" — an availability claim. */
const ACCESS_ARTIFACT = new RegExp(
  `\\baccess\\s+to\\s+(?:the\\s+|any\\s+)?(?:necessary\\s+|required\\s+|appropriate\\s+|relevant\\s+)?((?:[\\w'-]+\\s+){0,3}(${NOUN_ALT}))\\b`,
  "gi",
);

/** Framing that PROPOSES an artifact rather than presupposing one. */
const CREATION_FRAME =
  /\b(?:create|creating|build|building|design|designing|develop|developing|establish|establishing|agree\s+on|agreeing\s+on|define|defining|decide\s+on|draft|drafting|set\s+up|setting\s+up|write|writing|make|making|introduce|introducing|adopt|adopting|choose|choosing|identify|identifying)\b/i;

/** Conditional framing — "if your team has one" — is not an existence claim. */
const CONDITIONAL_FRAME = /\bif\s+(?:you|your team|one|it|they|there)\b|\bif\s+\w+\s+(?:has|have|exists?)\b|\bwhere available\b|\bif any\b/i;

const LOOKBACK = 70;

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
  for (const re of [DEFINITE_ARTIFACT, ACCESS_ARTIFACT]) {
    re.lastIndex = 0;
    for (let m = re.exec(text); m !== null; m = re.exec(text)) {
      const head = artifactStem(m[2]);
      // Grounded: the Host named this kind of artifact themselves.
      if (corpus.includes(head)) continue;
      // Proposed, not presupposed.
      const window = text.slice(Math.max(0, m.index - LOOKBACK), m.index);
      if (CREATION_FRAME.test(window)) continue;
      // Conditional anywhere in the surrounding sentence.
      const sentence = text.slice(Math.max(0, m.index - LOOKBACK), Math.min(text.length, m.index + m[0].length + LOOKBACK));
      if (CONDITIONAL_FRAME.test(sentence)) continue;
      return head;
    }
  }
  return null;
}

/** Invented concrete specifics the Host never supplied. */
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

export const PROGRAM_SCHEMA_NAME = "bty_guided_program_v1";

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
      required: ["display_title", "elements", "assumptions", "warnings", "evidence_language"],
      properties: {
        display_title: { type: "string" },
        evidence_language: { type: "string" },
        assumptions: { type: "array", items: { type: "string" } },
        warnings: { type: "array", items: { type: "string" } },
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
  for (const k of ["display_title", "elements", "evidence_language"]) {
    if (!(k in p)) return REJECT_AT("missing_field", `program.${k}`, k === "elements" ? "array" : "string", "missing");
  }

  const title = cleanString(p.display_title, LIMITS.title, 4);
  if (!title.ok) return REJECT_AT(title.code, "program.display_title", "string", jsonTypeOf(p.display_title));

  const evidenceLanguage = cleanString(p.evidence_language, LIMITS.evidenceLanguage, 10);
  if (!evidenceLanguage.ok) return REJECT_AT(evidenceLanguage.code, "program.evidence_language", "string", jsonTypeOf(p.evidence_language));

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
    // Invented specifics first: "section 4.2 of the policy" is BOTH, and the more precise
    // diagnosis is the more useful one to record and to show.
    if (INVENTED_SPECIFICS.some((re) => re.test(text))) return "invented_specifics";
    if (ungroundedArtifact(text, corpus) !== null) return "material_fabrication";
    if (PERSON_EVALUATION.some((re) => re.test(text))) return "person_evaluation";
    if (INTERNAL_JARGON.some((re) => re.test(text))) return "internal_jargon";
    return null;
  };
  const allowed = new Set<JourneyElementKind>([...required, "evidence", "reflection"]);

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

    const c = content.value;

    // --- honesty (participant-facing content AND its Host-facing rationale) ---
    const contentUnsafe = unsafe(c);
    if (contentUnsafe) return REJECT(contentUnsafe, kind);
    // Safety still applies to a rationale whenever one is PRESENT — advisory does not
    // mean unchecked; it only means absence is tolerated.
    if (rationale.value.length > 0) {
      const rationaleUnsafe = unsafe(rationale.value);
      if (rationaleUnsafe) return REJECT(rationaleUnsafe, kind);
    }

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
