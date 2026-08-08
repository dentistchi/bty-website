"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import type { Locale } from "./copy";
import { MODULE_BUILDER_COPY, arenaFollowLabel, suggestCompletionPrompt, suggestSharedQuestion, type ModuleBuilderCopy } from "./moduleBuilderCopy";
import { createSerializedSaver, SAVE_REQUEST_TIMEOUT_MS, type SaveState } from "./moduleAutosave";
import {
  observableBehaviorWarning,
  recommendArenaForNeeds,
  normalizeLearningNeeds,
  shouldProposeSharedQuestion,
  stepBlocker,
  draftIdentityStatement,
  BUILDER_STEP_MAX,
  CAPABILITY_CANDIDATE_MAX,
  FOLLOW_UP_DAY_OPTIONS,
  type BuilderAnswers,
  type AudienceType,
  type EvidenceObservation,
  type LearningNeed,
  type FollowUpDays,
} from "@/domain/foundry/module/module-builder";
import { reviewMissingSections, type ReviewSectionKey, type ReviewMissingSection } from "@/domain/foundry/module/module-publish";
import { JourneyPreview } from "./JourneyPreview";
import { mapAnswersToJourney, type RealityGroundedJourneyV1 } from "@/domain/foundry/module/journey";
import { ProgramAuthorship, KIND_LABEL, type ProgramGenerateOutcome } from "./ProgramAuthorship";
import { missingProgramKinds, programContext, programContextFingerprint } from "@/domain/foundry/module/program-authorship";
import type { ClientDraft, ClientAsset } from "@/lib/bty/foundry/events/moduleClient";
import { FilesAndDocuments } from "./FilesAndDocuments";
import {
  DirectionCopilot,
  type DirectionGenerateOutcome,
  type DirectionSuggestionView,
  type AppliedDirection,
} from "./DirectionCopilot";
import {
  ModuleDraftCopilot,
  type ModuleDraftGenerateOutcome,
  type ModuleDraftView,
  type AppliedModuleDraft,
} from "./ModuleDraftCopilot";
import { moduleDraftContext, moduleDraftContextFingerprint } from "@/domain/foundry/module/module-draft-copilot";
import {
  assessClarification,
  readClarificationState,
  withClarificationAnswer,
  type ClarificationAnswer,
} from "@/domain/foundry/module/clarification";

/**
 * ModuleBuilderShell — the manual Guided Module Builder (Slice 2 / 2.1).
 *
 * One primary question per step. Server-authoritative draft: on mount it restores
 * the exact answers + current_step from the server (no empty-form flash, no
 * restore-vs-typing race). Autosave is serialized (one PATCH at a time, newest
 * wins). The review step (Slice 2.3A) offers Approve & create session, which
 * publishes the draft into a live event via the canonical publish transaction and
 * hands off to its control room. Persistence engine is regression-protected.
 */

type Snapshot = { answers: BuilderAnswers; currentStep: number };
type Restore = "loading" | "loaded" | "unavailable" | "gone";

