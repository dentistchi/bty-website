"use client";

import { useEffect, useState } from "react";
import { blurActiveThen } from "@/components/app-shell/viewportFocus";

/**
 * Host Action Review — in-shell detail (Slice 3.1B-3N; decisions added Phase 5C).
 * Fetches /api/arena/action-reviews/[id] (which re-runs the authority resolver per request)
 * and renders ONLY safe canonical Action facts — NO private Reflection, NO email.
 *
 * Decision controls (Approve / Request revision) appear ONLY when the fresh detail snapshot
 * says this user may review a reviewable action (a non-null detail = the server allowed it).
 * No optimistic terminal state: the UI never declares success before the server returns.
 * A successful decision calls onBack(), which unmounts this view and remounts the Today brief
 * (fresh fetch) — so the queue reflects server truth and the resolved card cannot linger.
 */

type Detail = {
  actionContractId: string;
  learnerLabel: string;
  actionSummary: string;
  submittedAt: string | null;
  originalDeadline: string | null;
  verificationMode: "hybrid" | "link";
  statusLabel: string;
  who: string | null;
  what: string | null;
  how: string | null;
  stepWhen: string | null;
  sourceLabel: string | null;
};

const REVISION_NOTE_MAX = 500;

const COPY = {
  en: {
    back: "Back",
    notFound: "This review is no longer available.",
    intro: "Review the submitted action plan.",
    who: "Who",
    what: "What",
    how: "How",
    when: "When",
    originalDeadline: "Original deadline",
    submittedOn: "Submitted",
    remoteReview: "Remote review allowed",
    approve: "Approve",
    requestRevision: "Request revision",
    approveConfirmTitle: "Approve this action plan?",
    approveConfirmBody: "This confirms the submitted action plan for this review.",
    confirm: "Confirm",
    cancel: "Cancel",
    revisionPrompt: "What needs to be revised?",
    revisionValidation: "Add a brief revision request.",
    submit: "Submit",
    working: "Working…",
    staleResolved: "This review has already been resolved.",
    networkError: "Something went wrong. Please try again.",
  },
  ko: {
    back: "뒤로",
    notFound: "이 검토는 더 이상 이용할 수 없습니다.",
    intro: "제출된 행동 계획을 검토합니다.",
    who: "누가",
    what: "무엇을",
    how: "어떻게",
    when: "언제",
    originalDeadline: "원래 기한",
    submittedOn: "제출",
    remoteReview: "원격 검토 가능",
    approve: "승인",
    requestRevision: "수정 요청",
    approveConfirmTitle: "이 행동 계획을 승인하시겠습니까?",
    approveConfirmBody: "이 검토를 위해 제출된 행동 계획을 승인합니다.",
    confirm: "확인",
    cancel: "취소",
    revisionPrompt: "무엇을 수정해야 합니까?",
    revisionValidation: "수정이 필요한 내용을 간단히 입력해 주세요.",
    submit: "제출",
    working: "처리 중…",
    staleResolved: "이 검토는 이미 처리되었습니다.",
    networkError: "문제가 발생했습니다. 다시 시도해 주세요.",
  },
} as const;

function fmtDate(iso: string | null, loc: "en" | "ko"): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString(loc === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "short", day: "numeric" });
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value || !value.trim()) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-white/40">{label}</span>
      <span className="text-sm leading-6 text-white/80">{value}</span>
    </div>
  );
}

type DecisionMode = "none" | "approve-confirm" | "revision-sheet";

