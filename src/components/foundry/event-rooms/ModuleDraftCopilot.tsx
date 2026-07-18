"use client";

import { useCallback, useRef, useState } from "react";
import type { ModuleDraftCopilotCopy } from "./moduleBuilderCopy";
import type { LearningNeed, FollowUpDays } from "@/domain/foundry/module/module-builder";

/**
 * Direction-to-Module Draft Copilot (Slice 2.4B) — a bounded, assistive child of the
 * Guided Module Builder's Learning Approach step. The model PROPOSES one structured
 * draft of the REMAINING sections; the Host reviews each section and decides keep /
 * use / skip (and edits the completion question); only on "Apply reviewed draft" are
 * the approved fields written to the canonical draft via the parent's save path.
 *
 * It never fetches, never mutates the draft, and never parses raw provider JSON — the
 * parent supplies `onGenerate` (already-validated data) and `onApply` (canonical merge).
 * Existing Host values default to "Keep current"; a non-empty field is never replaced
 * without an explicit choice. Failure never blocks the manual Builder.
 */

export type ModuleDraftView = {
  learning_approach: LearningNeed[];
  learning_approach_rationale: string;
  completion_question: string;
  arena_recommended: boolean;
  arena_rationale: string;
  follow_up_days: FollowUpDays;
  follow_up_guidance: string;
  material_guidance: { recommended_types: string[]; suggestion: string };
};

export type ModuleDraftGenerateOutcome =
  | { ok: true; draft: ModuleDraftView; assumptions: string[]; warnings: string[] }
  | { ok: false; code: "rate_limit" | "context_mismatch" | "generic" };

export type AppliedModuleDraft = Partial<{
  learningNeeds: LearningNeed[];
  completionPrompt: string;
  arenaRecommended: boolean;
  followUpDays: FollowUpDays;
}>;

export type ModuleDraftCurrent = {
  learningNeeds: LearningNeed[];
  completionPrompt: string;
  arenaRecommended: boolean | undefined;
  followUpDays: FollowUpDays | undefined;
};

type Phase = "idle" | "loading" | "review" | "applied" | "error";
type Decision = "keep" | "use" | "skip";

type Draft = { view: ModuleDraftView; assumptions: string[]; warnings: string[] };
type Decisions = { learning: Decision; completion: Decision; arena: Decision; follow: Decision };

function initialDecision(hasCurrent: boolean): Decision {
  return hasCurrent ? "keep" : "use";
}