export function ModuleBuilderShell({
  draftId,
  locale,
  onExit,
}: {
  draftId: string;
  locale: Locale;
  onExit: (result?: { gone?: boolean; publishedEventId?: string }) => void;
}) {
  const t: ModuleBuilderCopy = MODULE_BUILDER_COPY[locale];

  const [restore, setRestore] = useState<Restore>("loading");
  const [answers, setAnswers] = useState<BuilderAnswers>({});
  const [step, setStep] = useState<number>(1);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [blocker, setBlocker] = useState<string | null>(null);
  const [assets, setAssets] = useState<ClientAsset[]>([]);
  const [docBusy, setDocBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishErr, setPublishErr] = useState<string | null>(null);
  // Revision context (Slice 3.2C-B1): this draft is a NEW VERSION of a published
  // Guided training (parent lineage / version > 1), so the Host understands the old
  // published training is NOT being edited.
  const [isRevision, setIsRevision] = useState(false);
  // Journey approval gate (Slice 3.2C-B3A): publish is blocked until the learner
  // preview Journey is fully grounded (title confirmed + no needs_confirmation).
  const [journeyApprovable, setJourneyApprovable] = useState(false);
  // Slice 3.2L-R1: a program draft is being written for this training right now.
  // Publication must not proceed underneath it. Seeded from the SERVER on restore so a
  // reload — or a generation started in another tab — is reconciled rather than assumed.
  const [generationPending, setGenerationPending] = useState(false);
  // Participation mode (Slice 3.1B-3C). Default OPEN_LINK — a Host must explicitly opt into
  // assigned overlay, and legacy/absent always stays open link.
  const [participationMode, setParticipationMode] = useState<"open_link" | "assigned_overlay">("open_link");
  // Intended assignment count from the pre-publish preview (review screen only). This is the
  // INTENT, clearly separate from the committed result shown after publish.
  const [intendedCount, setIntendedCount] = useState<number | null>(null);
  // AUTHORITATIVE committed result from the publish response (post-publish confirmation).
  const [publishedResult, setPublishedResult] = useState<
    { eventId?: string; mode: "open_link" | "assigned_overlay"; assignmentCount: number; audienceType: string | null } | null
  >(null);

  const answersRef = useRef<BuilderAnswers>({});
  const stepRef = useRef<number>(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goneRef = useRef(false);
  const seededPromptRef = useRef(false);
  const seededSharedRef = useRef(false);

  /** Set when the server refused an adoption claim carried by a save (Slice 3.2L-R11.3A). */
  const [adoptionRefusal, setAdoptionRefusal] = useState<string | null>(null);
  const saverRef = useRef<ReturnType<typeof createSerializedSaver<Snapshot>> | null>(null);
  if (saverRef.current === null) {
    saverRef.current = createSerializedSaver<Snapshot>(async (snap) => {
      try {
        const res = await fetch(`/api/bty/foundry/modules/${draftId}`, {
          method: "PATCH",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: snap.answers, current_step: snap.currentStep }),
          // R2E — a request with no deadline is what wedged the saver on a real device:
          // it never settled, so `inFlight` never cleared and every later flush hung.
          // Aborting turns that into an ordinary retryable failure.
          signal: AbortSignal.timeout(SAVE_REQUEST_TIMEOUT_MS),
        });
        if (res.status === 404) {
          goneRef.current = true;
          return true;
        }
        /*
          The draft saved, but the server may have REFUSED the adoption claim inside it
          (Slice 3.2L-R11.3A). That is a 200 — the Host's edit is safe — and it must not be
          read as "added". Surfaced so the review surface can stop claiming success.
        */
        if (res.ok) {
          const body = (await res.json().catch(() => null)) as { adoption?: { ok?: boolean; reason?: string } } | null;
          if (body?.adoption && body.adoption.ok === false) {
            setAdoptionRefusal(body.adoption.reason ?? "refused");
          }
        }
        return res.ok;
      } catch {
        return false;
      }
    }, setSaveState);
  }
  const saver = saverRef.current;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/bty/foundry/modules/${draftId}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!alive) return;
        if (res.status === 404) return setRestore("gone");
        if (!res.ok) return setRestore("unavailable");
        const data = (await res.json()) as { draft?: ClientDraft; program_generation_active?: boolean };
        const draft = data.draft;
        if (!draft || draft.status !== "draft") return setRestore("gone");
        const a = draft.answers ?? {};
        answersRef.current = a;
        stepRef.current = draft.current_step;
        setAnswers(a);
        setStep(draft.current_step);
        setAssets(draft.assets ?? []);
        setIsRevision((draft.module_version ?? 1) > 1 || draft.parent_module_id != null);
        setGenerationPending(data.program_generation_active === true);
        setRestore("loaded");
      } catch {
        if (alive) setRestore("unavailable");
      }
    })();
    return () => {
      alive = false;
    };
  }, [draftId]);

  useEffect(() => {
    if (restore === "gone" || goneRef.current) onExit({ gone: true });
  }, [restore, onExit]);

  const cancelDebounce = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  const patchAnswers = useCallback(
    (partial: BuilderAnswers, immediate: boolean) => {
      setBlocker(null);
      const merged = { ...answersRef.current, ...partial };
      answersRef.current = merged;
      setAnswers(merged);
      const snapshot: Snapshot = { answers: merged, currentStep: stepRef.current };
      cancelDebounce();
      if (immediate) saver.schedule(snapshot);
      else debounceRef.current = setTimeout(() => saver.schedule(snapshot), 600);
    },
    [saver, cancelDebounce],
  );

  const navigate = useCallback(
    async (next: number) => {
      cancelDebounce();
      await saver.flush({ answers: answersRef.current, currentStep: stepRef.current });
      stepRef.current = next;
      setStep(next);
      setBlocker(null);
      saver.schedule({ answers: answersRef.current, currentStep: next });
    },
    [saver, cancelDebounce],
  );

  const goNext = useCallback(() => {
    const b = stepBlocker(stepRef.current, answersRef.current);
    if (b) return setBlocker(b);
    if (stepRef.current < BUILDER_STEP_MAX) void navigate(stepRef.current + 1);
  }, [navigate]);

  const goBack = useCallback(() => {
    if (stepRef.current > 1) void navigate(stepRef.current - 1);
  }, [navigate]);

  const jumpTo = useCallback((target: number) => void navigate(target), [navigate]);

  const saveAndLeave = useCallback(async () => {
    cancelDebounce();
    const ok = await saver.flush({ answers: answersRef.current, currentStep: stepRef.current });
    if (ok && !goneRef.current) onExit();
  }, [saver, cancelDebounce, onExit]);

  const retry = useCallback(() => void saver.retry(), [saver]);

  // Prefill the participant completion question ONCE when the host first reaches
  // the material step, using a deterministic (non-AI) suggestion — only if the
  // field is empty. The host sees + edits it; a blank field defaults at publish.
  useEffect(() => {
    if (step === 6 && !seededPromptRef.current) {
      seededPromptRef.current = true;
      if (!(answersRef.current.completionPrompt ?? "").trim()) {
        const suggestion = suggestCompletionPrompt(answersRef.current, locale);
        if (suggestion) patchAnswers({ completionPrompt: suggestion }, false);
      }
    }
    // Shared Understanding default (Slice 3.1B-3G, Amendment F): propose a shared question by
    // default for decide/practice/shared_standard needs, ONCE, and ONLY if the field is untouched
    // (undefined). Once the Host edits it — even to empty (an explicit remove) — it is no longer
    // undefined, so we never silently restore a removed question.
    if (step === 6 && !seededSharedRef.current) {
      seededSharedRef.current = true;
      if (
        answersRef.current.sharedQuestion === undefined &&
        shouldProposeSharedQuestion(normalizeLearningNeeds(answersRef.current))
      ) {
        patchAnswers({ sharedQuestion: suggestSharedQuestion(locale) }, false);
      }
    }
  }, [step, patchAnswers, locale]);

  // Publish the draft into a live event (approve-on-publish) and hand off to the
  // control room. Flushes any pending autosave first so the server reads the
  // freshest answers. On failure the draft stays a draft (editable).
  const doPublish = useCallback(async () => {
    if (publishing) return;
    cancelDebounce();
    setPublishErr(null);
    await saver.flush({ answers: answersRef.current, currentStep: stepRef.current });
    setPublishing(true);
    try {
      // Only the DECLARED audience travels with an assigned publish — never resolved member
      // ids, org, or count. The server resolves recipients and blocks a zero-eligible
      // assigned publish (never falls back to Everyone).
      const body: Record<string, unknown> = { locale, participationMode };
      if (participationMode === "assigned_overlay") {
        body.audienceType = answersRef.current.audienceType;
        body.audienceDetail = answersRef.current.audienceDetail ?? null;
      }
      const res = await fetch(`/api/bty/foundry/modules/${draftId}/publish`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          event?: { id?: string };
          participation?: { mode?: "open_link" | "assigned_overlay"; assignmentCount?: number; audienceType?: string | null };
        };
        // Confirm from the AUTHORITATIVE committed result, never the preview. Show the
        // confirmation before handing off so the Host sees what actually happened.
        setPublishedResult({
          eventId: data.event?.id,
          mode: data.participation?.mode === "assigned_overlay" ? "assigned_overlay" : "open_link",
          assignmentCount: data.participation?.assignmentCount ?? 0,
          audienceType: data.participation?.audienceType ?? null,
        });
        return;
      }
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      // Surface the ACTUAL failure reason (3.1B-3C-fix2). A generic "try again" previously
      // hid a bad-YouTube-URL content failure AND would hide a real assignment failure — so
      // we keep the specific reason and map it to actionable copy.
      setPublishErr(err.error ?? "error");
    } catch {
      setPublishErr("error");
    } finally {
      setPublishing(false);
    }
  }, [publishing, cancelDebounce, saver, draftId, locale, participationMode, onExit]);

  // Direction Copilot (Slice 2.4A). Generation flushes autosave FIRST so the server's
  // saved problem matches the request (its stale guard rejects a mismatch), then calls
  // the Host-authenticated route. Generation never mutates the draft. Apply writes the
  // Host-reviewed values through the canonical save path (patchAnswers merges only the
  // intended fields into the live answers — it never ships an obsolete full snapshot).
  const generateDirections = useCallback(async (): Promise<DirectionGenerateOutcome> => {
    cancelDebounce();
    await saver.flush({ answers: answersRef.current, currentStep: stepRef.current });
    try {
      const res = await fetch(`/api/bty/foundry/modules/${draftId}/directions`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem_statement: answersRef.current.problem ?? "", locale }),
      });
      if (res.ok) {
        const data = (await res.json()) as { suggestions?: unknown };
        if (Array.isArray(data.suggestions)) {
          return { ok: true, suggestions: data.suggestions as DirectionSuggestionView[] };
        }
        return { ok: false, code: "generic" };
      }
      if (res.status === 429) return { ok: false, code: "rate_limit" };
      if (res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        return { ok: false, code: body.error === "problem_mismatch" ? "problem_mismatch" : "generic" };
      }
      return { ok: false, code: "generic" };
    } catch {
      return { ok: false, code: "generic" };
    }
  }, [saver, cancelDebounce, draftId, locale]);

  const applyDirection = useCallback(
    (values: AppliedDirection) => {
      patchAnswers(
        {
          capabilityCandidate: values.capabilityCandidate,
          observableBehavior: values.observableBehavior,
          successEvidence: values.successEvidence,
        },
        true,
      );
    },
    [patchAnswers],
  );

  // Module-draft Copilot (Slice 2.4B). Flushes autosave FIRST so the server's saved
  // context matches the request fingerprint (its stale guard rejects a mismatch), then
  // calls the Host-authenticated route. Generation never mutates the draft. Apply merges
  // only the Host-approved fields through the canonical patchAnswers path.
  const generateModuleDraft = useCallback(async (): Promise<ModuleDraftGenerateOutcome> => {
    cancelDebounce();
    await saver.flush({ answers: answersRef.current, currentStep: stepRef.current });
    const ctx = moduleDraftContext(answersRef.current);
    if (!ctx) return { ok: false, code: "generic" };
    try {
      const res = await fetch(`/api/bty/foundry/modules/${draftId}/module-draft`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, context_fingerprint: moduleDraftContextFingerprint(ctx) }),
      });
      if (res.ok) {
        const data = (await res.json()) as { module_draft?: unknown; assumptions?: unknown; warnings?: unknown };
        if (data.module_draft) {
          return {
            ok: true,
            draft: data.module_draft as ModuleDraftView,
            assumptions: Array.isArray(data.assumptions) ? (data.assumptions as string[]) : [],
            warnings: Array.isArray(data.warnings) ? (data.warnings as string[]) : [],
          };
        }
        return { ok: false, code: "generic" };
      }
      if (res.status === 429) return { ok: false, code: "rate_limit" };
      if (res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        return { ok: false, code: body.error === "context_mismatch" ? "context_mismatch" : "generic" };
      }
      return { ok: false, code: "generic" };
    } catch {
      return { ok: false, code: "generic" };
    }
  }, [saver, cancelDebounce, draftId, locale]);

  const applyModuleDraft = useCallback(
    (patch: AppliedModuleDraft) => {
      if (Object.keys(patch).length > 0) patchAnswers(patch, true);
    },
    [patchAnswers],
  );

  // Guided Program Authorship (Slice 3.2L). ONE call authors the whole participant-facing
  // program. Generation flushes autosave first so the server authors from what the Host is
  // actually looking at, and NEVER mutates the draft — the proposal reaches the database
  // only through applyProgram below, and only if the Host applies it.
  const generateProgram = useCallback(async (): Promise<ProgramGenerateOutcome> => {
    cancelDebounce();
    await saver.flush({ answers: answersRef.current, currentStep: stepRef.current });
    const ctx = programContext(answersRef.current);
    if (!ctx) return { ok: false, code: "context_incomplete" };
    try {
      const res = await fetch(`/api/bty/foundry/modules/${draftId}/program-draft`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          // One explicit Host instruction buys one generation; the server's unique index
          // refuses a re-delivered request rather than spending twice.
          submission_intent_id: crypto.randomUUID(),
          context_fingerprint: programContextFingerprint(ctx),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        program?: unknown; evidence_ceiling?: string; attempt_id?: string | null; context_fingerprint?: string; error?: string; refusal?: string | null;
      };
      if (res.ok && data.program) {
        return {
          ok: true,
          proposal: data.program as ProgramGenerateOutcome extends { ok: true; proposal: infer P } ? P : never,
          evidenceCeiling: data.evidence_ceiling ?? "",
          attemptId: data.attempt_id ?? null,
          contextFingerprint: data.context_fingerprint ?? "",
        };
      }
      return { ok: false, code: data.error ?? "invalid_output", refusal: data.refusal ?? null };
    } catch {
      return { ok: false, code: "provider_error" };
    }
  }, [saver, cancelDebounce, draftId, locale]);

  // Apply is ATOMIC from the Host's point of view: the whole approved journey is written in
  // ONE patch, so a failed save can never leave a half-applied program.
  /**
   * The Host-input authority as it stands right now. Recomputed on every answers change,
   * so the review surface can tell a proposal written from older answers (Slice 3.2L-R11).
   */
  const programFingerprint = useMemo(() => {
    const ctx = programContext(answers);
    return ctx ? programContextFingerprint(ctx) : "";
  }, [answers]);

  const applyProgram = useCallback(
    (next: RealityGroundedJourneyV1, attemptId: string | null) => {
      /*
        ONE row update carries the adopted journey AND the record of which proposal was
        adopted, so the server derives the receipt from durable state rather than from a
        field that vanishes with the request (Slice 3.2L-R11.1).
      */
      setAdoptionRefusal(null);
      patchAnswers(
        { realityGroundedJourneyV1: next, ...(attemptId ? { programAdoptionV1: { attemptId } } : {}) },
        true,
      );
    },
    [patchAnswers],
  );

  // Adaptive Clarification (Slice 2.4C). A clarification answer is persisted through the
  // canonical save path into a NAMESPACED `answers.clarification` key — it never overwrites
  // a canonical Builder field and never publishes (excluded from the snapshot whitelist).
  // Re-answering a dimension supersedes the prior answer; the state survives refresh.
  const answerClarification = useCallback(
    (answer: ClarificationAnswer) => {
      const next = withClarificationAnswer(readClarificationState(answersRef.current), answer);
      patchAnswers({ clarification: next }, true);
    },
    [patchAnswers],
  );

  useEffect(() => () => cancelDebounce(), [cancelDebounce]);

  if (restore === "loading") {
    return (
      <div className="btyFadeIn flex min-h-[45vh] items-center justify-center">
        <p className="text-sm text-white/50">{t.restoreLoading}</p>
      </div>
    );
  }
  if (restore === "unavailable") {
    return (
      <div className="btyFadeIn flex min-h-[45vh] flex-col items-center justify-center gap-4 text-center">
        <p className="max-w-[18rem] text-sm text-white/70">{t.restoreUnavailable}</p>
        <button type="button" onClick={() => onExit()} className="text-sm text-[#C9A66B]">
          {t.back}
        </button>
      </div>
    );
  }
  if (restore === "gone") return <div aria-hidden className="min-h-[30vh]" />;

  const isReview = step === BUILDER_STEP_MAX;
  // The EXACT blockers, named. R2F measured the old surface claiming "resolve every
  // Needs confirmation element" while the only real blocker was an unconfirmed title.
  const journey = answers.realityGroundedJourneyV1;
  const journeyBlockers: string[] = journey
    ? [
        ...(journey.displayTitleStatus !== "grounded" ? ["Confirm the program title"] : []),
        ...journey.elements
          .filter((e) => e.confirmationStatus === "needs_confirmation")
          .map((e) => `${KIND_LABEL[e.kind]} still needs your confirmation`),
        ...missingProgramKinds(answers, journey).map((k) => `${KIND_LABEL[k]} is missing from the program`),
      ]
    : [];
  // Journey-enabled once the Host has opted into the learner preview (Slice 3.2C-B3A).
  const journeyEnabled = answers.realityGroundedJourneyV1 !== undefined;
  // The SINGLE readiness source the Review screen consults — the exact gate that the
  // server re-enforces at publish, plus the PDF-asset gate the client can see locally.
  // Every entry maps to a visible, highlightable Review row (Slice 2.4A.3).
  const pdfMissing = answers.materialIntent === "pdf" && assets.filter((x) => x.file_kind === "pdf").length === 0;
  const reviewMissing = reviewMissingSections(answers, pdfMissing ? ["material_pdf_required"] : []);
  const filesNode = (
    <FilesAndDocuments
      draftId={draftId}
      assets={assets}
      onAssetsChange={setAssets}
      onBusyChange={setDocBusy}
      t={t}
    />
  );
  // The assistive Direction Copilot lives under the problem step. It appears only once
  // the problem meets the existing minimum validity, and never blocks manual progression.
  const copilotNode = (
    <DirectionCopilot
      problemStatement={answers.problem ?? ""}
      ready={stepBlocker(1, answers) === null}
      onGenerate={generateDirections}
      onApply={applyDirection}
      t={t.copilot}
    />
  );
  // Module-draft Copilot lives on the Learning Approach step; it appears only once the
  // canonical minimum context (problem, audience, behavior, evidence) is valid.
  const moduleCtx = moduleDraftContext(answers);
  // The deterministic sufficiency verdict is recomputed from the canonical context + the
  // persisted clarification answers on every render — so it re-derives correctly after a
  // refresh and an already-answered dimension is never re-asked.
  const clarificationAssessment = moduleCtx
    ? assessClarification(moduleCtx, readClarificationState(answers))
    : undefined;
  const moduleDraftNode = (
    <ModuleDraftCopilot
      ready={moduleCtx !== null}
      contextFingerprint={moduleCtx ? moduleDraftContextFingerprint(moduleCtx) : ""}
      current={{
        learningNeeds: normalizeLearningNeeds(answers),
        completionPrompt: answers.completionPrompt ?? "",
        arenaRecommended: answers.arenaRecommended,
        followUpDays: answers.followUpDays,
      }}
      onGenerate={generateModuleDraft}
      onApply={applyModuleDraft}
      clarificationAssessment={clarificationAssessment}
      onClarificationAnswer={answerClarification}
      t={t.moduleDraft}
    />
  );

  return (
    <div className="btyFadeIn flex flex-col gap-6 pb-24" data-testid="module-builder">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">
          {isReview ? t.reviewEyebrow : t.stepOf(step, BUILDER_STEP_MAX - 1)}
        </span>
        <SaveStatus state={saveState} t={t} onRetry={retry} />
      </div>

      {/* WHICH TRAINING IS OPEN (Slice 3.2L-R1.2). Rendered ABOVE every body state — a
          step, Review, a pending generation, a proposal, a refusal, the screen returned to
          after Discard — so the Host can never lose track of which draft they are acting
          on. It reads the LOADED draft's own answers; nothing here is inferred from list
          order, recency or a cached value. */}
      <DraftIdentity answers={answers} t={t} />

      {isRevision && !publishedResult ? (
        <div
          data-testid="module-builder-revision-banner"
          className="flex flex-col gap-0.5 rounded-xl border border-[#C9A66B]/30 bg-[#C9A66B]/[0.06] px-4 py-3"
        >
          <span className="text-sm font-semibold text-[#C9A66B]">{t.revisionTitle}</span>
          <span className="text-xs leading-5 text-white/55">{t.revisionNote}</span>
        </div>
      ) : null}

      {publishedResult ? (
        <PublishConfirmation
          result={publishedResult}
          onContinue={() => onExit({ publishedEventId: publishedResult.eventId })}
          t={t}
        />
      ) : isReview ? (
        <>
          {/* Reality-Grounded Journey (Slice 3.2C-B3A). A draft becomes Journey-enabled
              when the Host opts into the learner preview; then the preview + approval
              gate replace the raw-title/raw-completion publish. Legacy drafts (no
              Journey) keep the existing review → publish exactly. */}
          {/* PROGRAM FIRST (Slice 3.2L). The Founder sees the training their team will
              experience, in the order they will experience it. The raw Builder answers
              remain reachable, but as a secondary detail section — Review is no longer a
              list of the fields the Host just filled in. */}
          <ProgramAuthorship
            draftId={draftId}
            answers={answers}
            journey={answers.realityGroundedJourneyV1}
            ready={programContext(answers) !== null}
            onGenerate={generateProgram}
            currentContextFingerprint={programFingerprint}
            adoptionRefusal={adoptionRefusal}
            onApply={applyProgram}
            onPendingChange={setGenerationPending}
          />
          {journeyEnabled ? (
            <JourneyPreview answers={answers} onPatch={patchAnswers} onApprovableChange={setJourneyApprovable} />
          ) : (
            <button
              type="button"
              data-testid="journey-start"
              onClick={() => patchAnswers({ realityGroundedJourneyV1: mapAnswersToJourney(answers) }, true)}
              className="self-start rounded-xl border border-[#C9A66B]/40 bg-[#C9A66B]/[0.08] px-5 py-3 text-sm font-semibold text-[#C9A66B] transition-colors hover:bg-[#C9A66B]/[0.14]"
            >
              {t.journeyStart} →
            </button>
          )}
          <AllTrainingDetails answers={answers} assets={assets} missing={reviewMissing} onEdit={jumpTo} t={t} />
          <ParticipationModeChooser
            mode={participationMode}
            audienceType={typeof answers.audienceType === "string" ? answers.audienceType : null}
            intendedCount={intendedCount}
            onIntendedCount={setIntendedCount}
            onChange={setParticipationMode}
            t={t}
          />
          <PublishAction
            missing={reviewMissing}
            publishing={publishing}
            error={publishErr}
            onEdit={jumpTo}
            onPublish={doPublish}
            journeyBlockers={journeyEnabled && !journeyApprovable ? journeyBlockers : []}
            generationPending={generationPending}
            t={t}
          />
        </>
      ) : (
        <div className="min-h-[42vh]">{renderStep(step, answers, patchAnswers, blocker, t, filesNode, copilotNode, moduleDraftNode)}</div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <div>
          {step > 1 ? (
            <button
              type="button"
              onClick={goBack}
              disabled={docBusy}
              className="rounded-lg px-3 py-2 text-sm text-white/70 disabled:opacity-40"
            >
              {t.back}
            </button>
          ) : (
            <span />
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={saveAndLeave}
            disabled={docBusy}
            className="rounded-lg px-3 py-2 text-sm text-white/60 disabled:opacity-40"
          >
            {t.saveAndLeave}
          </button>
          {step < BUILDER_STEP_MAX ? (
            <button
              type="button"
              onClick={goNext}
              disabled={docBusy}
              className="rounded-xl bg-[#C9A66B] px-6 py-3 text-sm font-semibold text-[#0B1F3A] disabled:opacity-50"
            >
              {t.next}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * The Host-authored statement naming the open draft.
 *
 * The first controlled Founder window ran against the wrong training because two drafts
 * both restored at Step 8 under an identical global Learn header, and the only
 * distinguishing text sat inside a collapsed disclosure. This puts it on screen.
 *
 * Deliberately framed as "Training focus", NOT as a title: it is the Host's own
 * description of what needs to change, not an approved program name and not the
 * learner-facing "Why this matters". Its own heading level and muted treatment keep it
 * distinct from the Learn header above it and from any AI-authored title below.
 */
function DraftIdentity({ answers, t }: { answers: BuilderAnswers; t: ModuleBuilderCopy }) {
  const statement = draftIdentityStatement(answers);
  return (
    <section
      aria-labelledby="draft-identity-label"
      data-testid="draft-identity"
      className="flex flex-col gap-0.5 border-l-2 border-[#C9A66B]/40 pl-3"
    >
      <span id="draft-identity-label" className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-white/40">
        {t.identityLabel}
      </span>
      {/* Deliberately NOT a heading. The Builder's invariant is exactly one primary
          question (h2) per step, and this is orientation, not the step's question — an
          h2 here would compete with it. The labelled region carries the semantics
          instead: screen readers announce "Training focus" and its content, ahead of the
          Review actions.

          break-words + no truncation: a long statement wraps rather than being cut to a
          prefix that could read identically to another draft's. */}
      <p
        data-testid={statement ? "draft-identity-statement" : "draft-identity-fallback"}
        className={`break-words text-[0.95rem] font-medium leading-6 ${statement ? "text-white/85" : "text-white/45"}`}
      >
        {statement ?? t.identityFallback}
      </p>
    </section>
  );
}

function SaveStatus({ state, t, onRetry }: { state: SaveState; t: ModuleBuilderCopy; onRetry: () => void }) {
  if (state === "saving") return <span className="text-xs text-white/40">{t.saving}</span>;
  if (state === "saved") return <span className="text-xs text-white/40">{t.saved}</span>;
  if (state === "error")
    return (
      <span className="flex items-center gap-2 text-xs text-amber-300/90">
        {t.saveError}
        <button type="button" onClick={onRetry} className="underline">
          {t.retry}
        </button>
      </span>
    );
  return <span className="text-xs text-transparent">·</span>;
}

// ---------------------------------------------------------------------------
// Step rendering
// ---------------------------------------------------------------------------
type Patch = (partial: BuilderAnswers, immediate: boolean) => void;

function StepFrame({ q, help, children }: { q: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold leading-7 text-white/90">{q}</h2>
        {help ? <p className="text-sm leading-6 text-white/50">{help}</p> : null}
      </div>
      {children}
    </div>
  );
}

function textArea(value: string, onChange: (v: string) => void, placeholder: string, label: string) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
      rows={4}
      className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3.5 text-base leading-7 text-white placeholder:text-white/30 outline-none focus:border-[#C9A66B]/60"
    />
  );
}

function OptionButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-full rounded-xl border px-4 py-3.5 text-left text-[0.98rem] transition-colors ${
        active
          ? "border-[#C9A66B]/70 bg-[#C9A66B]/15 text-white"
          : "border-white/12 bg-white/[0.03] text-white/80 hover:bg-white/[0.06]"
      }`}
    >
      {label}
    </button>
  );
}

/** Titled + described option (used by the multi-select learning needs). */
function DescOption({
  active,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors ${
        active
          ? "border-[#C9A66B]/70 bg-[#C9A66B]/15"
          : "border-white/12 bg-white/[0.03] hover:bg-white/[0.06]"
      }`}
    >
      <span
        aria-hidden
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[0.7rem] ${
          active ? "border-[#C9A66B] bg-[#C9A66B] text-[#0B1F3A]" : "border-white/25 text-transparent"
        }`}
      >
        ✓
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[0.98rem] font-medium text-white/90">{title}</span>
        <span className="text-sm leading-6 text-white/50">{desc}</span>
      </span>
    </button>
  );
}

function BlockerLine({ show, text }: { show: boolean; text: string }) {
  if (!show) return null;
  return <p className="text-xs leading-5 text-amber-300/80">{text}</p>;
}

function renderStep(step: number, a: BuilderAnswers, patch: Patch, blocker: string | null, t: ModuleBuilderCopy, filesNode: React.ReactNode, copilotNode: React.ReactNode, moduleDraftNode: React.ReactNode) {
  switch (step) {
    case 1:
      return (
        <StepFrame q={t.s1Q} help={t.s1Help}>
          {textArea(a.problem ?? "", (v) => patch({ problem: v }, false), t.s1Placeholder, t.s1Q)}
          <BlockerLine show={blocker === "problem_required"} text={t.s1Blocker} />
          {copilotNode}
        </StepFrame>
      );
    case 2: {
      const needsDetail = a.audienceType === "job_group" || a.audienceType === "specific_role";
      const opt = (type: AudienceType, label: string) => (
        <OptionButton active={a.audienceType === type} label={label} onClick={() => patch({ audienceType: type }, true)} />
      );
      return (
        <StepFrame q={t.s2Q}>
          <div className="flex flex-col gap-2.5">
            {opt("everyone", t.audEveryone)}
            {opt("leaders", t.audLeaders)}
            {opt("job_group", t.audJobGroup)}
            {opt("specific_role", t.audRole)}
          </div>
          {needsDetail ? (
            <input
              type="text"
              value={a.audienceDetail ?? ""}
              onChange={(e) => patch({ audienceDetail: e.target.value }, false)}
              placeholder={a.audienceType === "job_group" ? t.audJobGroupDetail : t.audRoleDetail}
              aria-label={a.audienceType === "job_group" ? t.audJobGroupDetail : t.audRoleDetail}
              maxLength={120}
              className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-base text-white placeholder:text-white/30 outline-none focus:border-[#C9A66B]/60"
            />
          ) : null}
          {/*
            Leaders ELIGIBILITY PREVIEW (Slice 3.1B-2) — informational only. It shows who
            currently holds a canonical leadership responsibility; it does NOT assign,
            invite, restrict, or target anyone. Foundry participation stays anonymous and
            link-based. Identity-bound targeting is Slice 3.1B-3.
          */}
          {a.audienceType === "leaders" ? <LeadersEligibilityPreview t={t} /> : null}
          <BlockerLine show={blocker === "audience_required"} text={t.s2Blocker} />
          <BlockerLine show={blocker === "audience_detail_required"} text={t.s2DetailBlocker} />
        </StepFrame>
      );
    }
    case 3: {
      const vague = observableBehaviorWarning(a.observableBehavior) === "observable_behavior_vague";
      return (
        <StepFrame q={t.s3Q} help={t.s3Help}>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="capability-candidate" className="text-xs uppercase tracking-[0.12em] text-white/45">
              {t.s3CapabilityLabel}
            </label>
            <input
              id="capability-candidate"
              type="text"
              value={a.capabilityCandidate ?? ""}
              onChange={(e) => patch({ capabilityCandidate: e.target.value }, false)}
              placeholder={t.s3CapabilityPlaceholder}
              aria-label={t.s3CapabilityLabel}
              maxLength={CAPABILITY_CANDIDATE_MAX}
              className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-base text-white placeholder:text-white/30 outline-none focus:border-[#C9A66B]/60"
            />
            <p className="text-xs leading-5 text-white/40">{t.s3CapabilityHelp}</p>
          </div>
          {textArea(a.observableBehavior ?? "", (v) => patch({ observableBehavior: v }, false), t.s3Placeholder, t.s3Q)}
          {vague ? <p className="text-xs leading-5 text-white/45">{t.s3VagueGuidance}</p> : null}
          <BlockerLine show={blocker === "behavior_required"} text={t.s3Blocker} />
        </StepFrame>
      );
    }
    case 4: {
      const behavior = a.observableBehavior?.trim();
      const opt = (type: EvidenceObservation, label: string) => (
        <OptionButton active={a.evidenceType === type} label={label} onClick={() => patch({ evidenceType: type }, true)} />
      );
      return (
        <StepFrame q={t.s4Q} help={t.s4Help}>
          {behavior ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <p className="text-xs text-white/40">{t.s4BehaviorLead}</p>
              <p className="mt-1 text-sm leading-6 text-white/75">“{behavior}”</p>
            </div>
          ) : null}
          {textArea(a.successEvidence ?? "", (v) => patch({ successEvidence: v }, false), t.s4Placeholder, t.s4Q)}
          <div className="flex flex-col gap-2 pt-1">
            <h3 className="text-sm font-medium text-white/70">{t.s4VerifyQ}</h3>
            <div className="flex flex-col gap-2.5">
              {opt("seen", t.verifyObserved)}
              {opt("heard", t.verifyHeard)}
              {opt("recorded", t.verifyRecorded)}
              {opt("confirmed", t.verifyConfirmed)}
            </div>
            <p className="text-xs leading-5 text-white/40">{t.s4VerifyGuidance}</p>
          </div>
          <p className="text-xs leading-5 text-white/40">{t.s4Honesty}</p>
          <BlockerLine show={blocker === "evidence_required"} text={t.s4Blocker} />
        </StepFrame>
      );
    }
    case 5: {
      const selected = normalizeLearningNeeds(a);
      const toggle = (need: LearningNeed) => {
        const next = selected.includes(need) ? selected.filter((n) => n !== need) : [...selected, need];
        patch({ learningNeeds: next }, true);
      };
      const item = (need: LearningNeed, title: string, desc: string) => (
        <DescOption active={selected.includes(need)} title={title} desc={desc} onClick={() => toggle(need)} />
      );
      return (
        <StepFrame q={t.s5Q} help={t.s5Help}>
          <div className="flex flex-col gap-2.5">
            {item("know", t.needInfoTitle, t.needInfoDesc)}
            {item("decide", t.needDecideTitle, t.needDecideDesc)}
            {item("practice", t.needPracticeTitle, t.needPracticeDesc)}
            {item("shared_standard", t.needSharedTitle, t.needSharedDesc)}
          </div>
          {recommendArenaForNeeds(selected) ? (
            <p className="text-xs leading-5 text-[#C9A66B]/80">{t.s5ArenaHint}</p>
          ) : null}
          <BlockerLine show={blocker === "learning_need_required"} text={t.s5Blocker} />
          {moduleDraftNode}
        </StepFrame>
      );
    }
    case 6: {
      const opt = (m: "youtube" | "pdf", label: string) => (
        <OptionButton active={a.materialIntent === m} label={label} onClick={() => patch({ materialIntent: m }, true)} />
      );
      const ytEmpty = !a.materialText?.trim();
      return (
        <StepFrame q={t.s6Q}>
          <div className="flex flex-col gap-2.5">
            {opt("youtube", t.matYoutube)}
            {opt("pdf", t.matFiles)}
          </div>
          {a.materialIntent === "youtube" ? (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={a.materialText ?? ""}
                onChange={(e) => patch({ materialText: e.target.value }, false)}
                placeholder={t.matYoutubePlaceholder}
                aria-label={t.matYoutube}
                className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-base text-white placeholder:text-white/30 outline-none focus:border-[#C9A66B]/60"
              />
              {ytEmpty ? (
                <p className="text-xs leading-5 text-amber-300/70">
                  {t.ytMissingTitle} · {t.requiredBeforeApproval}
                </p>
              ) : null}
            </div>
          ) : null}
          {a.materialIntent === "pdf" ? filesNode : null}
          {a.materialIntent ? (
            <div className="flex flex-col gap-2 border-t border-white/8 pt-4">
              <h3 className="text-sm font-medium text-white/70">{t.s6CompletionQ}</h3>
              <p className="text-xs leading-5 text-white/45">{t.s6CompletionHelp}</p>
              {textArea(a.completionPrompt ?? "", (v) => patch({ completionPrompt: v }, false), t.s6CompletionPlaceholder, t.s6CompletionQ)}
            </div>
          ) : null}
          {a.materialIntent ? (
            /* Shared Understanding question (Slice 3.1B-3G) — distinct from the private completion
               question above; the learner is told this answer is shared with the Host. Optional
               (clear to remove); default-proposed for judgment/practice/shared-standard needs. */
            <div className="flex flex-col gap-2 border-t border-white/8 pt-4" data-testid="builder-shared-question">
              <h3 className="text-sm font-medium text-white/70">{t.s6SharedQ}</h3>
              <p className="text-xs leading-5 text-white/45">{t.s6SharedHelp}</p>
              {textArea(a.sharedQuestion ?? "", (v) => patch({ sharedQuestion: v }, false), t.s6SharedPlaceholder, t.s6SharedQ)}
            </div>
          ) : null}
          <BlockerLine show={blocker === "material_intent_required"} text={t.s6Blocker} />
        </StepFrame>
      );
    }
    case 7: {
      const recommend = recommendArenaForNeeds(normalizeLearningNeeds(a));
      const chosen = a.arenaRecommended ?? recommend;
      const followOpt = (days: FollowUpDays, label: string) => (
        <OptionButton active={(a.followUpDays ?? -1) === days} label={label} onClick={() => patch({ followUpDays: days }, true)} />
      );
      return (
        <StepFrame q={t.s7ArenaQ} help={recommend ? t.s7ArenaRecommended : undefined}>
          <div className="flex flex-col gap-2.5">
            <OptionButton active={chosen === true} label={t.s7ArenaAccept} onClick={() => patch({ arenaRecommended: true }, true)} />
            <OptionButton active={chosen === false} label={t.s7ArenaDecline} onClick={() => patch({ arenaRecommended: false }, true)} />
          </div>
          <h3 className="pt-2 text-sm font-medium text-white/70">{t.s7FollowQ}</h3>
          <div className="flex flex-col gap-2.5">
            {followOpt(0, t.followNone)}
            {followOpt(7, t.follow7)}
            {followOpt(30, t.follow30)}
          </div>
          <BlockerLine show={blocker === "follow_up_required"} text={t.s7Blocker} />
        </StepFrame>
      );
    }
    default:
      return <div />;
  }
}

// ---------------------------------------------------------------------------
// Step 8 — read-only draft review (starts at top; NO approve/publish/create)
// ---------------------------------------------------------------------------
type ReviewRow = {
  label: string;
  value: string | null;
  step: number;
  /** The canonical blocking section this row represents, if any (drives highlight). */
  section?: ReviewSectionKey;
  /** Non-blocking soft guidance (e.g. a present-but-vague behavior). Never counts as missing. */
  note?: { title: string; hint?: string };
  lines?: string[];
};

/** Section → actionable, localized "what to do" reason (reuses the per-step blockers). */
function sectionReason(section: ReviewSectionKey, t: ModuleBuilderCopy): string {
  switch (section) {
    case "problem":
      return t.s1Blocker;
    case "audience":
      return t.s2Blocker;
    case "behavior":
      return t.s3Blocker;
    case "evidence":
      return t.s4Blocker;
    case "learning":
      return t.s5Blocker;
    case "material":
      return t.s6Blocker;
    case "followUp":
      return t.s7Blocker;
  }
}

/** Section → its Review row label (for the "needs attention" summary list). */
function sectionLabel(section: ReviewSectionKey, t: ModuleBuilderCopy): string {
  switch (section) {
    case "problem":
      return t.reviewChange;
    case "audience":
      return t.reviewWho;
    case "behavior":
      return t.reviewBehavior;
    case "evidence":
      return t.reviewEvidence;
    case "learning":
      return t.reviewLearning;
    case "material":
      return t.reviewMaterials;
    case "followUp":
      return t.reviewFollow;
  }
}

function buildReviewRows(a: BuilderAnswers, assets: ClientAsset[], t: ModuleBuilderCopy): ReviewRow[] {
  const audience = (() => {
    switch (a.audienceType) {
      case "everyone":
        return t.audEveryone;
      case "leaders":
        return t.audLeaders;
      case "job_group":
        return a.audienceDetail || t.audJobGroup;
      case "specific_role":
        return a.audienceDetail || t.audRole;
      default:
        return null;
    }
  })();

  const needs = normalizeLearningNeeds(a);
  const needLabel: Record<LearningNeed, string> = {
    know: t.needInfoTitle,
    decide: t.needDecideTitle,
    practice: t.needPracticeTitle,
    shared_standard: t.needSharedTitle,
  };
  const learning = needs.length > 0 ? needs.map((n) => needLabel[n]).join(", ") : null;

  // Behavior present-but-vague → SOFT guidance only (a vague behavior is NOT a hard
  // blocker; an empty behavior is a hard-missing section, highlighted canonically).
  const behaviorNote =
    a.observableBehavior?.trim() && observableBehaviorWarning(a.observableBehavior) === "observable_behavior_vague"
      ? { title: t.gBehaviorNeeds, hint: t.gBehaviorHint }
      : undefined;

  // Material — an honest value: null (→ "Not added yet" + canonical highlight) until the
  // delivery is actually complete (a PDF asset exists, or a YouTube URL is present).
  let material: string | null = null;
  let materialLines: string[] | undefined;
  if (a.materialIntent === "pdf") {
    if (assets.length > 0) {
      material = t.matFiles;
      materialLines = assets.map(
        (as) => `${as.filename} · ${t.assetAttached}${as.participant_delivery_ready ? ` · ${t.deliveryReady}` : ""}`,
      );
    }
  } else if (a.materialIntent === "youtube") {
    material = a.materialText?.trim() ? t.matYoutube : null;
  }

  const arenaChosen = a.arenaRecommended ?? recommendArenaForNeeds(needs);
  // Follow-up only reads as answered when a valid option was actually chosen — never
  // mask an unset value as "No follow-up" (that made a required-missing row look done).
  const followChosen = (FOLLOW_UP_DAY_OPTIONS as readonly number[]).includes(a.followUpDays ?? -1);

  return [
    { label: t.reviewChange, value: a.problem?.trim() ? a.problem : null, step: 1, section: "problem" },
    { label: t.reviewWho, value: audience, step: 2, section: "audience" },
    { label: t.reviewCapability, value: a.capabilityCandidate?.trim() ? a.capabilityCandidate : null, step: 3 },
    { label: t.reviewBehavior, value: a.observableBehavior?.trim() ? a.observableBehavior : null, step: 3, section: "behavior", note: behaviorNote },
    { label: t.reviewEvidence, value: a.successEvidence?.trim() ? a.successEvidence : null, step: 4, section: "evidence" },
    { label: t.reviewLearning, value: learning, step: 5, section: "learning" },
    { label: t.reviewMaterials, value: material, step: 6, section: "material", lines: materialLines },
    { label: t.reviewCompletion, value: a.completionPrompt?.trim() ? a.completionPrompt : null, step: 6 },
    { label: t.reviewArena, value: arenaChosen ? t.arenaYes : t.arenaNo, step: 7 },
    { label: t.reviewFollow, value: followChosen ? arenaFollowLabel(a.followUpDays, t.followNone, t.follow7, t.follow30) : null, step: 7, section: "followUp" },
  ];
}

/**
 * The "needs attention" summary — an explicit, named, tappable list of the exact
 * missing Review sections. Never rendered when nothing is missing. Tapping a name
 * jumps to that section's Builder step. This is the fix for the ambiguous
 * "Complete the highlighted sections first" with nothing highlighted (Slice 2.4A.3).
 */
function MissingSummary({
  missing,
  onEdit,
  t,
}: {
  missing: ReviewMissingSection[];
  onEdit: (step: number) => void;
  t: ModuleBuilderCopy;
}) {
  if (missing.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-amber-300/25 bg-amber-300/[0.04] px-3.5 py-3" data-testid="review-missing-summary">
      <p className="text-sm font-medium text-amber-200/90">{t.sectionsNeedAttention(missing.length)}</p>
      <ul className="flex flex-col gap-1">
        {missing.map((m) => (
          <li key={m.section}>
            <button
              type="button"
              onClick={() => onEdit(m.step)}
              data-testid={`review-missing-item-${m.section}`}
              className="text-left text-sm text-[#C9A66B] underline-offset-2 hover:underline"
            >
              • {sectionLabel(m.section, t)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Approve-and-create-session action on the review step. Enabled ONLY when the
 *  canonical readiness has zero missing sections (the same gate the server re-enforces
 *  at publish). The explicit missing summary appears right by the button so the Host
 *  never faces a disabled Approve without seeing exactly what to fix (Slice 2.4A.3). */
/**
 * Map a publish failure REASON to actionable Host copy (3.1B-3C-fix2). The generic
 * "try once more" previously hid a bad-YouTube-URL content failure and would hide a real
 * assignment failure; specific messages make each class diagnosable in-app.
 */
function publishErrorMessage(reason: string, t: ModuleBuilderCopy): string {
  switch (reason) {
    case "youtube_url_invalid":
      return t.publishErrYoutube;
    case "material_pdf_required":
      return t.publishErrPdf;
    case "not_a_host":
      return t.publishErrNotHost;
    case "assignment_write_failed":
      return t.publishErrAssignment;
    // Slice 3.2L-R1.1 — the two program-generation refusals are DIFFERENT actions for the
    // Host: one is a wait, the other is a retry. Collapsing them into the generic publish
    // error would tell them neither.
    case "program_generation_in_progress":
      return "BTY is writing your training program — wait for it to finish, or discard it, before creating this session.";
    case "program_generation_state_unavailable":
      return "We couldn’t confirm whether BTY is still writing this program. Nothing was published — give it a moment, then create the session again.";
    default:
      return t.publishError;
  }
}

function PublishAction({
  missing,
  publishing,
  error,
  onEdit,
  onPublish,
  journeyBlockers,
  generationPending,
  t,
}: {
  missing: ReviewMissingSection[];
  publishing: boolean;
  error: string | null;
  onEdit: (step: number) => void;
  onPublish: () => void;
  /** Exact, named reasons the program cannot be created yet. */
  journeyBlockers: string[];
  /** A program draft is being written for this training right now. */
  generationPending: boolean;
  t: ModuleBuilderCopy;
}) {
  // The CTA is never REMOVED. Hiding the primary action reads as a broken screen; a
  // visible disabled button that names its blocker is a state the Host can act on.
  const notReady = missing.length > 0 || journeyBlockers.length > 0 || generationPending;
  return (
    <div className="flex flex-col gap-3 pt-2">
      <p className="text-sm leading-6 text-white/55">{t.publishTrust}</p>
      <MissingSummary missing={missing} onEdit={onEdit} t={t} />
      {generationPending ? (
        <div className="rounded-xl border border-amber-300/25 bg-amber-300/[0.04] px-3.5 py-3" data-testid="publish-blocked-generation">
          <p className="text-sm font-medium text-amber-200/90">BTY is writing your training program</p>
          <p className="mt-0.5 text-sm text-amber-100/80">
            Wait for it to finish, or discard it, before creating this session.
          </p>
        </div>
      ) : null}
      {journeyBlockers.length > 0 ? (
        <div className="flex flex-col gap-1.5 rounded-xl border border-amber-300/25 bg-amber-300/[0.04] px-3.5 py-3" data-testid="journey-publish-blocked">
          <p className="text-sm font-medium text-amber-200/90">
            {journeyBlockers.length === 1 ? "One thing before you can create this" : `${journeyBlockers.length} things before you can create this`}
          </p>
          <ul className="flex flex-col gap-1">
            {journeyBlockers.map((b, i) => (
              <li key={i} className="text-sm text-amber-100/85" data-testid="journey-blocker-item">• {b}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {error === "zero_recipients" ? (
        <p className="text-xs leading-5 text-amber-300/85" data-testid="publish-zero-recipients">
          {t.pmZeroRecipients}
        </p>
      ) : error ? (
        <p className="text-xs leading-5 text-amber-300/85" data-testid="publish-error">
          {publishErrorMessage(error, t)}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onPublish}
        disabled={publishing || notReady}
        data-testid="publish-cta"
        className="rounded-xl bg-[#C9A66B] px-6 py-3.5 text-base font-semibold text-[#0B1F3A] disabled:opacity-50"
      >
        {publishing ? t.publishing : t.publishCta}
      </button>
    </div>
  );
}

/**
 * The raw Builder answers, SECONDARY (Slice 3.2L).
 *
 * R2F measured Review as ten label:value rows — the Host's own inputs read back to them.
 * The program is now primary; these details stay one tap away because every Edit
 * destination must keep working, but they are collapsed by default so Review reads as a
 * training, not a form. Anything still MISSING forces the section open — a blocker must
 * never be hidden behind a collapsed panel.
 */
function AllTrainingDetails({
  answers,
  assets,
  missing,
  onEdit,
  t,
}: {
  answers: BuilderAnswers;
  assets: ClientAsset[];
  missing: ReviewMissingSection[];
  onEdit: (step: number) => void;
  t: ModuleBuilderCopy;
}) {
  const [open, setOpen] = useState(missing.length > 0);
  return (
    <section className="flex flex-col gap-3" data-testid="all-training-details">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-testid="all-training-details-toggle"
        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left"
      >
        <span className="flex flex-col">
          <span className="text-sm font-medium text-white/75">All training details</span>
          <span className="text-xs text-white/45">
            {missing.length > 0
              ? `${missing.length} still needs attention`
              : "Everything you entered, and where to change it"}
          </span>
        </span>
        <span aria-hidden className="text-sm text-[#C9A66B]">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? <ReviewBody answers={answers} assets={assets} missing={missing} onEdit={onEdit} t={t} /> : null}
    </section>
  );
}

function ReviewBody({
  answers,
  assets,
  missing,
  onEdit,
  t,
}: {
  answers: BuilderAnswers;
  assets: ClientAsset[];
  missing: ReviewMissingSection[];
  onEdit: (step: number) => void;
  t: ModuleBuilderCopy;
}) {
  const rows = buildReviewRows(answers, assets, t);
  const missingSet = new Set(missing.map((m) => m.section));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-base leading-7 text-white/80">{t.reviewLead}</p>
        <MissingSummary missing={missing} onEdit={onEdit} t={t} />
      </div>
      <section className="flex flex-col gap-2">
        {rows.map((r, i) => {
          const isMissing = r.section !== undefined && missingSet.has(r.section);
          return (
            <div
              key={i}
              data-testid={r.section ? `review-row-${r.section}` : undefined}
              data-missing={isMissing ? "true" : undefined}
              className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-3 ${
                isMissing
                  ? "border-[#C9A66B]/60 border-l-4 border-l-[#C9A66B] bg-[#C9A66B]/[0.08]"
                  : "border-white/8 bg-white/[0.02]"
              }`}
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-white/40">
                  {r.label}
                  {isMissing ? (
                    <span className="rounded bg-[#C9A66B]/20 px-1.5 py-0.5 text-[0.6rem] font-semibold tracking-normal text-[#C9A66B]" data-testid="required-badge">
                      {t.requiredLabel}
                    </span>
                  ) : null}
                </span>
                <span className={`text-[0.95rem] leading-6 ${isMissing ? "text-white/50" : "text-white/85"}`}>
                  {r.value ?? t.reviewEmpty}
                </span>
                {r.lines?.map((line, li) => (
                  <span key={li} className="mt-0.5 text-xs leading-5 text-[#C9A66B]/80">
                    {line}
                  </span>
                ))}
                {isMissing && r.section ? (
                  <span className="mt-0.5 text-xs leading-5 text-[#C9A66B]/90">{sectionReason(r.section, t)}</span>
                ) : r.note ? (
                  <span className="mt-0.5 text-xs leading-5 text-amber-300/75">
                    {r.note.title}
                    {r.note.hint ? ` · ${r.note.hint}` : ""}
                  </span>
                ) : null}
              </div>
              <button type="button" onClick={() => onEdit(r.step)} className="shrink-0 text-xs text-[#C9A66B]">
                {t.editSection}
              </button>
            </div>
          );
        })}
      </section>
    </div>
  );
}

