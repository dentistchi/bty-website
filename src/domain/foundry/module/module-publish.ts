/**
 * Foundry Guided Module Builder — publish domain (pure).
 *
 * The rules that turn an APPROVED builder draft into a publishable Foundry event:
 * approval-readiness for the builder's REAL field set, the immutable module
 * snapshot whitelist, and the participant-material derivation. No DB, no I/O, no
 * providers, no display strings — persistence, event creation, QR, and asset
 * lifecycle live in the service layer.
 *
 * Why a builder-specific approval gate: the Slice-1 `validateModuleDraft` was
 * written for a conceptual field set (capability / targetRoles / reflectionPrompt
 * / actionDecisionPrompt) that the actual manual builder never captures. The
 * builder's own per-step completeness (`stepBlocker`) is the truthful definition
 * of "ready", so approval is derived from it here — the single source both approve
 * and publish consult.
 */

import { stepBlockers, type BuilderAnswers } from "./module-builder";

// ---------------------------------------------------------------------------
// Approval readiness (builder's real fields)
// ---------------------------------------------------------------------------

/** The builder input steps whose completeness is required before approval. */
const APPROVAL_STEPS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Collect the blocking reasons that prevent approving/publishing this draft, using
 * the builder's own per-step completeness. Adds the one gate `stepBlocker` cannot
 * express: a YouTube material needs its URL present (step 6 only checks that a
 * material KIND was chosen). PDF material completeness (a stored asset exists) is
 * checked in the service, which alone can see the asset rows. Empty array = ready.
 */
export function builderApprovalErrors(answers: BuilderAnswers | undefined): string[] {
  const a = answers ?? {};
  const errors: string[] = [];
  for (const step of APPROVAL_STEPS) {
    // ALL of a step's unmet requirements (Slice 3.2R-R2.1) — Step 1 has two, and a Review list
    // that named only the first would send the Host back a second time for the second.
    errors.push(...stepBlockers(step, a));
  }
  if (a.materialIntent === "youtube" && !(a.materialText ?? "").trim()) {
    errors.push("material_youtube_url_required");
  }
  return errors;
}

/** True only when the draft is complete enough for the host to approve it. */
export function isBuilderApprovable(answers: BuilderAnswers | undefined): boolean {
  return builderApprovalErrors(answers).length === 0;
}

// ---------------------------------------------------------------------------
// Review readiness — the SINGLE mapping from blocking codes to Review sections
// ---------------------------------------------------------------------------

/**
 * The Review-screen sections a blocking field belongs to. Every code that
 * `builderApprovalErrors` (and the service-only `material_pdf_required`) can emit
 * MUST map to one of these — this is the guarantee that no required field can block
 * approval without a visible, highlightable Review row. (Slice 2.4A.3.)
 */
export type ReviewSectionKey =
  /** Slice 3.2R-R2.1 — the training's NAME. Its own section, because it is its own concept. */
  | "title"
  | "problem"
  | "audience"
  /** "When it happens" — the Host's recurring moment (Slice 3.2P-R3.6-R1). */
  | "recurringMoment"
  | "behavior"
  | "evidence"
  | "learning"
  | "material"
  | "followUp";

export type ReviewMissingSection = { section: ReviewSectionKey; step: number };

/** Blocking-code → Review section + editable Builder step. The exhaustive map. */
const CODE_TO_SECTION: Readonly<Record<string, ReviewMissingSection>> = {
  /*
    Slice 3.2R-R2.1. Registered here the moment `stepBlocker` began emitting it — an unmapped
    blocking code is exactly the failure this map exists to prevent, and the invariant test caught
    it on the first run. Step 1, like `problem_required`, but its OWN section: the Review screen
    must show the name and the recurring condition as two rows, or it reproduces on Review the
    same conflation this slice removed from Step 1.
  */
  title_required: { section: "title", step: 1 },
  problem_required: { section: "problem", step: 1 },
  audience_required: { section: "audience", step: 2 },
  audience_detail_required: { section: "audience", step: 2 },
  /*
    REGISTERED IN BOTH READINESS LAYERS (Slice 3.2P-R3.6-R1). Generation readiness
    (`programSourceBlocker`) and approval readiness (`builderApprovalErrors`) each ask about the
    recurring moment, and the Review screen renders from THIS map. Registering it in only one
    would let Review report a draft as ready to draft while the server refused it, with nothing
    on screen naming what was missing — the failure mode R3.6 measured and set out to avoid.
  */
  recurring_moment_required: { section: "recurringMoment", step: 3 },
  behavior_required: { section: "behavior", step: 4 },
  evidence_required: { section: "evidence", step: 5 },
  learning_need_required: { section: "learning", step: 6 },
  material_intent_required: { section: "material", step: 7 },
  material_youtube_url_required: { section: "material", step: 7 },
  material_pdf_required: { section: "material", step: 7 },
  /*
    Slice 3.2R-R3 — a server-only code, like `material_pdf_required` beside it. It must map to
    a visible Review row, because a blocker the Host cannot see is a blocker they cannot clear.
  */
  material_review_required: { section: "material", step: 7 },
  follow_up_required: { section: "followUp", step: 8 },
};

