"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "./copy";
import { MODULE_BUILDER_COPY, arenaFollowLabel, type ModuleBuilderCopy } from "./moduleBuilderCopy";
import { createSerializedSaver, type SaveState } from "./moduleAutosave";
import {
  canAdvanceStep,
  observableBehaviorWarning,
  recommendArenaForNeed,
  stepBlocker,
  BUILDER_STEP_MAX,
  type BuilderAnswers,
  type AudienceType,
  type EvidenceObservation,
  type LearningNeed,
  type MaterialIntent,
  type FollowUpDays,
} from "@/domain/foundry/module/module-builder";
import type { ClientDraft } from "@/lib/bty/foundry/events/moduleClient";

/**
 * ModuleBuilderShell — the manual Guided Module Builder (Slice 2).
 *
 * One primary question per step. Server-authoritative draft: on mount it restores
 * the exact answers + current_step from the server (no empty-form flash, no
 * restore-vs-typing race — local state is seeded only after the fetch resolves).
 * Autosave is serialized (one PATCH at a time, newest wins) via createSerializedSaver.
 * This slice ends at a read-only draft review: NO approve / publish / create-session.
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
  onExit: (result?: { gone?: boolean }) => void;
}) {
  const t: ModuleBuilderCopy = MODULE_BUILDER_COPY[locale];

  const [restore, setRestore] = useState<Restore>("loading");
  const [answers, setAnswers] = useState<BuilderAnswers>({});
  const [step, setStep] = useState<number>(1);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [blocker, setBlocker] = useState<string | null>(null);

  // Latest local state, readable inside async saves without stale closures.
  const answersRef = useRef<BuilderAnswers>({});
  const stepRef = useRef<number>(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goneRef = useRef(false);

  // --- Serialized saver (created once). PATCH one snapshot; 404 => gone. ---
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
        });
        if (res.status === 404) {
          goneRef.current = true;
          return true; // stop retrying; the "gone" effect navigates home.
        }
        return res.ok;
      } catch {
        return false;
      }
    }, setSaveState);
  }
  const saver = saverRef.current;

  // --- Restore from server on mount (authoritative; no empty-form flash). ---
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/bty/foundry/modules/${draftId}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!alive) return;
        if (res.status === 404) {
          setRestore("gone");
          return;
        }
        if (!res.ok) {
          setRestore("unavailable");
          return;
        }
        const data = (await res.json()) as { draft?: ClientDraft };
        const draft = data.draft;
        if (!draft || draft.status !== "draft") {
          setRestore("gone");
          return;
        }
        const a = draft.answers ?? {};
        answersRef.current = a;
        stepRef.current = draft.current_step;
        setAnswers(a);
        setStep(draft.current_step);
        setRestore("loaded");
      } catch {
        if (alive) setRestore("unavailable");
      }
    })();
    return () => {
      alive = false;
    };
  }, [draftId]);

  // If the draft vanished mid-session, return to home with an honest message.
  useEffect(() => {
    if (restore === "gone" || goneRef.current) {
      onExit({ gone: true });
    }
  }, [restore, onExit]);

  const cancelDebounce = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  // Merge a partial answer, keep refs current, and (optionally) schedule a save.
  const patchAnswers = useCallback(
    (partial: BuilderAnswers, immediate: boolean) => {
      setBlocker(null);
      const merged = { ...answersRef.current, ...partial };
      answersRef.current = merged;
      setAnswers(merged);
      const snapshot: Snapshot = { answers: merged, currentStep: stepRef.current };
      cancelDebounce();
      if (immediate) {
        saver.schedule(snapshot);
      } else {
        debounceRef.current = setTimeout(() => saver.schedule(snapshot), 600);
      }
    },
    [saver, cancelDebounce],
  );

  // Flush pending edits, then move to `next`, then save the new step.
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
    if (b) {
      setBlocker(b);
      return;
    }
    if (stepRef.current < BUILDER_STEP_MAX) void navigate(stepRef.current + 1);
  }, [navigate]);

  const goBack = useCallback(() => {
    if (stepRef.current > 1) void navigate(stepRef.current - 1);
  }, [navigate]);

  const jumpTo = useCallback(
    (target: number) => {
      void navigate(target);
    },
    [navigate],
  );

  const saveAndLeave = useCallback(async () => {
    cancelDebounce();
    const ok = await saver.flush({ answers: answersRef.current, currentStep: stepRef.current });
    if (ok && !goneRef.current) onExit();
    // On failure the save state shows "Couldn’t save — Retry"; the host stays put.
  }, [saver, cancelDebounce, onExit]);

  const retry = useCallback(() => {
    void saver.retry();
  }, [saver]);

  useEffect(() => () => cancelDebounce(), [cancelDebounce]);

  // --- Restore gates ---
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
  if (restore === "gone") {
    return <div aria-hidden className="min-h-[30vh]" />; // navigating home via effect
  }

  const arenaChosen = answers.arenaRecommended ?? recommendArenaForNeed(answers.learningNeed);

  return (
    <div className="btyFadeIn flex flex-col gap-6" data-testid="module-builder">
      {/* Progress + save state */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">
          {step <= BUILDER_STEP_MAX - 1 ? t.stepOf(step, BUILDER_STEP_MAX - 1) : t.reviewEyebrow}
        </span>
        <SaveStatus state={saveState} t={t} onRetry={retry} />
      </div>

      <div className="min-h-[42vh]">{renderStep(step, answers, patchAnswers, blocker, t)}</div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <div>
          {step > 1 ? (
            <button type="button" onClick={goBack} className="rounded-lg px-3 py-2 text-sm text-white/70">
              {t.back}
            </button>
          ) : (
            <span />
          )}
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={saveAndLeave} className="rounded-lg px-3 py-2 text-sm text-white/60">
            {t.saveAndLeave}
          </button>
          {step < BUILDER_STEP_MAX ? (
            <button
              type="button"
              onClick={goNext}
              className="rounded-xl bg-[#C9A66B] px-6 py-3 text-sm font-semibold text-[#0B1F3A]"
            >
              {t.next}
            </button>
          ) : null}
        </div>
      </div>

      {step === BUILDER_STEP_MAX ? (
        <ReviewSummary answers={answers} arenaChosen={arenaChosen} onEdit={jumpTo} t={t} />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Save status pill
// ---------------------------------------------------------------------------
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

function OptionButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
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

function BlockerLine({ show, text }: { show: boolean; text: string }) {
  if (!show) return null;
  return <p className="text-xs leading-5 text-amber-300/80">{text}</p>;
}

function renderStep(step: number, a: BuilderAnswers, patch: Patch, blocker: string | null, t: ModuleBuilderCopy) {
  switch (step) {
    case 1:
      return (
        <StepFrame q={t.s1Q} help={t.s1Help}>
          {textArea(a.problem ?? "", (v) => patch({ problem: v }, false), t.s1Placeholder, t.s1Q)}
          <BlockerLine show={blocker === "problem_required"} text={t.s1Blocker} />
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
          <BlockerLine show={blocker === "audience_required"} text={t.s2Blocker} />
          <BlockerLine show={blocker === "audience_detail_required"} text={t.s2DetailBlocker} />
        </StepFrame>
      );
    }
    case 3: {
      const vague = observableBehaviorWarning(a.observableBehavior) === "observable_behavior_vague";
      return (
        <StepFrame q={t.s3Q} help={t.s3Help}>
          {textArea(a.observableBehavior ?? "", (v) => patch({ observableBehavior: v }, false), t.s3Placeholder, t.s3Q)}
          {vague ? <p className="text-xs leading-5 text-white/45">{t.s3VagueGuidance}</p> : null}
          <BlockerLine show={blocker === "behavior_required"} text={t.s3Blocker} />
        </StepFrame>
      );
    }
    case 4: {
      const chip = (type: EvidenceObservation, label: string) => (
        <button
          type="button"
          onClick={() => patch({ evidenceType: type }, true)}
          aria-pressed={a.evidenceType === type}
          className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
            a.evidenceType === type
              ? "border-[#C9A66B]/70 bg-[#C9A66B]/15 text-white"
              : "border-white/12 bg-white/[0.03] text-white/70"
          }`}
        >
          {label}
        </button>
      );
      return (
        <StepFrame q={t.s4Q} help={t.s4Help}>
          {textArea(a.successEvidence ?? "", (v) => patch({ successEvidence: v }, false), t.s4Placeholder, t.s4Q)}
          <div className="flex flex-wrap gap-2">
            {chip("seen", t.evSeen)}
            {chip("heard", t.evHeard)}
            {chip("recorded", t.evRecorded)}
            {chip("confirmed", t.evConfirmed)}
          </div>
          <p className="text-xs leading-5 text-white/40">{t.s4Honesty}</p>
          <BlockerLine show={blocker === "evidence_required"} text={t.s4Blocker} />
        </StepFrame>
      );
    }
    case 5: {
      const opt = (need: LearningNeed, label: string) => (
        <OptionButton active={a.learningNeed === need} label={label} onClick={() => patch({ learningNeed: need }, true)} />
      );
      return (
        <StepFrame q={t.s5Q}>
          <div className="flex flex-col gap-2.5">
            {opt("know", t.needKnow)}
            {opt("decide", t.needDecide)}
            {opt("practice", t.needPractice)}
            {opt("shared_standard", t.needShared)}
          </div>
          {recommendArenaForNeed(a.learningNeed) ? (
            <p className="text-xs leading-5 text-[#C9A66B]/80">{t.s5ArenaHint}</p>
          ) : null}
          <BlockerLine show={blocker === "learning_need_required"} text={t.s5Blocker} />
        </StepFrame>
      );
    }
    case 6: {
      const opt = (m: MaterialIntent, label: string) => (
        <OptionButton active={a.materialIntent === m} label={label} onClick={() => patch({ materialIntent: m }, true)} />
      );
      const showText = a.materialIntent === "youtube" || a.materialIntent === "written" || a.materialIntent === "live_discussion";
      const placeholder =
        a.materialIntent === "youtube"
          ? t.matYoutubePlaceholder
          : a.materialIntent === "written"
            ? t.matWrittenPlaceholder
            : t.matLivePlaceholder;
      return (
        <StepFrame q={t.s6Q}>
          <div className="flex flex-col gap-2.5">
            {opt("youtube", t.matYoutube)}
            {opt("pdf", t.matPdf)}
            {opt("written", t.matWritten)}
            {opt("live_discussion", t.matLive)}
          </div>
          {a.materialIntent === "pdf" ? <p className="text-sm leading-6 text-white/55">{t.matPdfDeferred}</p> : null}
          {showText ? textArea(a.materialText ?? "", (v) => patch({ materialText: v }, false), placeholder, t.s6Q) : null}
          <BlockerLine show={blocker === "material_intent_required"} text={t.s6Blocker} />
        </StepFrame>
      );
    }
    case 7: {
      const recommend = recommendArenaForNeed(a.learningNeed);
      const chosen = a.arenaRecommended ?? recommend;
      const followOpt = (days: FollowUpDays, label: string) => (
        <OptionButton
          active={(a.followUpDays ?? -1) === days}
          label={label}
          onClick={() => patch({ followUpDays: days }, true)}
        />
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
      return <div />; // step 8 body is the ReviewSummary rendered below the nav.
  }
}

// ---------------------------------------------------------------------------
// Step 8 — read-only draft review (NO approve / publish / create-session)
// ---------------------------------------------------------------------------
function ReviewSummary({
  answers: a,
  arenaChosen,
  onEdit,
  t,
}: {
  answers: BuilderAnswers;
  arenaChosen: boolean;
  onEdit: (step: number) => void;
  t: ModuleBuilderCopy;
}) {
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
        return undefined;
    }
  })();
  const learning =
    a.learningNeed === "know"
      ? t.needKnow
      : a.learningNeed === "decide"
        ? t.needDecide
        : a.learningNeed === "practice"
          ? t.needPractice
          : a.learningNeed === "shared_standard"
            ? t.needShared
            : undefined;
  const material =
    a.materialIntent === "youtube"
      ? t.matYoutube
      : a.materialIntent === "pdf"
        ? t.matPdf
        : a.materialIntent === "written"
          ? t.matWritten
          : a.materialIntent === "live_discussion"
            ? t.matLive
            : undefined;

  const row = (label: string, value: string | undefined, step: number) => (
    <div className="flex items-start justify-between gap-4 border-b border-white/8 py-3">
      <div className="min-w-0 flex flex-col gap-1">
        <span className="text-xs uppercase tracking-[0.12em] text-white/40">{label}</span>
        <span className="text-[0.95rem] leading-6 text-white/85">{value?.trim() ? value : t.reviewEmpty}</span>
      </div>
      <button type="button" onClick={() => onEdit(step)} className="shrink-0 text-xs text-[#C9A66B]">
        {t.editSection}
      </button>
    </div>
  );

  return (
    <section className="mt-2 flex flex-col rounded-2xl border border-white/8 bg-white/[0.02] px-4">
      {row(t.reviewChange, a.problem, 1)}
      {row(t.reviewWho, audience, 2)}
      {row(t.reviewBehavior, a.observableBehavior, 3)}
      {row(t.reviewEvidence, a.successEvidence, 4)}
      {row(t.reviewLearning, learning, 5)}
      {row(t.reviewMaterial, material, 6)}
      {row(t.reviewArena, arenaChosen ? t.arenaYes : t.arenaNo, 7)}
      {row(t.reviewFollow, arenaFollowLabel(a.followUpDays, t.followNone, t.follow7, t.follow30), 7)}
    </section>
  );
}
