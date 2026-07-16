"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "./copy";
import { MODULE_BUILDER_COPY, arenaFollowLabel, type ModuleBuilderCopy } from "./moduleBuilderCopy";
import { createSerializedSaver, type SaveState } from "./moduleAutosave";
import {
  observableBehaviorWarning,
  recommendArenaForNeeds,
  normalizeLearningNeeds,
  stepBlocker,
  BUILDER_STEP_MAX,
  type BuilderAnswers,
  type AudienceType,
  type EvidenceObservation,
  type LearningNeed,
  type FollowUpDays,
} from "@/domain/foundry/module/module-builder";
import type { ClientDraft } from "@/lib/bty/foundry/events/moduleClient";

/**
 * ModuleBuilderShell — the manual Guided Module Builder (Slice 2 / 2.1).
 *
 * One primary question per step. Server-authoritative draft: on mount it restores
 * the exact answers + current_step from the server (no empty-form flash, no
 * restore-vs-typing race). Autosave is serialized (one PATCH at a time, newest
 * wins). This slice ends at a read-only draft review: NO approve / publish /
 * create-session. Persistence engine is regression-protected — unchanged in 2.1.
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

  const answersRef = useRef<BuilderAnswers>({});
  const stepRef = useRef<number>(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goneRef = useRef(false);

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
          return true;
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
        const data = (await res.json()) as { draft?: ClientDraft };
        const draft = data.draft;
        if (!draft || draft.status !== "draft") return setRestore("gone");
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

  return (
    <div className="btyFadeIn flex flex-col gap-6 pb-24" data-testid="module-builder">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">
          {isReview ? t.reviewEyebrow : t.stepOf(step, BUILDER_STEP_MAX - 1)}
        </span>
        <SaveStatus state={saveState} t={t} onRetry={retry} />
      </div>

      {isReview ? (
        <ReviewBody answers={answers} onEdit={jumpTo} t={t} />
      ) : (
        <div className="min-h-[42vh]">{renderStep(step, answers, patchAnswers, blocker, t)}</div>
      )}

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
    </div>
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
            {opt("pdf", t.matPdf)}
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
          {a.materialIntent === "pdf" ? <p className="text-sm leading-6 text-white/55">{t.pdfMissingLead}</p> : null}
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
type ReviewRow = { label: string; value: string | null; step: number; note?: { title: string; hint?: string } };

function buildReviewRows(a: BuilderAnswers, t: ModuleBuilderCopy): ReviewRow[] {
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

  // Behavior weak/empty → needs clarification.
  const behaviorVague =
    !a.observableBehavior?.trim() || observableBehaviorWarning(a.observableBehavior) === "observable_behavior_vague";
  const behaviorNote = behaviorVague ? { title: t.gBehaviorNeeds, hint: t.gBehaviorHint } : undefined;

  // Material — honest missing states (nothing is uploaded/added in this slice).
  let material: string | null = null;
  let materialNote: { title: string; hint?: string } | undefined;
  if (a.materialIntent === "pdf") {
    material = t.matPdf;
    materialNote = { title: t.gPdfMissing, hint: t.requiredBeforeApproval };
  } else if (a.materialIntent === "youtube") {
    material = t.matYoutube;
    if (!a.materialText?.trim()) materialNote = { title: t.gYtMissing, hint: t.requiredBeforeApproval };
  }

  const arenaChosen = a.arenaRecommended ?? recommendArenaForNeeds(needs);

  return [
    { label: t.reviewChange, value: a.problem?.trim() ? a.problem : null, step: 1 },
    { label: t.reviewWho, value: audience, step: 2 },
    { label: t.reviewBehavior, value: a.observableBehavior?.trim() ? a.observableBehavior : null, step: 3, note: behaviorNote },
    { label: t.reviewEvidence, value: a.successEvidence?.trim() ? a.successEvidence : null, step: 4 },
    { label: t.reviewLearning, value: learning, step: 5 },
    { label: t.reviewMaterial, value: material, step: 6, note: materialNote },
    { label: t.reviewArena, value: arenaChosen ? t.arenaYes : t.arenaNo, step: 7 },
    { label: t.reviewFollow, value: arenaFollowLabel(a.followUpDays, t.followNone, t.follow7, t.follow30), step: 7 },
  ];
}

function ReviewBody({ answers, onEdit, t }: { answers: BuilderAnswers; onEdit: (step: number) => void; t: ModuleBuilderCopy }) {
  const rows = buildReviewRows(answers, t);
  const attention = rows.filter((r) => r.note).length;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-base leading-7 text-white/80">{t.reviewLead}</p>
        {attention > 0 ? (
          <p className="text-sm font-medium text-amber-300/85">{t.needsAttention(attention)}</p>
        ) : null}
      </div>
      <section className="flex flex-col rounded-2xl border border-white/8 bg-white/[0.02] px-4">
        {rows.map((r, i) => (
          <div key={i} className="flex items-start justify-between gap-4 border-b border-white/8 py-3 last:border-b-0">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-xs uppercase tracking-[0.12em] text-white/40">{r.label}</span>
              <span className="text-[0.95rem] leading-6 text-white/85">{r.value ?? t.reviewEmpty}</span>
              {r.note ? (
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
        ))}
      </section>
    </div>
  );
}