export default function HostActionReviewDetail({
  locale,
  actionContractId,
  onBack,
}: {
  locale: string;
  actionContractId: string;
  onBack: () => void;
}) {
  const loc: "en" | "ko" = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [mode, setMode] = useState<DecisionMode>("none");
  const [note, setNote] = useState("");
  const [noteInvalid, setNoteInvalid] = useState(false);
  const [pending, setPending] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/arena/action-reviews/${encodeURIComponent(actionContractId)}?locale=${loc}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (res.ok) {
          const d = (await res.json()) as { item?: Detail | null };
          if (!cancelled) setDetail(d?.item ?? null);
        }
      } catch {
        /* fail-soft — treated as not available */
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [actionContractId, loc]);

  const submitted = fmtDate(detail?.submittedAt ?? null, loc);
  const deadline = fmtDate(detail?.originalDeadline ?? null, loc);

  async function postDecision(payload: { decision: "approve" | "request_revision"; revisionNote?: string }) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/arena/action-reviews/${encodeURIComponent(actionContractId)}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        // Server truth reconciled: release focus (dismiss keyboard, reset iOS zoom) BEFORE leaving
        // to the queue, which refetches on remount.
        blurActiveThen(onBack);
        return;
      }
      if (res.status === 409) {
        // Already resolved by another verifier — calm stale copy, no retry.
        setStale(true);
        setMode("none");
        setPending(false);
        return;
      }
      if (res.status === 422) {
        // Server-side note validation (belt with the client check).
        setNoteInvalid(true);
        setPending(false);
        return;
      }
      // 404 (unauthorized/not-found) / 500 / other — re-enable, preserve typed note.
      setError(t.networkError);
      setPending(false);
    } catch {
      setError(t.networkError);
      setPending(false);
    }
  }

  function onApproveConfirm() {
    if (pending) return;
    void postDecision({ decision: "approve" });
  }

  function onRevisionSubmit() {
    if (pending) return;
    const trimmed = note.trim();
    if (trimmed.length < 1 || trimmed.length > REVISION_NOTE_MAX) {
      setNoteInvalid(true);
      return;
    }
    setNoteInvalid(false);
    void postDecision({ decision: "request_revision", revisionNote: trimmed });
  }

  const controlsDisabled = pending;

  return (
    <section data-testid="host-action-review-detail" className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-4">
      <button
        type="button"
        data-testid="host-action-review-back"
        onClick={onBack}
        className="self-start text-xs text-white/55 hover:text-white/85"
      >
        ← {t.back}
      </button>

      {!loaded ? (
        <div data-testid="host-action-review-loading" className="h-16 animate-pulse rounded-lg bg-white/[0.03]" />
      ) : !detail ? (
        <p data-testid="host-action-review-notfound" className="text-sm text-white/60">
          {t.notFound}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 flex-1 truncate text-base font-medium text-white/90">{detail.learnerLabel}</span>
            <span className="shrink-0 rounded-md border border-sky-400/25 px-2 py-0.5 text-[0.66rem] text-sky-200/75">
              {detail.statusLabel}
            </span>
          </div>
          <p className="text-xs text-white/50">{t.intro}</p>
          {detail.sourceLabel ? (
            <span data-testid="host-action-review-source" className="self-start rounded-md border border-emerald-400/25 bg-emerald-400/[0.06] px-2 py-0.5 text-[0.66rem] text-emerald-200/80">
              {detail.sourceLabel}
            </span>
          ) : null}
          {detail.actionSummary ? (
            <p className="text-sm leading-6 text-white/80">{detail.actionSummary}</p>
          ) : null}
          <div className="flex flex-col gap-2.5">
            <Field label={t.who} value={detail.who} />
            <Field label={t.what} value={detail.what} />
            <Field label={t.how} value={detail.how} />
            <Field label={t.when} value={detail.stepWhen} />
          </div>
          <div className="flex flex-col gap-0.5 pt-1">
            <span className="text-[0.7rem] text-white/40">{t.remoteReview}</span>
            {submitted ? <span className="text-[0.7rem] text-white/35">{t.submittedOn} · {submitted}</span> : null}
            {deadline ? <span className="text-[0.7rem] text-white/35">{t.originalDeadline} · {deadline}</span> : null}
          </div>

          {/* ---- Decision section (Phase 5C) ---- */}
          {stale ? (
            <p data-testid="host-action-review-stale" className="mt-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/60">
              {t.staleResolved}
            </p>
          ) : (
            <div className="mt-2 flex flex-col gap-2 border-t border-white/[0.08] pt-3">
              {error ? (
                <p data-testid="host-action-review-error" className="text-xs text-rose-300/80">
                  {error}
                </p>
              ) : null}

              {mode === "none" ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="host-action-review-approve"
                    disabled={controlsDisabled}
                    onClick={() => { setError(null); setMode("approve-confirm"); }}
                    className="flex-1 touch-manipulation rounded-lg bg-emerald-500/85 px-3 py-2 text-sm font-medium text-emerald-50 hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {t.approve}
                  </button>
                  <button
                    type="button"
                    data-testid="host-action-review-request-revision"
                    disabled={controlsDisabled}
                    onClick={() => { setError(null); setNoteInvalid(false); setMode("revision-sheet"); }}
                    className="flex-1 touch-manipulation rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white/80 hover:bg-white/[0.06] disabled:opacity-50"
                  >
                    {t.requestRevision}
                  </button>
                </div>
              ) : null}

              {mode === "approve-confirm" ? (
                <div data-testid="host-action-review-approve-confirm" className="flex flex-col gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.04] px-3 py-3">
                  <span className="text-sm font-medium text-white/90">{t.approveConfirmTitle}</span>
                  <span className="text-xs text-white/55">{t.approveConfirmBody}</span>
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      type="button"
                      data-testid="host-action-review-approve-confirm-btn"
                      disabled={controlsDisabled}
                      onClick={onApproveConfirm}
                      className="flex-1 touch-manipulation rounded-lg bg-emerald-500/85 px-3 py-2 text-sm font-medium text-emerald-50 hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {pending ? t.working : t.confirm}
                    </button>
                    <button
                      type="button"
                      data-testid="host-action-review-cancel"
                      disabled={controlsDisabled}
                      onClick={() => setMode("none")}
                      className="touch-manipulation rounded-lg border border-white/15 px-3 py-2 text-sm text-white/70 hover:bg-white/[0.06] disabled:opacity-50"
                    >
                      {t.cancel}
                    </button>
                  </div>
                </div>
              ) : null}

              {mode === "revision-sheet" ? (
                <div data-testid="host-action-review-revision-sheet" className="flex flex-col gap-2 rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-3">
                  <label className="text-sm font-medium text-white/85" htmlFor="host-action-review-revision-note">
                    {t.revisionPrompt}
                  </label>
                  <textarea
                    id="host-action-review-revision-note"
                    data-testid="host-action-review-revision-note"
                    value={note}
                    maxLength={REVISION_NOTE_MAX}
                    disabled={controlsDisabled}
                    onChange={(e) => { setNote(e.target.value); if (noteInvalid) setNoteInvalid(false); }}
                    rows={3}
                    // text-base (16px) prevents iOS form-control auto-zoom on focus (Slice 3.1B-3N-5C.4).
                    className="w-full resize-none rounded-md border border-white/[0.12] bg-black/20 px-2.5 py-2 text-base text-white/85 outline-none focus:border-white/25 disabled:opacity-50"
                  />
                  {noteInvalid ? (
                    <span data-testid="host-action-review-note-validation" className="text-xs text-amber-300/80">
                      {t.revisionValidation}
                    </span>
                  ) : null}
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      type="button"
                      data-testid="host-action-review-revision-submit"
                      disabled={controlsDisabled}
                      onClick={onRevisionSubmit}
                      className="flex-1 touch-manipulation rounded-lg bg-white/90 px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
                    >
                      {pending ? t.working : t.submit}
                    </button>
                    <button
                      type="button"
                      data-testid="host-action-review-cancel"
                      disabled={controlsDisabled}
                      onClick={() => setMode("none")}
                      className="touch-manipulation rounded-lg border border-white/15 px-3 py-2 text-sm text-white/70 hover:bg-white/[0.06] disabled:opacity-50"
                    >
                      {t.cancel}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
