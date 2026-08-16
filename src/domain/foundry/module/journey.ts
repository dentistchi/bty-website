/**
 * Reality-Grounded Guided Journey — V1 contract + deterministic mapper (Slice 3.2C-B3A).
 *
 * A Journey is the PARTICIPANT-FACING structured experience approved by the Host.
 * It is stored as ONE versioned, namespaced contract inside a draft's answers
 * (`answers.realityGroundedJourneyV1`) and frozen verbatim into the immutable
 * module snapshot at publish — so what the Host approves is exactly what the
 * learner receives.
 *
 * B3A is DETERMINISTIC only — no LLM. Every participant-facing sentence traces to
 * a concrete existing BuilderAnswers field (grounding source `host_statement`).
 * The mapper NEVER invents facts, incidents, policies, roles, or standards; it
 * preserves the Host's exact words, omits optional elements with no grounded
 * content, and marks a missing REQUIRED element `needs_confirmation` (which blocks
 * approval) rather than substituting generic language.
 *
 * Pure domain: no I/O, no display strings beyond the Host's own content, no LLM.
 */

import type { BuilderAnswers } from "./module-builder";
import { isObservableStandardShape } from "./observableStandardShape";

export type JourneyElementKind =
  | "why_it_matters"
  | "observable_standard"
  | "scenario"
  | "reflection"
  | "action_decision"
  | "field_application"
  | "evidence"
  | "completion_check"
  /** Slice 3.2L — what happens after the training, and when. */
  | "follow_up";

/**
 * B3A grounded every element in a Host statement only. Slice 3.2L adds authored programs,
 * so an element may now also come from the model, from a Host rewrite of model output, or
 * from a deterministic derivation. The learner preview attributes content honestly on this
 * basis — AI output is never labelled "From your: …". See `program-authorship.ts`.
 */
export type GroundingSourceType = "host_statement" | "ai_proposed" | "host_edited" | "deterministic_derived";
export type ConfirmationStatus = "grounded" | "needs_confirmation";

export type JourneyGrounding = {
  sourceType: GroundingSourceType;
  /** The exact BuilderAnswers key that grounded this element (audit/provenance). */
  field: keyof BuilderAnswers;
};

export type JourneyElement = {
  id: string;
  kind: JourneyElementKind;
  /** Participant-facing content — the Host's own words (or a Host edit). */
  content: string;
  grounding: JourneyGrounding[];
  confirmationStatus: ConfirmationStatus;
};

export type RealityGroundedJourneyV1 = {
  version: 1;
  displayTitle: string;
  /** The learner title must be Host-approved, never silently the raw problem phrase. */
  displayTitleStatus: ConfirmationStatus;
  elements: JourneyElement[];
};

/** Canonical render order. Each kind appears at most once in V1. */
export const JOURNEY_KIND_ORDER: readonly JourneyElementKind[] = [
  "why_it_matters",
  "observable_standard",
  "scenario",
  "reflection",
  "action_decision",
  "field_application",
  "evidence",
  "completion_check",
  "follow_up",
];

/** Elements that must be grounded before the Journey can be approved/published. */
export const REQUIRED_JOURNEY_KINDS: readonly JourneyElementKind[] = [
  "why_it_matters",
  "observable_standard",
  "completion_check",
];

/** Stable, deterministic element id (one element per kind in V1). */
export function journeyElementId(kind: JourneyElementKind): string {
  return `el_${kind}`;
}

const asText = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Which BuilderAnswers field grounds each participant-facing element. */
const KIND_SOURCE: Partial<Record<JourneyElementKind, keyof BuilderAnswers>> = {
  why_it_matters: "problem",
  observable_standard: "observableBehavior",
  evidence: "successEvidence",
  reflection: "sharedQuestion",
  completion_check: "completionPrompt",
};

/**
 * Deterministically derive a Journey from a draft's approved BuilderAnswers.
 *
 * - REQUIRED elements (why_it_matters, observable_standard, completion_check) are
 *   always present; if their grounding field is empty they are emitted with empty
 *   content + `needs_confirmation` (never a generic default) so approval is blocked.
 * - OPTIONAL elements (evidence, reflection) are OMITTED when their field is empty
 *   (never invented). scenario / action_decision / field_application have no
 *   grounded source in V1 BuilderAnswers, so they are never emitted here.
 * - displayTitle is derived from the problem's first line but marked
 *   `needs_confirmation` — the Host must review/approve the learner title.
 */
