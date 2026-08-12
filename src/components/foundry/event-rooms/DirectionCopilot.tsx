"use client";

import { useCallback, useRef, useState } from "react";
import type { DirectionCopilotCopy } from "./moduleBuilderCopy";

/**
 * Direction Copilot (Slice 2.4A) — a bounded, assistive child of the Guided Module
 * Builder's problem step. The model PROPOSES three directions; the Host REVIEWS,
 * EDITS, and CONFIRMS; only then does the parent apply values to the canonical draft.
 *
 * This component never fetches, never mutates the draft, and never parses raw provider
 * JSON — the parent supplies `onGenerate` (which returns already-validated, client-safe
 * suggestions) and `onApply` (which writes through the Builder's canonical save path).
 * Generation and selection are inert with respect to the draft; nothing is written until
 * the Host taps Apply. Failure never blocks the manual Builder.
 */

export type DirectionSuggestionView = {
  id: string;
  title: string;
  capability_candidate: string;
  rationale: string;
  observable_behavior: string;
  success_evidence_hint: string;
  important_assumption: string | null;
};

export type DirectionGenerateOutcome =
  | { ok: true; suggestions: DirectionSuggestionView[] }
  | { ok: false; code: "rate_limit" | "problem_mismatch" | "generic" };

export type AppliedDirection = {
  capabilityCandidate: string;
  recurringMoment: "at each handoff point",
  observableBehavior: string;
  successEvidence: string;
};

type Phase = "idle" | "loading" | "results" | "review" | "applied" | "error";

type ReviewDraft = {
  title: string;
  capability: string;
  behavior: string;
  evidence: string;
  rationale: string;
  assumption: string | null;
};

const BLANK_REVIEW: ReviewDraft = {
  title: "",
  capability: "",
  behavior: "",
  evidence: "",
  rationale: "",
  assumption: null,
};