export function ModuleDraftCopilot({
  ready,
  contextFingerprint,
  current,
  onGenerate,
  onApply,
  t,
}: {
  ready: boolean;
  contextFingerprint: string;
  current: ModuleDraftCurrent;
  onGenerate: () => Promise<ModuleDraftGenerateOutcome>;
  onApply: (patch: AppliedModuleDraft) => void;
  t: ModuleDraftCopilotCopy;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorCode, setErrorCode] = useState<"rate_limit" | "context_mismatch" | "generic">("generic");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [decisions, setDecisions] = useState<Decisions>({ learning: "use", completion: "use", arena: "use", follow: "use" });
  const [editedCompletion, setEditedCompletion] = useState("");
  const [requestedFor, setRequestedFor] = useState("");
  const inFlight = useRef(false);

  const hasLearning = current.learningNeeds.length > 0;
  const hasCompletion = current.completionPrompt.trim().length > 0;
  const hasArena = current.arenaRecommended !== undefined;
  const hasFollow = current.followUpDays !== undefined;

  const stale = (phase === "review") && contextFingerprint !== requestedFor;

  const generate = useCallback(async () => {
    if (inFlight.current || !ready) return;
    inFlight.current = true;
    setRequestedFor(contextFingerprint);
    setPhase("loading");
    try {
      const outcome = await onGenerate();
      if (outcome.ok) {
        setDraft({ view: outcome.draft, assumptions: outcome.assumptions, warnings: outcome.warnings });
        setDecisions({
          learning: initialDecision(hasLearning),
          completion: initialDecision(hasCompletion),
          arena: initialDecision(hasArena),
          follow: initialDecision(hasFollow),
        });
        setEditedCompletion(outcome.draft.completion_question);
        setPhase("review");
      } else {
        setErrorCode(outcome.code);
        setPhase("error");
      }
    } catch {
      setErrorCode("generic");
      setPhase("error");
    } finally {
      inFlight.current = false;
    }
  }, [onGenerate, ready, contextFingerprint, hasLearning, hasCompletion, hasArena, hasFollow]);

  const apply = useCallback(() => {
    if (stale || !draft) return;
    const patch: AppliedModuleDraft = {};
    if (decisions.learning === "use") patch.learningNeeds = draft.view.learning_approach;
    if (decisions.completion === "use") {
      const v = editedCompletion.trim();
      if (v.length > 0) patch.completionPrompt = v;
    }
    if (decisions.arena === "use") patch.arenaRecommended = draft.view.arena_recommended;
    if (decisions.follow === "use") patch.followUpDays = draft.view.follow_up_days;
    onApply(patch);
    setPhase("applied");
  }, [stale, draft, decisions, editedCompletion, onApply]);

  const dismiss = useCallback(() => {
    setPhase("idle");
    setDraft(null);
  }, []);

  // -- IDLE: optional assistive entry (only when the canonical minimum context is valid)
  if (phase === "idle") {
    if (!ready) return null;
    return (
      <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-[#C9A66B]/25 bg-[#C9A66B]/[0.06] p-4" data-testid="module-draft-copilot">
        <p className="text-[0.95rem] font-medium leading-6 text-white/85">{t.entryPrompt}</p>
        <button
          type="button"
          onClick={generate}
          data-testid="module-draft-trigger"
          className="w-full rounded-xl border border-[#C9A66B]/55 bg-[#C9A66B]/15 px-5 py-3.5 text-[0.95rem] font-semibold text-[#C9A66B] transition-colors hover:bg-[#C9A66B]/25"
        >
          {t.trigger}
        </button>
        <p className="text-xs leading-5 text-white/50">{t.entrySupport}</p>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="mt-3 flex items-center gap-3 text-sm text-white/55" data-testid="module-draft-loading">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#C9A66B]/40 border-t-[#C9A66B]" aria-hidden />
        {t.loading}
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.03] px-4 py-4" data-testid="module-draft-error">
        <p className="text-sm leading-6 text-amber-200/90">{errorCode === "rate_limit" ? t.rateLimited : t.failTitle}</p>
        <div className="flex items-center gap-3">
          <button type="button" onClick={generate} data-testid="module-draft-retry" className="rounded-lg bg-[#C9A66B] px-4 py-2 text-sm font-semibold text-[#0B1F3A]">
            {t.tryAgain}
          </button>
          <button type="button" onClick={dismiss} className="text-sm text-white/55">
            {t.continueManually}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "applied") {
    return (
      <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[#C9A66B]/25 bg-[#C9A66B]/[0.06] px-4 py-3.5" data-testid="module-draft-applied">
        <p className="text-sm leading-6 text-white/80">{t.applied}</p>
        <button type="button" onClick={dismiss} className="shrink-0 text-sm font-medium text-[#C9A66B]">
          {t.appliedDismiss}
        </button>
      </div>
    );
  }

  // -- REVIEW ------------------------------------------------------------------------
  if (!draft) return null;
  const v = draft.view;
  const needLabels = (ns: LearningNeed[]) => ns.map((n) => t.needs[n]).join(", ");
  const followLabel = (d: FollowUpDays) => (d === 7 ? t.follow.d7 : d === 30 ? t.follow.d30 : t.follow.d0);

  const setDecision = (key: keyof Decisions, d: Decision) => setDecisions((prev) => ({ ...prev, [key]: d }));

  return (
    <div className="mt-3 flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4" data-testid="module-draft-review">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#C9A66B]/90">{t.reviewHeading}</span>
        <p className="text-sm leading-6 text-white/55">{t.reviewLead}</p>
      </div>

      <DecisionSection
        testid="learning"
        name={t.secLearning}
        hasCurrent={hasLearning}
        currentDisplay={hasLearning ? needLabels(current.learningNeeds) : null}
        suggestedDisplay={needLabels(v.learning_approach)}
        why={v.learning_approach_rationale}
        decision={decisions.learning}
        onDecision={(d) => setDecision("learning", d)}
        t={t}
      />

      <DecisionSection
        testid="completion"
        name={t.secCompletion}
        hasCurrent={hasCompletion}
        currentDisplay={hasCompletion ? current.completionPrompt : null}
        suggestedDisplay={v.completion_question}
        decision={decisions.completion}
        onDecision={(d) => setDecision("completion", d)}
        t={t}
      >
        {decisions.completion === "use" ? (
          <textarea
            value={editedCompletion}
            onChange={(e) => setEditedCompletion(e.target.value)}
            rows={3}
            data-testid="module-draft-completion-edit"
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-3 text-sm leading-6 text-white outline-none focus:border-[#C9A66B]/60"
          />
        ) : null}
      </DecisionSection>

      <DecisionSection
        testid="arena"
        name={t.secArena}
        hasCurrent={hasArena}
        currentDisplay={hasArena ? (current.arenaRecommended ? t.arenaYes : t.arenaNo) : null}
        suggestedDisplay={v.arena_recommended ? t.arenaYes : t.arenaNo}
        why={v.arena_rationale}
        decision={decisions.arena}
        onDecision={(d) => setDecision("arena", d)}
        t={t}
      />

      <DecisionSection
        testid="follow"
        name={t.secFollow}
        hasCurrent={hasFollow}
        currentDisplay={hasFollow ? followLabel(current.followUpDays as FollowUpDays) : null}
        suggestedDisplay={followLabel(v.follow_up_days)}
        why={v.follow_up_guidance}
        decision={decisions.follow}
        onDecision={(d) => setDecision("follow", d)}
        t={t}
      />

      {/* Advisory-only — never applied to a canonical field. */}
      <div className="flex flex-col gap-1.5 rounded-xl border border-white/8 bg-white/[0.01] px-4 py-3" data-testid="module-draft-material">
        <span className="text-xs uppercase tracking-[0.12em] text-white/40">{t.secMaterial}</span>
        <span className="text-xs text-white/40">
          {t.materialTypesLabel}: {v.material_guidance.recommended_types.map((m) => t.materialTypes[m as keyof typeof t.materialTypes] ?? m).join(", ")}
        </span>
        <span className="text-sm leading-6 text-white/70">{v.material_guidance.suggestion}</span>
      </div>

      {draft.assumptions.length > 0 ? (
        <AdvisoryList label={t.assumptionsLabel} items={draft.assumptions} testid="module-draft-assumptions" />
      ) : null}
      {draft.warnings.length > 0 ? (
        <AdvisoryList label={t.warningsLabel} items={draft.warnings} testid="module-draft-warnings" amber />
      ) : null}

      {stale ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.03] px-3 py-2.5" data-testid="module-draft-stale">
          <p className="text-xs leading-5 text-amber-200/85">
            {t.staleTitle} {t.staleHint}
          </p>
          <button type="button" onClick={generate} className="shrink-0 text-xs font-medium text-[#C9A66B]">
            {t.regenerate}
          </button>
        </div>
      ) : null}

      <p className="text-xs leading-5 text-white/45">{t.applyNote}</p>
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={dismiss} className="text-sm text-white/60">
          {t.continueManually}
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={stale}
          data-testid="module-draft-apply"
          className="rounded-xl bg-[#C9A66B] px-5 py-2.5 text-sm font-semibold text-[#0B1F3A] disabled:opacity-50"
        >
          {t.apply}
        </button>
      </div>
    </div>
  );
}

function DecisionSection({
  testid,
  name,
  hasCurrent,
  currentDisplay,
  suggestedDisplay,
  why,
  decision,
  onDecision,
  t,
  children,
}: {
  testid: string;
  name: string;
  hasCurrent: boolean;
  currentDisplay: string | null;
  suggestedDisplay: string;
  why?: string;
  decision: Decision;
  onDecision: (d: Decision) => void;
  t: ModuleDraftCopilotCopy;
  children?: React.ReactNode;
}) {
  const opt = (d: Decision, label: string) => (
    <button
      type="button"
      onClick={() => onDecision(d)}
      aria-pressed={decision === d}
      data-testid={`module-draft-${testid}-${d}`}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
        decision === d ? "border-[#C9A66B]/70 bg-[#C9A66B]/15 text-[#C9A66B]" : "border-white/12 bg-white/[0.02] text-white/60 hover:bg-white/[0.05]"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/8 bg-white/[0.01] px-4 py-3" data-testid={`module-draft-section-${testid}`}>
      <span className="text-xs uppercase tracking-[0.12em] text-white/40">{name}</span>
      {hasCurrent && currentDisplay ? (
        <div className="flex flex-col gap-0.5">
          <span className="text-[0.65rem] uppercase tracking-wide text-white/35">{t.currentLabel}</span>
          <span className="text-sm leading-6 text-white/70">{currentDisplay}</span>
        </div>
      ) : null}
      <div className="flex flex-col gap-0.5">
        <span className="text-[0.65rem] uppercase tracking-wide text-[#C9A66B]/70">{t.suggestedLabel}</span>
        <span className="text-sm leading-6 text-white/85">{suggestedDisplay}</span>
      </div>
      {children}
      {why ? <span className="text-xs leading-5 text-white/45">{t.whyLabel}: {why}</span> : null}
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        {hasCurrent ? opt("keep", t.keep) : null}
        {opt("use", t.use)}
        {opt("skip", t.skip)}
      </div>
    </div>
  );
}

function AdvisoryList({ label, items, testid, amber }: { label: string; items: string[]; testid: string; amber?: boolean }) {
  return (
    <div className="flex flex-col gap-1" data-testid={testid}>
      <span className={`text-xs uppercase tracking-[0.12em] ${amber ? "text-amber-300/70" : "text-white/40"}`}>{label}</span>
      <ul className="flex flex-col gap-1">
        {items.map((it, i) => (
          <li key={i} className={`text-xs leading-5 ${amber ? "text-amber-200/80" : "text-white/55"}`}>
            • {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
