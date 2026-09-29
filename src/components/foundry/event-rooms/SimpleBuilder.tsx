"use client";

import { useCallback, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";
import { fallbackSimpleGuidance, type SimpleSuggestion } from "@/domain/foundry/module/direction-copilot";
import { approximateMinutes, learnSummary } from "@/domain/foundry/module/simple-mode";
import { sectionForBlockingCode } from "@/domain/foundry/module/module-publish";
import { ProgramAuthorship, type ProgramApplyOutcome, type ProgramGenerateOutcome } from "./ProgramAuthorship";

/** Exactly the adoption write ProgramAuthorship calls — the shell's canonical `applyProgram`. */
export type ApplyFn = ComponentProps<typeof ProgramAuthorship>["onApply"];

/**
 * FOUNDRY SIMPLE MODE — the default way to create a training (Slice 2).
 *
 * Two authoring steps and a Review. The manager states the change they want; BTY suggests ONE
 * behaviour and when it happens; "Create training" does the rest through the SAME canonical parts
 * the detailed builder uses:
 *
 *   * the answers are saved by the shell's own PATCH (`onSave`);
 *   * the program is generated, validated and ADOPTED by the shell's own `ProgramAuthorship`
 *     in its automatic mode (`renderProgramAuthorship`) — this component only wraps two of its
 *     inputs, so no second adoption path exists;
 *   * publishing is the shell's own participation choice + publish action (`publishPanel`).
 *
 * SAVE FIRST, THEN GENERATE. Create writes the manager's intent before any program is asked for
 * (and the shell's generator flushes pending saves before it spends), so a refused program can
 * never cost the manager their training.
 *
 * REFUSAL CONTAINMENT. The generator wrapper spends AT MOST one repair: a content refusal on the
 * first program is answered by one regeneration carrying the refusal code; a second content
 * refusal ends in "Training saved. BTY needs a little more detail to finish it." → Edit details
 * (pre-filled). Infrastructure failures are NOT converted into editing: they keep their truthful
 * message and may be retried.
 *
 * NO LEGACY SURFACE. ProgramAuthorship runs HIDDEN here and reports every terminal failure through
 * `onAutoFailure` — including a refusal remembered from an earlier attempt on the same answers,
 * which it would otherwise render as the detailed builder's "couldn't draft" panel with its own
 * regenerate button. Simple Mode never shows validator language and never offers a paid re-roll.
 *
 * HIDDEN FIELDS. The suggestion's `title` and `successEvidence` exist to make generation succeed.
 * They are saved to the draft but never rendered on the two authoring steps.
 */

type Phase = "goal" | "suggesting" | "suggestion" | "editing" | "ready" | "creating" | "review" | "needs_detail" | "create_failed";

const COPY = {
  en: {
    eyebrow: "New training",
    ask: "What do you want people to do better?",
    example: "For example: Check one preventable problem before the first patient arrives.",
    continue: "Continue",
    suggesting: "Writing a suggestion…",
    suggestFailed: "BTY couldn't write a suggestion just now. Please retry in a moment.",
    retry: "Retry",
    suggested: "Suggested behavior",
    when: "When",
    useThis: "Use this",
    edit: "Edit",
    done: "Done",
    back: "Back",
    create: "Create training",
    creating: "Creating your training…",
    needsDetail: "Training saved. BTY needs a little more detail to finish it.",
    createFailed: "BTY couldn't reach the writing service. Nothing was lost — please retry in a moment.",
    editDetails: "Edit details",
    reviewEyebrow: "Review",
    learn: "What they'll learn",
    differently: "What they'll do differently",
    time: "Approximate time",
    minutes: (n: number) => `About ${n} min`,
    behaviorLabel: "Behavior",
  },
  ko: {
    eyebrow: "새 훈련",
    ask: "사람들이 무엇을 더 잘하게 만들고 싶나요?",
    example: "예: 첫 환자가 오기 전에 문제 하나를 미리 확인하고 해결하기",
    continue: "계속",
    suggesting: "제안을 만드는 중…",
    suggestFailed: "지금은 제안을 만들지 못했습니다. 잠시 후 다시 해 주세요.",
    retry: "다시 하기",
    suggested: "제안하는 행동",
    when: "언제",
    useThis: "이대로 사용",
    edit: "수정",
    done: "완료",
    back: "뒤로",
    create: "훈련 만들기",
    creating: "훈련을 만드는 중…",
    needsDetail: "트레이닝은 저장되었습니다. BTY가 완성하려면 조금만 더 구체화하면 됩니다.",
    createFailed: "지금은 작성 서비스에 연결하지 못했습니다. 잃은 내용은 없습니다. 잠시 후 다시 해 주세요.",
    editDetails: "세부 내용 수정",
    reviewEyebrow: "검토",
    learn: "무엇을 배우나요",
    differently: "무엇을 다르게 하나요",
    time: "예상 시간",
    minutes: (n: number) => `약 ${n}분`,
    behaviorLabel: "행동",
  },
} as const;

/** A content refusal is a program the provider RETURNED and BTY refused. Everything else is infrastructure. */
export function isContentRefusal(o: ProgramGenerateOutcome): o is Extract<ProgramGenerateOutcome, { ok: false }> & { refusal: string } {
  return !o.ok && o.code === "invalid_output" && typeof o.refusal === "string" && o.refusal.length > 0;
}

export type SimpleBuilderProps = {
  draftId: string;
  locale: "en" | "ko";
  answers: BuilderAnswers;
  /** The shell's own save. `immediate` writes now rather than on the debounce. */
  onSave: (partial: BuilderAnswers, immediate: boolean) => void;
  /** The shell's own generator; `repairRefusal` adds the ONE closed-vocabulary repair instruction. */
  onGenerate: (repairRefusal?: string) => Promise<ProgramGenerateOutcome>;
  /**
   * Every prop the shell gives its own ProgramAuthorship (automatic mode), except the two Simple
   * Mode wraps: the generator (one repair at most) and the adoption write (to know when it landed).
   */
  programAuthorshipProps: Omit<ComponentProps<typeof ProgramAuthorship>, "onGenerate" | "onApply">;
  /** The shell's canonical adoption write, wrapped so Simple Mode knows when it landed. */
  onApply: ApplyFn;
  /** The shell's own participation choice + publish action — the audience is chosen here, at publish. */
  publishPanel: ReactNode;
  /** Switch to the detailed builder, pre-filled, optionally at a step. */
  onEditDetails: (step?: number) => void;
  /** Injected for tests; defaults to the real routes. */
  fetchImpl?: typeof fetch;
};

export default function SimpleBuilder(props: SimpleBuilderProps) {
  const { draftId, locale, answers, onSave, onGenerate, programAuthorshipProps, onApply, publishPanel, onEditDetails } = props;
  const t = COPY[locale];
  const f = props.fetchImpl ?? fetch;
  const adopted = answers.realityGroundedJourneyV1 !== undefined && answers.programAdoptionV1 !== undefined;
  /*
    A REOPENED SAVED TRAINING RESUMES; IT DOES NOT START OVER. Create saved the intent, so a draft
    that has it but no program yet goes back to finishing — where a refusal remembered for these
    exact answers is reported by the hidden ProgramAuthorship (and spends nothing), and anything
    else continues exactly as the detailed builder's Review would.
  */
  const savedIntent = answers.builderMode === "simple" && !!answers.problem && !!answers.observableBehavior && !!answers.recurringMoment;
  const [phase, setPhase] = useState<Phase>(adopted ? "review" : savedIntent ? "creating" : "goal");
  const [goal, setGoal] = useState(typeof answers.problem === "string" ? answers.problem : "");
  const [suggestion, setSuggestion] = useState<SimpleSuggestion | null>(null);
  const [draftBehavior, setDraftBehavior] = useState("");
  const [draftWhen, setDraftWhen] = useState("");
  const [recoveryStep, setRecoveryStep] = useState<number | undefined>(undefined);
  const [suggestionFailed, setSuggestionFailed] = useState(false);
  /** Program attempts spent in THIS Create. Hard ceiling: 2. */
  const attemptsRef = useRef(0);
  /** The handoff marker is written once per refused context. */
  const handoffWrittenRef = useRef("");

  /*
    REFUSED AFTER THE REPAIR → hand over, protected. The marker records the canonical fingerprint of
    the answers BTY refused (the one the attempt ledger keys by), so the detailed builder can tell
    "the same answers, reached by navigating" from "the manager changed something".
  */
  const needsDetail = useCallback(() => {
    const fingerprint = programAuthorshipProps.currentContextFingerprint;
    if (fingerprint && handoffWrittenRef.current !== fingerprint) {
      handoffWrittenRef.current = fingerprint;
      onSave({ simpleRefusalHandoffV1: { fingerprint, active: true } }, true);
    }
    setPhase("needs_detail");
  }, [programAuthorshipProps.currentContextFingerprint, onSave]);

  const requestSuggestion = useCallback(async () => {
    if (!goal.trim()) return;
    setPhase("suggesting");
    try {
      const res = await f(`/api/bty/foundry/modules/${draftId}/simple-suggestion`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goal.trim(), locale }),
      });
      const data = (await res.json().catch(() => ({}))) as { suggestion?: SimpleSuggestion };
      if (res.ok && data.suggestion) {
        setSuggestion(data.suggestion);
        setPhase("suggestion");
        return;
      }
    } catch {
      /* truthful failure below */
    }
    setPhase("goal");
    setSuggestionFailed(true);
  }, [goal, draftId, locale, f]);

  /*
    CREATE. Save every input first — the manager's sentence, the confirmed behaviour and moment, the
    hidden title and evidence, and the defaults (everyone; BTY-written guidance) — then let the
    canonical ProgramAuthorship generate and adopt. The guidance is written in parallel and saved
    as soon as it arrives; it never blocks the training.
  */
  const create = useCallback(async () => {
    if (!suggestion) return;
    attemptsRef.current = 0;
    setPhase("creating");
    onSave(
      {
        builderMode: "simple",
        problem: goal.trim(),
        title: suggestion.title,
        observableBehavior: suggestion.behavior,
        recurringMoment: suggestion.when,
        successEvidence: suggestion.successEvidence,
        audienceType: "everyone",
        materialIntent: "written",
      },
      true,
    );
    void (async () => {
      try {
        const res = await f(`/api/bty/foundry/modules/${draftId}/simple-guidance`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal: goal.trim(), title: suggestion.title, behavior: suggestion.behavior, when: suggestion.when, locale }),
        });
        const data = (await res.json().catch(() => ({}))) as { guidance?: string };
        if (res.ok && typeof data.guidance === "string" && data.guidance.trim()) {
          onSave({ materialText: data.guidance }, true);
          return;
        }
      } catch {
        /* fall through to the deterministic guidance */
      }
      // The written material is never left empty: a training must not be blocked on optional prose.
      onSave({ materialText: fallbackSimpleGuidance({ goal: goal.trim(), behavior: suggestion.behavior, when: suggestion.when }, locale) }, true);
    })();
  }, [suggestion, goal, onSave, draftId, locale, f]);

  /** The generator ProgramAuthorship calls: at most one repair, then Edit details. */
  const guardedGenerate = useCallback(async (): Promise<ProgramGenerateOutcome> => {
    if (attemptsRef.current >= 2) return { ok: false, code: "attempts_exhausted" };
    attemptsRef.current += 1;
    const first = await onGenerate();
    if (first.ok) return first;
    if (!isContentRefusal(first)) {
      setPhase("create_failed");
      return first;
    }
    attemptsRef.current += 1;
    const second = await onGenerate(first.refusal);
    if (second.ok) return second;
    if (isContentRefusal(second)) {
      const target = (second as { recovery?: { step: number } | null }).recovery ?? (first as { recovery?: { step: number } | null }).recovery;
      setRecoveryStep(target?.step);
      needsDetail();
    } else {
      setPhase("create_failed");
    }
    return second;
  }, [onGenerate, needsDetail]);

  const guardedApply = useCallback(
    async (...args: Parameters<ApplyFn>): Promise<ProgramApplyOutcome> => {
      // A missing outcome is a failed save — the same reading ProgramAuthorship applies.
      const outcome: ProgramApplyOutcome = (await onApply(...args)) ?? { status: "save_failed" };
      if (outcome.status === "adopted" || outcome.status === "adopted_receipt_pending") setPhase("review");
      else setPhase("needs_detail");
      return outcome;
    },
    [onApply],
  );

  /*
    "More detail" means the behaviour — the answer every content refusal is ultimately about. Edit
    details therefore opens a FIELD, never the detailed builder's Review: Review with unchanged
    answers would only restore the same refusal.
  */
  const detailStep = recoveryStep ?? sectionForBlockingCode("behavior_required")?.step;

  /** Every terminal failure of the hidden ProgramAuthorship lands on a Simple Mode surface. */
  const onAutoFailure = useCallback((f: { content: boolean; recovery: { field: string; step: number } | null }) => {
    if (f.content) {
      setRecoveryStep((prev) => prev ?? f.recovery?.step);
      needsDetail();
    } else {
      setPhase("create_failed");
    }
  }, [needsDetail]);

  // Guarantee usable written material even when the guidance call failed.
  const materialText = typeof answers.materialText === "string" ? answers.materialText : "";
  const minutes = useMemo(() => approximateMinutes(answers.realityGroundedJourneyV1, materialText), [answers.realityGroundedJourneyV1, materialText]);

  const card = "rounded-2xl border border-white/10 bg-white/[0.03] p-5";
  const primary = "rounded-xl bg-[#C9A66B] px-5 py-3 text-sm font-semibold text-[#0B1F3A] disabled:opacity-40";
  const secondary = "rounded-xl border border-white/20 px-5 py-3 text-sm text-white/80";

  return (
    <div className="btyFadeIn flex flex-col gap-5" data-testid="simple-builder" data-phase={phase}>
      <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">
        {phase === "review" ? t.reviewEyebrow : t.eyebrow}
      </span>

      {phase === "goal" || phase === "suggesting" ? (
        <div className="flex flex-col gap-3">
          <label htmlFor="simple-goal" className="text-xl font-semibold leading-snug text-white">{t.ask}</label>
          <textarea
            id="simple-goal"
            data-testid="simple-goal"
            rows={3}
            maxLength={500}
            value={goal}
            disabled={phase === "suggesting"}
            onChange={(e) => { setGoal(e.target.value); setSuggestionFailed(false); }}
            className="w-full resize-none rounded-xl bg-white/10 px-4 py-3 text-white placeholder-white/40 outline-none focus:bg-white/15"
          />
          <p className="text-xs text-white/45">{t.example}</p>
          {suggestionFailed ? <p className="text-sm text-red-300" data-testid="simple-suggest-failed">{t.suggestFailed}</p> : null}
          <button type="button" data-testid="simple-continue" className={`${primary} self-start`} disabled={!goal.trim() || phase === "suggesting"} onClick={() => void requestSuggestion()}>
            {phase === "suggesting" ? t.suggesting : suggestionFailed ? t.retry : t.continue}
          </button>
        </div>
      ) : null}

      {phase === "suggestion" && suggestion ? (
        <div className="flex flex-col gap-4">
          <div className={card} data-testid="simple-suggestion">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#C9A66B]/80">{t.suggested}</p>
            <p className="mt-2 text-lg leading-7 text-white" data-testid="simple-behavior">{suggestion.behavior}</p>
            <p className="mt-2 text-sm text-white/65"><span className="text-white/45">{t.when}: </span><span data-testid="simple-when">{suggestion.when}</span></p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" data-testid="simple-use-this" className={primary} onClick={() => setPhase("ready")}>{t.useThis}</button>
            <button type="button" data-testid="simple-edit" className={secondary} onClick={() => { setDraftBehavior(suggestion.behavior); setDraftWhen(suggestion.when); setPhase("editing"); }}>{t.edit}</button>
            <button type="button" data-testid="simple-back" className="px-2 text-sm text-white/50" onClick={() => setPhase("goal")}>{t.back}</button>
          </div>
        </div>
      ) : null}

      {phase === "ready" && suggestion ? (
        <div className="flex flex-col gap-4" data-testid="simple-ready">
          <div className={card}>
            <p className="text-lg leading-7 text-white">{suggestion.behavior}</p>
            <p className="mt-2 text-sm text-white/65"><span className="text-white/45">{t.when}: </span>{suggestion.when}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" data-testid="simple-create" className={primary} onClick={() => void create()}>{t.create}</button>
            <button type="button" className="px-2 text-sm text-white/50" onClick={() => setPhase("suggestion")}>{t.back}</button>
          </div>
        </div>
      ) : null}

      {phase === "editing" && suggestion ? (
        <div className="flex flex-col gap-3" data-testid="simple-editing">
          <label className="text-sm text-white/70" htmlFor="simple-edit-behavior">{t.behaviorLabel}</label>
          <textarea id="simple-edit-behavior" data-testid="simple-edit-behavior" rows={2} maxLength={300} value={draftBehavior}
            onChange={(e) => setDraftBehavior(e.target.value)}
            className="w-full resize-none rounded-xl bg-white/10 px-4 py-3 text-white outline-none focus:bg-white/15" />
          <label className="text-sm text-white/70" htmlFor="simple-edit-when">{t.when}</label>
          <input id="simple-edit-when" data-testid="simple-edit-when" maxLength={200} value={draftWhen}
            onChange={(e) => setDraftWhen(e.target.value)}
            className="w-full rounded-xl bg-white/10 px-4 py-3 text-white outline-none focus:bg-white/15" />
          <button type="button" data-testid="simple-edit-done" className={`${primary} self-start`} disabled={!draftBehavior.trim() || !draftWhen.trim()}
            onClick={() => { setSuggestion({ ...suggestion, behavior: draftBehavior.trim(), when: draftWhen.trim() }); setPhase("ready"); }}>
            {t.done}
          </button>
        </div>
      ) : null}

      {phase === "creating" ? (
        <div className="flex flex-col gap-3" data-testid="simple-creating">
          <p className="text-sm text-white/70">{t.creating}</p>
          <div hidden data-testid="simple-program-engine">
            <ProgramAuthorship {...programAuthorshipProps} onGenerate={guardedGenerate} onApply={guardedApply} onAutoFailure={onAutoFailure} />
          </div>
        </div>
      ) : null}

      {phase === "needs_detail" ? (
        <div className={`${card} flex flex-col gap-3`} data-testid="simple-needs-detail">
          <p className="text-lg font-semibold text-white" data-testid="simple-needs-detail-title">{t.needsDetail}</p>
          <button type="button" data-testid="simple-edit-details" className={`${primary} self-start`} onClick={() => onEditDetails(detailStep)}>{t.editDetails}</button>
        </div>
      ) : null}

      {phase === "create_failed" ? (
        <div className={`${card} flex flex-col gap-3`} data-testid="simple-create-failed">
          <p className="text-sm text-red-300">{t.createFailed}</p>
          <div className="flex gap-3">
            <button type="button" data-testid="simple-create-retry" className={primary} onClick={() => { attemptsRef.current = 0; setPhase("creating"); }}>{t.retry}</button>
            <button type="button" className={secondary} onClick={() => onEditDetails()}>{t.editDetails}</button>
          </div>
        </div>
      ) : null}

      {phase === "review" ? (
        <div className="flex flex-col gap-5" data-testid="simple-review">
          <h2 className="text-2xl font-semibold leading-snug text-white" data-testid="simple-review-title">{answers.title}</h2>
          <dl className="grid gap-4">
            <div><dt className="text-xs uppercase tracking-[0.14em] text-white/45">{t.learn}</dt><dd className="mt-1 text-white/85" data-testid="simple-review-learn">{learnSummary(answers.realityGroundedJourneyV1) ?? goal}</dd></div>
            <div><dt className="text-xs uppercase tracking-[0.14em] text-white/45">{t.differently}</dt><dd className="mt-1 text-white/85" data-testid="simple-review-behavior">{answers.observableBehavior}</dd></div>
            <div><dt className="text-xs uppercase tracking-[0.14em] text-white/45">{t.when}</dt><dd className="mt-1 text-white/85" data-testid="simple-review-when">{answers.recurringMoment}</dd></div>
            <div><dt className="text-xs uppercase tracking-[0.14em] text-white/45">{t.time}</dt><dd className="mt-1 text-white/85" data-testid="simple-review-time">{t.minutes(minutes)}</dd></div>
          </dl>
          {publishPanel}
          <button type="button" data-testid="simple-review-edit-details" className={`${secondary} self-start`} onClick={() => onEditDetails()}>{t.editDetails}</button>
        </div>
      ) : null}
    </div>
  );
}
