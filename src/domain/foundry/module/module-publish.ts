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

import { stepBlocker, type BuilderAnswers } from "./module-builder";

// ---------------------------------------------------------------------------
// Approval readiness (builder's real fields)
// ---------------------------------------------------------------------------

/** The builder input steps whose completeness is required before approval. */
const APPROVAL_STEPS: readonly number[] = [1, 2, 3, 4, 5, 6, 7];

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
    const blocker = stepBlocker(step, a);
    if (blocker) errors.push(blocker);
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