/**
 * Leaders eligibility preview (Slice 3.1B-2).
 *
 * Shows how many members of the Host's own organization currently hold a canonical
 * leadership responsibility, and who they are. It is deliberately explicit that this is a
 * PREVIEW: selecting "Leaders" describes the module's intended audience, it does not assign
 * members, restrict entry, or target anyone — Foundry participation remains anonymous and
 * link-based. Identity-bound targeting is Slice 3.1B-3.
 *
 * Render-only: eligibility is resolved entirely server-side by the canonical resolver. The
 * component never computes leader status and never sends an organization id.
 */
function LeadersEligibilityPreview({
  t,
  onResolvedCount,
}: {
  t: ModuleBuilderCopy;
  onResolvedCount?: (n: number | null) => void;
}) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; count: number; names: string[] }
    | { kind: "error" }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/bty/foundry/audience/leaders-preview", {
          credentials: "include",
          cache: "no-store",
        });
        const data: {
          ok?: boolean;
          eligibleCount?: number;
          members?: Array<{ displayName: string | null }>;
        } = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setState({ kind: "error" });
          onResolvedCount?.(null);
          return;
        }
        setState({
          kind: "ready",
          count: data.eligibleCount ?? 0,
          names: (data.members ?? []).map((m) => m.displayName).filter((n): n is string => !!n),
        });
        onResolvedCount?.(data.eligibleCount ?? 0);
      } catch {
        if (!cancelled) {
          setState({ kind: "error" });
          onResolvedCount?.(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onResolvedCount]);

  return (
    <div
      className="mt-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
      data-testid="leaders-eligibility-preview"
    >
      {state.kind === "loading" ? (
        <p className="text-sm text-white/50">{t.audLeadersPreviewLoading}</p>
      ) : state.kind === "error" ? (
        <p className="text-sm text-white/50" data-testid="leaders-preview-error">
          {t.audLeadersPreviewError}
        </p>
      ) : (
        <>
          <p className="text-sm text-white/80" data-testid="leaders-eligible-count">
            {t.audLeadersEligible(state.count)}
          </p>
          {state.count === 0 ? (
            // Never silently fall back to Everyone — say plainly that nobody qualifies yet.
            <p className="mt-1 text-sm text-[#E5B769]" data-testid="leaders-zero-warning">
              {t.audLeadersZero}
            </p>
          ) : state.names.length > 0 ? (
            <p className="mt-1 text-sm text-white/60" data-testid="leaders-eligible-names">
              {state.names.join(", ")}
            </p>
          ) : null}
        </>
      )}
      {/* The non-assignment contract, stated where the Host makes the choice. */}
      <p className="mt-2 text-xs leading-relaxed text-white/40" data-testid="leaders-preview-note">
        {t.audLeadersPreviewNote}
      </p>
    </div>
  );
}