export function mapAnswersToJourney(answers: BuilderAnswers | undefined): RealityGroundedJourneyV1 {
  const a = answers ?? {};
  const elements: JourneyElement[] = [];

  for (const kind of JOURNEY_KIND_ORDER) {
    const field = KIND_SOURCE[kind];
    if (!field) continue; // no grounded source in V1 → never emit (no invention)
    const content = asText(a[field]);
    const required = REQUIRED_JOURNEY_KINDS.includes(kind);
    if (!content && !required) continue; // optional + empty → omit
    elements.push({
      id: journeyElementId(kind),
      kind,
      content,
      grounding: content ? [{ sourceType: "host_statement", field }] : [],
      confirmationStatus: content ? "grounded" : "needs_confirmation",
    });
  }

  /*
    Slice 3.2R-R2.1 — seed the learner-facing title from the Host's OWN title when they have
    written one. Before this, the seed was always the problem's first line, which is how a
    recurring-condition sentence ended up presented to learners as the name of the training.

    displayTitleStatus is deliberately UNCHANGED (`needs_confirmation`). The Review-step
    confirmation gate is the human approval the Builder architecture already depends on, and this
    slice does not remove approval steps — it only changes what is pre-filled for the Host to
    approve. `answers.title` remains the single editable authority; this is a derived seed.
  */
  const authoredTitle = asText(a.title);
  const firstLine = asText(a.problem).split(/\r?\n/)[0]?.trim() ?? "";
  return {
    version: 1,
    displayTitle: authoredTitle.length > 0 ? authoredTitle : firstLine,
    displayTitleStatus: "needs_confirmation",
    elements,
  };
}

/** Structural validation. Returns blocking reason codes (empty = valid shape). */
export function validateJourney(j: unknown): string[] {
  const errors: string[] = [];
  const journey = j as Partial<RealityGroundedJourneyV1> | null;
  if (!journey || typeof journey !== "object") return ["journey_missing"];
  if (journey.version !== 1) errors.push("bad_version");
  if (typeof journey.displayTitle !== "string") errors.push("bad_title");
  if (journey.displayTitleStatus !== "grounded" && journey.displayTitleStatus !== "needs_confirmation") {
    errors.push("bad_title_status");
  }
  if (!Array.isArray(journey.elements)) return [...errors, "bad_elements"];

  const seen = new Set<string>();
  const orderIdx = (k: JourneyElementKind) => JOURNEY_KIND_ORDER.indexOf(k);
  let prevOrder = -1;
  for (const el of journey.elements) {
    if (!el || typeof el !== "object") { errors.push("bad_element"); continue; }
    if (!JOURNEY_KIND_ORDER.includes(el.kind)) errors.push("bad_kind");
    if (el.id !== journeyElementId(el.kind)) errors.push("bad_element_id");
    if (seen.has(el.id)) errors.push("duplicate_element");
    seen.add(el.id);
    if (typeof el.content !== "string") errors.push("bad_content");
    if (el.confirmationStatus !== "grounded" && el.confirmationStatus !== "needs_confirmation") errors.push("bad_status");
    const idx = orderIdx(el.kind);
    if (idx < prevOrder) errors.push("bad_order");
    prevOrder = idx;
  }
  for (const kind of REQUIRED_JOURNEY_KINDS) {
    if (!journey.elements.some((e) => e?.kind === kind)) errors.push(`missing_required:${kind}`);
  }
  return errors;
}

/** True when the Journey is structurally valid AND fully grounded (Host-approvable). */
export function isJourneyApprovable(j: RealityGroundedJourneyV1 | undefined): boolean {
  if (!j || validateJourney(j).length > 0) return false;
  if (j.displayTitleStatus !== "grounded") return false;
  return j.elements.every((e) => e.confirmationStatus === "grounded");
}

/** Element kinds still needing Host confirmation (drives the approval gate UI). */
export function unresolvedJourneyElements(j: RealityGroundedJourneyV1 | undefined): JourneyElementKind[] {
  if (!j) return [];
  const out = j.elements.filter((e) => e.confirmationStatus === "needs_confirmation").map((e) => e.kind);
  return out;
}

/**
 * The approved `action_decision` content, or null (Slice 3.2M-1).
 *
 * Grounded elements only — the same rule `toPublicJourney` uses, so the gate can never demand a
 * decision for a section the learner was never shown.
 */
