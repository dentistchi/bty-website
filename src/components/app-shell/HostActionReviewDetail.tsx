"use client";

import { useEffect, useState } from "react";

/**
 * Host Action Review — read-only in-shell detail (Slice 3.1B-3N, Phase 5B).
 * Fetches /api/arena/action-reviews/[id] (which re-runs the authority resolver per request).
 * Renders ONLY safe canonical Action facts — NO private Reflection, NO email, NO decision buttons.
 * Back returns to the Today queue via onBack.
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
};

const COPY = {
  en: {
    back: "Back",
    notFound: "This review is no longer available.",
    intro: "Review the submitted Action and available evidence.",
    who: "Who",
    what: "What",
    how: "How",
    when: "When",
    originalDeadline: "Original deadline",
    submittedOn: "Submitted",
    remoteReview: "Remote review allowed",
  },
  ko: {
    back: "뒤로",
    notFound: "이 검토는 더 이상 이용할 수 없습니다.",
    intro: "제출된 행동과 가능한 근거를 검토하세요.",
    who: "누가",
    what: "무엇을",
    how: "어떻게",
    when: "언제",
    originalDeadline: "원래 기한",
    submittedOn: "제출",
    remoteReview: "원격 검토 가능",
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

  return (
    <section data-testid="host-action-review-detail" className="flex flex-col gap-4 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4">
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
        </div>
      )}
    </section>
  );
}