/**
 * Participation-mode chooser (Slice 3.1B-3C). Shown at review/publish. Default OPEN_LINK.
 *
 * ASSIGNED_OVERLAY is an overlay, never an entry gate: the copy is explicit that the room
 * stays link-based and that no invitation is sent and no login is required to open it. When
 * assigned + Leaders is chosen we reuse the existing 3.1B-2 eligibility preview so the Host
 * sees the recipient count before publishing; the server re-resolves authoritatively and
 * blocks a zero-recipient assigned publish.
 */
function ParticipationModeChooser({
  mode,
  audienceType,
  intendedCount,
  onIntendedCount,
  onChange,
  t,
}: {
  mode: "open_link" | "assigned_overlay";
  audienceType: string | null;
  intendedCount: number | null;
  onIntendedCount: (n: number | null) => void;
  onChange: (m: "open_link" | "assigned_overlay") => void;
  t: ModuleBuilderCopy;
}) {
  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-4" data-testid="participation-mode">
      <h3 className="mb-2 text-sm font-semibold text-white/80">{t.pmTitle}</h3>
      <div className="flex flex-col gap-2">
        <ModeOption
          active={mode === "open_link"}
          label={t.pmOpenLabel}
          desc={t.pmOpenDesc}
          onClick={() => onChange("open_link")}
          testid="participation-mode-open"
        />
        <ModeOption
          active={mode === "assigned_overlay"}
          label={t.pmAssignedLabel}
          desc={t.pmAssignedDesc}
          onClick={() => onChange("assigned_overlay")}
          testid="participation-mode-assigned"
        />
      </div>
      {/* OPEN_LINK — state plainly that nothing will be assigned, so it can never be
          confused with an assigned publish (the 3.1B-3C gate-B lesson). */}
      {mode === "open_link" ? (
        <p className="mt-3 text-xs leading-relaxed text-white/45" data-testid="participation-open-summary">
          {t.pmOpenNoAssign}
        </p>
      ) : (
        <div className="mt-3" data-testid="participation-mode-assigned-detail">
          {audienceType === "leaders" ? (
            <LeadersEligibilityPreview t={t} onResolvedCount={onIntendedCount} />
          ) : (
            <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/50">
              {t.pmAudienceHint}
            </p>
          )}
          {/* INTENDED count (pre-publish), explicitly framed as what WILL be created. */}
          {audienceType === "leaders" && intendedCount != null ? (
            <p className="mt-2 text-sm font-medium text-[#E5B769]" data-testid="participation-intended-count">
              {t.pmWillCreate(intendedCount)}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-white/45" data-testid="participation-room-note">
            {t.pmRoomLinkBased}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-white/40" data-testid="participation-mode-note">
            {t.pmAssignedNote}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Post-publish confirmation (Slice 3.1B-3C fix). Reports the AUTHORITATIVE committed result
 * from the publish response — the actual mode + assignment count the server wrote — never
 * the pre-publish preview. This is the surface Gate B needs to distinguish an assigned
 * publish from an open-link one.
 */
function PublishConfirmation({
  result,
  onContinue,
  t,
}: {
  result: { mode: "open_link" | "assigned_overlay"; assignmentCount: number; audienceType: string | null };
  onContinue: () => void;
  t: ModuleBuilderCopy;
}) {
  const assigned = result.mode === "assigned_overlay";
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-white/12 bg-white/[0.03] p-5" data-testid="publish-confirmation">
      <h3 className="text-base font-semibold text-white/90">
        {assigned ? t.pmDoneAssignedTitle : t.pmDoneOpenTitle}
      </h3>
      {assigned ? (
        <>
          <p className="text-sm text-[#E5B769]" data-testid="publish-confirm-count">
            {t.pmDoneAssignedCount(result.assignmentCount)}
          </p>
          <p className="text-xs text-white/50" data-testid="publish-confirm-room">{t.pmRoomLinkBased}</p>
        </>
      ) : (
        <p className="text-sm text-white/60" data-testid="publish-confirm-open">{t.pmDoneOpenNoAssign}</p>
      )}
      <button
        type="button"
        onClick={onContinue}
        data-testid="publish-confirm-continue"
        className="mt-1 self-start rounded-xl bg-[#C9A66B] px-5 py-2.5 text-sm font-semibold text-[#0B1F3A]"
      >
        {t.pmDoneContinue}
      </button>
    </div>
  );
}

function ModeOption({
  active,
  label,
  desc,
  onClick,
  testid,
}: {
  active: boolean;
  label: string;
  desc: string;
  onClick: () => void;
  testid: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      aria-pressed={active}
      className={`rounded-xl border px-3 py-2.5 text-left transition ${
        active ? "border-[#C9A66B]/60 bg-[#C9A66B]/[0.08]" : "border-white/12 bg-white/[0.03] hover:border-white/25"
      }`}
    >
      <span className="block text-sm font-medium text-white/85">{label}</span>
      <span className="mt-0.5 block text-xs leading-relaxed text-white/45">{desc}</span>
    </button>
  );
}
