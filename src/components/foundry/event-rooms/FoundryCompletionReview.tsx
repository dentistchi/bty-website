"use client";

import { useEffect, useState } from "react";

/**
 * Foundry completion review — the authenticated, read-only surface a learner sees when they
 * tap "Review learning" on a completed assignment (Slice 3.1B-3E.1). It NEVER opens the
 * anonymous Room: it fetches the caller's own stored completion content and renders it
 * in-place inside BtyDailyAppShell, with a "Back to Foundry" control. Displays only canonical
 * stored content — nothing is synthesized; fields never collected show a calm empty line.
 */

type Locale = "en" | "ko";

type Reflection = {
  whatEmerged: string | null;
  whereYouStretched: string | null;
  livingSentence: string | null;
  nextInvitation: string | null;
};
type Review = {
  assignmentId: string;
  title: string;
  contentType: "youtube" | "document";
  completedAt: string | null;
  completionState: "pass" | "review" | "incomplete" | null;
  responseText: string | null;
  reflection: Reflection | null;
};

const COPY: Record<Locale, {
  back: string;
  completed: string;
  completedOn: (d: string) => string;
  yourReflection: string;
  noReflection: string;
  livingReflection: string;
  secEmerged: string;
  secStretched: string;
  secSentence: string;
  secNext: string;
  loadError: string;
  applyCta: string;
}> = {
  en: {
    back: "← Back to Foundry",
    completed: "Completed",
    completedOn: (d) => `Completed ${d}`,
    yourReflection: "Your reflection",
    noReflection: "No reflection was recorded for this learning.",
    livingReflection: "A living reflection",
    secEmerged: "What emerged",
    secStretched: "Where you stretched",
    secSentence: "Your living sentence",
    secNext: "Your next invitation",
    loadError: "This review couldn’t be opened.",
    applyCta: "Apply this in real life",
  },
  ko: {
    back: "← 파운드리로 돌아가기",
    completed: "완료",
    completedOn: (d) => `완료일 ${d}`,
    yourReflection: "나의 성찰",
    noReflection: "이 학습에 기록된 성찰이 없습니다.",
    livingReflection: "살아있는 성찰",
    secEmerged: "떠오른 것",
    secStretched: "확장된 지점",
    secSentence: "나의 한 문장",
    secNext: "다음 초대",
    loadError: "이 리뷰를 열 수 없습니다.",
    applyCta: "현실에서 적용하기",
  },
};

function fmtDate(iso: string | null, locale: Locale): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function FoundryCompletionReview({
  assignmentId,
  locale,
  onBack,
}: {
  assignmentId: string;
  locale: string;
  onBack: () => void;
}) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const [review, setReview] = useState<Review | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/bty/foundry/assignment-review/${encodeURIComponent(assignmentId)}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) setState("error");
          return;
        }
        const data = (await res.json()) as { ok?: boolean; review?: Review };
        if (cancelled) return;
        if (data?.ok && data.review) {
          setReview(data.review);
          setState("ready");
        } else {
          setState("error");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  const backButton = (
    <button
      type="button"
      onClick={onBack}
      data-testid="review-back"
      className="self-start text-sm text-white/60 hover:text-white/90"
    >
      {t.back}
    </button>
  );

  if (state === "loading") {
    return (
      <div className="btyFadeIn flex flex-col gap-6">
        {backButton}
        <div aria-hidden className="min-h-[30vh]" />
      </div>
    );
  }

  if (state === "error" || !review) {
    return (
      <div className="btyFadeIn flex flex-col gap-6" data-testid="review-error">
        {backButton}
        <p className="text-sm leading-6 text-white/50">{t.loadError}</p>
      </div>
    );
  }

  const date = fmtDate(review.completedAt, loc);
  const r = review.reflection;
  const section = (label: string, value: string | null) =>
    value ? (
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-[0.12em] text-white/40">{label}</span>
        <p className="text-[0.95rem] leading-7 text-white/85">{value}</p>
      </div>
    ) : null;

  return (
    <section className="btyFadeIn flex flex-col gap-6" data-testid="foundry-completion-review">
      {backButton}

      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-white/95">{review.title}</h1>
        <span className="inline-flex w-fit items-center rounded-full border border-emerald-400/30 bg-emerald-400/[0.08] px-3 py-1 text-xs font-medium text-emerald-200/85">
          {date ? t.completedOn(date) : t.completed}
        </span>
      </div>

      {/* Slice 3.1B-3N-5C.3: the single canonical Field Action entry — a present, owned, completed
          review is the only precondition. Opens the Today-owned FieldActionForm in the same shell
          (assignment-anchored producer; no /bty-arena, no nested shell). */}
      <a
        href={`/${loc}/app?tab=today&fieldActionAssignment=${encodeURIComponent(review.assignmentId)}`}
        data-testid="completion-review-apply-cta"
        className="inline-flex w-fit items-center rounded-lg border border-emerald-400/30 bg-emerald-400/[0.08] px-4 py-2 text-sm font-medium text-emerald-100/90 hover:bg-emerald-400/[0.14]"
      >
        {t.applyCta} →
      </a>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-[#C9A66B]/90">
          {t.yourReflection}
        </span>
        {review.responseText ? (
          <p className="whitespace-pre-wrap text-[0.98rem] leading-7 text-white/90" data-testid="review-response">
            {review.responseText}
          </p>
        ) : (
          <p className="text-sm leading-6 text-white/45">{t.noReflection}</p>
        )}
      </div>

      {r ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-5">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">
            {t.livingReflection}
          </span>
          {section(t.secEmerged, r.whatEmerged)}
          {section(t.secStretched, r.whereYouStretched)}
          {section(t.secSentence, r.livingSentence)}
          {section(t.secNext, r.nextInvitation)}
        </div>
      ) : null}
    </section>
  );
}