export function journeyActionDecision(j: RealityGroundedJourneyV1 | undefined): string | null {
  const el = j?.elements.find((e) => e.kind === "action_decision" && e.confirmationStatus === "grounded");
  const v = (el?.content ?? "").trim();
  return v.length > 0 ? v : null;
}

/**
 * The approved `reflection` content, or null (Slice 3.2R-R8B).
 *
 * What the learner is asked to EXAMINE about their current practice — never what they are asked
 * to commit to, which is `completion_check`. Grounded elements only, the same rule
 * `toPublicJourney` uses, so the gate can never demand an answer to a section the learner was
 * never shown.
 */
export function journeyReflection(j: RealityGroundedJourneyV1 | undefined): string | null {
  const el = j?.elements.find((e) => e.kind === "reflection" && e.confirmationStatus === "grounded");
  const v = (el?.content ?? "").trim();
  return v.length > 0 ? v : null;
}

/**
 * The approved `field_application` content, or null (Slice 3.2M-3).
 *
 * What the learner was asked to do in REAL WORK — the thing a follow-up should ask about.
 * Grounded elements only, the same rule the learner-facing projection uses.
 */
export function journeyFieldApplication(j: RealityGroundedJourneyV1 | undefined): string | null {
  const el = j?.elements.find((e) => e.kind === "field_application" && e.confirmationStatus === "grounded");
  const v = (el?.content ?? "").trim();
  return v.length > 0 ? v : null;
}

/**
 * The approved `observable_standard` content, or null (Slice 3.2M-4).
 *
 * R8 wrote the standard as what ANOTHER PERSON can see or hear, which is exactly what an
 * independent observer must be asked about — never `field_application`, which tells the
 * learner what to try, and never the completion prompt.
 */
export function journeyObservableStandard(j: RealityGroundedJourneyV1 | undefined): string | null {
  const el = j?.elements.find((e) => e.kind === "observable_standard" && e.confirmationStatus === "grounded");
  const v = (el?.content ?? "").trim();
  if (v.length === 0) return null;
  /*
    A QUESTION IS NOT SOMETHING ANYONE CAN HAVE SEEN (Slice R4-R1A).

    This is the ONE place the observation system asks "what behaviour is there to observe?" —
    the observer page, the discovery card, the Host line and the learner's evidence rungs all
    read it and nothing else. So it is where the answer has to be honest.

    Measured live: a Host typed "At the next huddle, what exact words will you use to confirm the
    owner, action, and deadline?" into `observableBehavior`, the deterministic mapper copied it
    faithfully, and a colleague was then asked whether they had personally seen or heard a
    question. There is no truthful answer to that, and whatever they pressed would have been
    recorded as evidence of the behaviour.

    Refusing here rather than in the UI is deliberate: the surfaces consume canonical truth and
    must never become semantic validators of their own. `null` already means "no observation path
    for this training" everywhere — every caller handles it, and the Host surface says so out
    loud rather than showing a learner as unobserved.

    NOT A REWRITE. The published snapshot is untouched and the learner still reads their Journey
    exactly as approved (`toPublicJourney`). Only the claim that this sentence can carry
    OBSERVATION AUTHORITY is withdrawn.
  */
  return isObservableStandardShape(v) ? v : null;
}

/** The approved participant completion question (completion_check content), or null. */
export function journeyCompletionCheck(j: RealityGroundedJourneyV1 | undefined): string | null {
  const el = j?.elements.find((e) => e.kind === "completion_check");
  const c = (el?.content ?? "").trim();
  return c.length > 0 ? c : null;
}

export type PublicJourneyElement = { id: string; kind: JourneyElementKind; content: string };
export type PublicJourney = { displayTitle: string; elements: PublicJourneyElement[] };

/**
 * The learner-safe projection: ordered display title + grounded elements' content
 * only. NEVER exposes grounding metadata, confirmation status, or any
 * needs_confirmation content (approval already guarantees all grounded, but this
 * filters defensively).
 */
export function toPublicJourney(j: RealityGroundedJourneyV1 | undefined): PublicJourney | null {
  if (!j) return null;
  return {
    displayTitle: j.displayTitle,
    elements: j.elements
      .filter((e) => e.confirmationStatus === "grounded" && e.content.trim().length > 0)
      .map((e) => ({ id: e.id, kind: e.kind, content: e.content })),
  };
}