/** Every blocking code the readiness gates can emit — used to prove the map is total. */
export const ALL_BLOCKING_CODES: readonly string[] = [
  "title_required",
  "problem_required",
  "audience_required",
  "audience_detail_required",
  "recurring_moment_required",
  "behavior_required",
  "evidence_required",
  "learning_need_required",
  "material_intent_required",
  "material_youtube_url_required",
  "material_pdf_required",
  "follow_up_required",
];

/**
 * The canonical, deterministic list of missing Review sections — the SINGLE source
 * of truth the Review screen consults for both the "needs attention" summary and
 * per-row highlighting, derived from the exact same gate that disables Approve.
 *
 * `extraCodes` folds in service-only gates the pure domain cannot see (a missing PDF
 * asset → `material_pdf_required`). Sections are de-duplicated and ordered by step,
 * so multiple codes for one section (material intent + missing file) surface once.
 * Empty array ⇔ approvable.
 */
export function reviewMissingSections(
  answers: BuilderAnswers | undefined,
  extraCodes: readonly string[] = [],
): ReviewMissingSection[] {
  const codes = [...builderApprovalErrors(answers), ...extraCodes];
  const seen = new Set<ReviewSectionKey>();
  const out: ReviewMissingSection[] = [];
  for (const code of codes) {
    const mapped = CODE_TO_SECTION[code];
    if (mapped && !seen.has(mapped.section)) {
      seen.add(mapped.section);
      out.push(mapped);
    }
  }
  out.sort((a, b) => a.step - b.step);
  return out;
}

// ---------------------------------------------------------------------------
// Participant material derivation
// ---------------------------------------------------------------------------

export type PublishMaterial =
  | { kind: "youtube"; url: string }
  | { kind: "pdf" }
  | { kind: "unsupported"; reason: string };

/**
 * What participant-delivery content this draft publishes to. The builder UI only
 * offers `youtube` and `pdf`; any other intent (or none) is `unsupported` so the
 * service refuses to publish rather than fabricate a delivery surface. The PDF
 * asset itself is resolved in the service (domain can't see storage).
 */
export function deriveEventMaterial(answers: BuilderAnswers | undefined): PublishMaterial {
  const a = answers ?? {};
  if (a.materialIntent === "youtube") {
    const url = (a.materialText ?? "").trim();
    if (!url) return { kind: "unsupported", reason: "material_youtube_url_required" };
    return { kind: "youtube", url };
  }
  if (a.materialIntent === "pdf") return { kind: "pdf" };
  return { kind: "unsupported", reason: "material_intent_unsupported" };
}

// ---------------------------------------------------------------------------
// Immutable module snapshot (whitelist)
// ---------------------------------------------------------------------------

/**
 * The design fields frozen into `foundry_event_module.module_snapshot` at publish.
 * A strict WHITELIST — a raw draft row is never cloned. Runtime/lifecycle/identity
 * keys (id, owner, status, stamps, version, parent, asset refs) are deliberately
 * excluded; they belong to the draft/event, not the frozen design. Unknown or
 * deprecated answer keys are dropped.
 */
export const SNAPSHOT_ANSWER_KEYS: readonly (keyof BuilderAnswers)[] = [
  // Slice 3.2R-R2.1 — the Host-authored name, frozen INDEPENDENTLY of `problem`. Both travel
  // into the immutable snapshot; neither is reconstructed from the other at any later read.
  "title",
  "problem",
  "audienceType",
  "audienceDetail",
  "observableBehavior",
  "successEvidence",
  "evidenceType",
  "learningNeed",
  "learningNeeds",
  "materialIntent",
  "materialText",
  "completionPrompt",
  "arenaRecommended",
  "followUpDays",
  // Reality-Grounded Journey V1 (Slice 3.2C-B3A) — the exact Host-approved
  // participant-facing Journey is frozen into the snapshot so the learner receives
  // precisely what was approved for this Run.
  "realityGroundedJourneyV1",
];

export type ModuleSnapshot = Partial<Pick<BuilderAnswers, (typeof SNAPSHOT_ANSWER_KEYS)[number]>>;

/**
 * Build the immutable module snapshot from a draft's answers — whitelist only,
 * undefined keys omitted. Pure and deterministic: the same answers always freeze
 * to the same snapshot, so a re-publish attempt is byte-identical.
 */
export function buildModuleSnapshot(answers: BuilderAnswers | undefined): ModuleSnapshot {
  const a = answers ?? {};
  const out: Record<string, unknown> = {};
  for (const key of SNAPSHOT_ANSWER_KEYS) {
    const v = a[key];
    if (v !== undefined) out[key] = v;
  }
  return out as ModuleSnapshot;
}

/** The host-authored completion prompt, trimmed, or null when blank (service defaults it). */
export function completionPromptOrNull(answers: BuilderAnswers | undefined): string | null {
  const v = (answers?.completionPrompt ?? "").trim();
  return v.length > 0 ? v : null;
}

/**
 * The module's Shared Understanding question (Slice 3.1B-3G), or null when the Host left it blank /
 * explicitly removed it. NULL published as `shared_question` means the module has no shared question
 * and completion behaves exactly as before. Distinct from completionPromptOrNull (private Reflection).
 */
export function sharedQuestionOrNull(answers: BuilderAnswers | undefined): string | null {
  const v = (answers?.sharedQuestion ?? "").trim();
  return v.length > 0 ? v : null;
}