export function DirectionCopilot({
  problemStatement,
  ready,
  onGenerate,
  onApply,
  t,
}: {
  problemStatement: string;
  ready: boolean;
  onGenerate: () => Promise<DirectionGenerateOutcome>;
  onApply: (values: AppliedDirection) => void;
  t: DirectionCopilotCopy;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [suggestions, setSuggestions] = useState<DirectionSuggestionView[]>([]);
  const [errorCode, setErrorCode] = useState<"rate_limit" | "problem_mismatch" | "generic">("generic");
  const [review, setReview] = useState<ReviewDraft>(BLANK_REVIEW);
  const [requestedFor, setRequestedFor] = useState<string>("");

  const inFlight = useRef(false);

  // Stale guard — results/review belong to the problem as it was at request time. If
  // the Host has since edited the problem, applying old results is not allowed.
  const stale =
    (phase === "results" || phase === "review") && problemStatement.trim() !== requestedFor.trim();

  const generate = useCallback(async () => {
    if (inFlight.current || !ready) return;
    inFlight.current = true;
    setRequestedFor(problemStatement);
    setPhase("loading");
    try {
      const outcome = await onGenerate();
      if (outcome.ok) {
        setSuggestions(outcome.suggestions);
        setPhase("results");
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
  }, [onGenerate, problemStatement, ready]);

  const useDirection = useCallback((s: DirectionSuggestionView) => {
    setReview({
      title: s.title,
      capability: s.capability_candidate,
      behavior: s.observable_behavior,
      evidence: s.success_evidence_hint,
      rationale: s.rationale,
      assumption: s.important_assumption,
    });
    setPhase("review");
  }, []);

  const describeAnother = useCallback(() => {
    setReview(BLANK_REVIEW);
    setPhase("review");
  }, []);

  const apply = useCallback(() => {
    if (stale) return;
    onApply({
      capabilityCandidate: review.capability.trim(),
      recurringMoment: "at each handoff point",
      observableBehavior: review.behavior.trim(),
      successEvidence: review.evidence.trim(),
    });
    setPhase("applied");
  }, [onApply, review, stale]);

  const dismiss = useCallback(() => {
    setPhase("idle");
    setSuggestions([]);
  }, []);

  // -- IDLE: a clearly separated, discoverable-but-optional assistive block. Appears
  // only when the problem meets minimum validity; secondary to the primary Next action;
  // never auto-opens or auto-generates. (Slice 2.4A.2 discoverability polish.)
  if (phase === "idle") {
    if (!ready) return null;
    return (
      <div
        className="mt-3 flex flex-col gap-3 rounded-2xl border border-[#C9A66B]/25 bg-[#C9A66B]/[0.06] p-4"
        data-testid="direction-copilot"
      >
        <p className="text-[0.95rem] font-medium leading-6 text-white/85">{t.entryPrompt}</p>
        <button
          type="button"
          onClick={generate}
          data-testid="direction-copilot-trigger"
          className="w-full rounded-xl border border-[#C9A66B]/55 bg-[#C9A66B]/15 px-5 py-3.5 text-[0.95rem] font-semibold text-[#C9A66B] transition-colors hover:bg-[#C9A66B]/25"
        >
          {t.trigger}
        </button>
        <p className="text-xs leading-5 text-white/50">{t.entrySupport}</p>
      </div>
    );
  }

  // -- LOADING: restrained, no fake reasoning/typing, no auto-advance ----------------
  if (phase === "loading") {
    return (
      <div className="flex items-center gap-3 pt-2 text-sm text-white/55" data-testid="direction-copilot-loading">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#C9A66B]/40 border-t-[#C9A66B]" aria-hidden />
        {t.loading}
      </div>
    );
  }

  // -- ERROR: preserve everything; retry or continue manually ------------------------
  if (phase === "error") {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.03] px-4 py-4" data-testid="direction-copilot-error">
        <p className="text-sm leading-6 text-amber-200/90">
          {errorCode === "rate_limit" ? t.rateLimited : t.failTitle}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={generate}
            data-testid="direction-copilot-retry"
            className="rounded-lg bg-[#C9A66B] px-4 py-2 text-sm font-semibold text-[#0B1F3A]"
          >
            {t.tryAgain}
          </button>
          <button type="button" onClick={dismiss} className="text-sm text-white/55">
            {t.continueWithout}
          </button>
        </div>
      </div>
    );
  }

  // -- APPLIED: restrained confirmation; values are in the draft and still editable --
  if (phase === "applied") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#C9A66B]/25 bg-[#C9A66B]/[0.06] px-4 py-3.5" data-testid="direction-copilot-applied">
        <p className="text-sm leading-6 text-white/80">{t.applied}</p>
        <button type="button" onClick={dismiss} className="shrink-0 text-sm font-medium text-[#C9A66B]">
          {t.appliedDismiss}
        </button>
      </div>
    );
  }

  // -- REVIEW: editable; nothing canonical changes until Apply -----------------------
  if (phase === "review") {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4" data-testid="direction-copilot-review">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-[#C9A66B]/90">{t.reviewHeading}</span>
          <p className="text-sm leading-6 text-white/55">{t.reviewLead}</p>
        </div>

        <ReviewField label={t.labelTitle} value={review.title} onChange={(v) => setReview((r) => ({ ...r, title: v }))} testid="review-title" />
        <ReviewField label={t.labelCapability} value={review.capability} onChange={(v) => setReview((r) => ({ ...r, capability: v }))} testid="review-capability" applied appliedLabel={t.reviewApplies} />
        <ReviewField label={t.labelBehavior} value={review.behavior} onChange={(v) => setReview((r) => ({ ...r, behavior: v }))} multiline testid="review-behavior" applied />
        <ReviewField label={t.labelEvidence} value={review.evidence} onChange={(v) => setReview((r) => ({ ...r, evidence: v }))} multiline testid="review-evidence" applied />

        {review.rationale ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.12em] text-white/40">{t.labelWhy}</span>
            <p className="text-sm leading-6 text-white/60">{review.rationale}</p>
          </div>
        ) : null}
        {review.assumption ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.12em] text-white/40">{t.labelAssumption}</span>
            <p className="text-sm leading-6 text-white/60">{review.assumption}</p>
          </div>
        ) : null}

        {stale ? (
          <p className="text-xs leading-5 text-amber-300/80" data-testid="direction-copilot-stale">
            {t.staleTitle} {t.staleHint}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3 pt-1">
          <button type="button" onClick={() => setPhase("results")} className="text-sm text-white/60">
            {t.backToDirections}
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={stale || review.capability.trim().length === 0}
            data-testid="direction-copilot-apply"
            className="rounded-xl bg-[#C9A66B] px-5 py-2.5 text-sm font-semibold text-[#0B1F3A] disabled:opacity-50"
          >
            {t.apply}
          </button>
        </div>
      </div>
    );
  }

  // -- RESULTS: exactly three cards, no auto-selection -------------------------------
  return (
    <div className="flex flex-col gap-3" data-testid="direction-copilot-results">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#C9A66B]/90">{t.resultsHeading}</span>
      {stale ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.03] px-3 py-2.5" data-testid="direction-copilot-stale">
          <p className="text-xs leading-5 text-amber-200/85">
            {t.staleTitle} {t.staleHint}
          </p>
          <button type="button" onClick={generate} className="shrink-0 text-xs font-medium text-[#C9A66B]">
            {t.generateAgain}
          </button>
        </div>
      ) : null}
      {suggestions.map((s) => (
        <DirectionCard key={s.id} s={s} onUse={() => useDirection(s)} t={t} />
      ))}
      <button
        type="button"
        onClick={describeAnother}
        data-testid="direction-copilot-describe-another"
        className="mt-1 rounded-xl border border-white/12 bg-white/[0.02] px-4 py-3 text-sm text-white/70 hover:bg-white/[0.05]"
      >
        {t.describeAnother}
      </button>
    </div>
  );
}

/**
 * A direction card. Always-visible essentials (title, Capability, Draft behavior, Use)
 * keep three cards scannable side-by-side; the secondary context (why / evidence /
 * assumption) is collapsed by default behind a details toggle so first-scan comparison
 * on mobile is faster. No information is removed and the data contract is unchanged;
 * "Use this direction" works from both the collapsed and expanded states.
 */
function DirectionCard({ s, onUse, t }: { s: DirectionSuggestionView; onUse: () => void; t: DirectionCopilotCopy }) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = `direction-details-${s.id}`;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4" data-testid="direction-card">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[0.98rem] font-semibold leading-6 text-white/90">{s.title}</h3>
        <span className="shrink-0 rounded-full border border-[#C9A66B]/30 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-[#C9A66B]/80">
          {t.draftBadge}
        </span>
      </div>
      <CardRow label={t.labelCapability} value={s.capability_candidate} />
      <CardRow label={t.labelBehavior} value={s.observable_behavior} />

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-controls={detailsId}
        data-testid="direction-card-details-toggle"
        className="self-start text-xs font-medium text-[#C9A66B]/85"
      >
        {expanded ? t.hideDetails : t.viewDetails}
      </button>
      {expanded ? (
        <div id={detailsId} data-testid="direction-card-details" className="flex flex-col gap-3">
          <CardRow label={t.labelWhy} value={s.rationale} muted />
          <CardRow label={t.labelEvidence} value={s.success_evidence_hint} muted />
          {s.important_assumption ? <CardRow label={t.labelAssumption} value={s.important_assumption} muted /> : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onUse}
        data-testid="direction-card-use"
        className="mt-1 self-start rounded-xl bg-[#C9A66B] px-4 py-2 text-sm font-semibold text-[#0B1F3A]"
      >
        {t.useThis}
      </button>
    </div>
  );
}

function CardRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.65rem] uppercase tracking-[0.12em] text-white/40">{label}</span>
      <span className={`text-sm leading-6 ${muted ? "text-white/60" : "text-white/85"}`}>{value}</span>
    </div>
  );
}

function ReviewField({
  label,
  value,
  onChange,
  multiline,
  testid,
  applied,
  appliedLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  testid: string;
  applied?: boolean;
  appliedLabel?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-white/45">
        {label}
        {applied ? <span className="rounded bg-[#C9A66B]/15 px-1.5 py-0.5 text-[0.6rem] tracking-normal text-[#C9A66B]/90">✓</span> : null}
      </span>
      {appliedLabel ? <span className="text-[0.7rem] leading-4 text-white/35">{appliedLabel}</span> : null}
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          data-testid={testid}
          className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-3 text-sm leading-6 text-white outline-none focus:border-[#C9A66B]/60"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          data-testid={testid}
          className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#C9A66B]/60"
        />
      )}
    </label>
  );
}
