"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Foundry → My Learning (Slice 3.1B-3I re-placement).
 *
 * Foundry answers "what did I learn and understand?" — so the PRIMARY artifact is the learner's
 * OWN Shared Understanding answer, NOT the Private Reflection (that now lives canonically in
 * Center). Reuses the owner-scoped GET /api/bty/foundry/history (linked_user_id = caller). Each
 * row links to the exact Center reflection via ?tab=center&view=reflections&entry=<entryId>.
 * Explicit DTO allow-list — never the raw row; never Host review notes.
 */

type Locale = "en" | "ko";

/** Explicit client DTO allow-list — the private responseText is deliberately NOT read here. */
type MyLearningItem = {
  entryId: string;
  eventId: string;
  eventTitle: string;
  contentType: "youtube" | "document";
  completedAt: string;
  sharedUnderstanding: string | null;
};

/**
 * Reviewed Action Plan card (Slice 3.1B-3N-5D.1). An approved Field Action = a reviewer
 * reviewed & ACCEPTED the learner's submitted PLAN. Deliberately carries NO reviewer identity,
 * NO audit internals, NO private reflection — and the copy never implies Applied/Observed.
 */
type ReviewedPlanCard = {
  contractId: string;
  who: string | null;
  what: string | null;
  how: string | null;
  stepWhen: string | null;
  moduleTitle: string | null;
  moduleVersion: number | null;
  reviewedAt: string | null;
};

const COPY: Record<Locale, {
  title: string;
  subtitle: string;
  sharedLabel: string;
  noShared: string;
  viewInCenter: string;
  completedOn: string;
  video: string;
  document: string;
  empty: string;
  emptyHint: string;
  backDefault: string;
  loading: string;
  reviewedTitle: string;
  reviewedStatus: string;
  labelWho: string;
  labelWhat: string;
  labelHow: string;
  labelWhen: string;
  reviewedOn: string;
  moduleVersion: (v: number) => string;
}> = {
  en: {
    title: "My Learning",
    subtitle: "What you understood, in your own words.",
    sharedLabel: "What I understood",
    noShared: "No shared understanding was recorded for this training.",
    viewInCenter: "View my private reflection in Center",
    completedOn: "Completed",
    video: "Video",
    document: "PDF",
    empty: "No completed trainings yet.",
    emptyHint: "When you finish a training, it appears here with what you understood.",
    // Default parent = the Learn/Required-learning origin. An explicit `backLabel` overrides this
    // per origin (B3A.2D-R1) — e.g. the Me-tab origin passes "Me" so a personal-history surface
    // returns to Me, never leaking "Required learning" as its parent.
    backDefault: "Required learning",
    loading: "Loading…",
    reviewedTitle: "Reviewed action plans",
    reviewedStatus: "Action plan reviewed & accepted",
    labelWho: "Who",
    labelWhat: "What",
    labelHow: "How",
    labelWhen: "When",
    reviewedOn: "Reviewed",
    moduleVersion: (v) => `Module v${v}`,
  },
  ko: {
    title: "내 학습",
    subtitle: "내가 이해한 내용을 나의 말로.",
    sharedLabel: "내가 이해한 것",
    noShared: "이 교육에는 공유 이해 답변이 없습니다.",
    viewInCenter: "Center에서 나의 비공개 성찰 보기",
    completedOn: "완료",
    video: "영상",
    document: "PDF",
    empty: "아직 완료한 교육이 없습니다.",
    emptyHint: "교육을 마치면 여기에서 이해한 내용을 볼 수 있습니다.",
    backDefault: "필수 학습",
    loading: "불러오는 중…",
    reviewedTitle: "검토·승인된 행동 계획",
    reviewedStatus: "행동 계획이 검토되고 승인되었습니다",
    labelWho: "누구",
    labelWhat: "무엇",
    labelHow: "어떻게",
    labelWhen: "언제",
    reviewedOn: "검토됨",
    moduleVersion: (v) => `모듈 v${v}`,
  },
};

function formatDate(iso: string, loc: Locale): string {
  try {
    return new Date(iso).toLocaleDateString(loc === "ko" ? "ko-KR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export default function FoundryMyLearning({
  locale,
  onBack,
  backLabel,
}: {
  locale: string;
  onBack: () => void;
  /** Origin-aware parent name (B3A.2D-R1). Me-origin passes "Me"; Learn-origin omits it → the
   *  measured "Required learning" default. Explicit per call — never inferred from tab/history. */
  backLabel?: string;
}) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const backText = `← ${backLabel ?? t.backDefault}`;
  const [items, setItems] = useState<MyLearningItem[] | null>(null);
  const [reviewedPlans, setReviewedPlans] = useState<ReviewedPlanCard[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/bty/foundry/history", { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        setItems([]);
        return;
      }
      const data = (await res.json()) as {
        history?: Array<{ entryId?: string; eventId?: string; eventTitle?: string; contentType?: string; completedAt?: string; sharedUnderstanding?: string | null }>;
      };
      // Allow-list mapping — responseText (Private Reflection) is intentionally NOT read here.
      const mapped: MyLearningItem[] = (data?.history ?? []).map((h) => ({
        entryId: String(h.entryId ?? ""),
        eventId: String(h.eventId ?? ""),
        eventTitle: String(h.eventTitle ?? "Foundry training"),
        contentType: h.contentType === "document" ? "document" : "youtube",
        completedAt: String(h.completedAt ?? ""),
        sharedUnderstanding: h.sharedUnderstanding ? String(h.sharedUnderstanding) : null,
      }));
      setItems(mapped);
    } catch {
      setItems([]);
    }
  }, []);

  // Reviewed Action Plans (Slice 3.1B-3N-5D.1) — a DIFFERENT evidence stage from completion,
  // fetched independently so its failure never affects the completion list. Deduped by contractId.
  const loadReviewedPlans = useCallback(async () => {
    try {
      const res = await fetch("/api/bty/action-contract/reviewed-plans", { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        setReviewedPlans([]);
        return;
      }
      const data = (await res.json()) as { items?: ReviewedPlanCard[] };
      const seen = new Set<string>();
      const mapped: ReviewedPlanCard[] = (Array.isArray(data?.items) ? data.items : [])
        .map((p) => ({
          contractId: String(p.contractId ?? ""),
          who: p.who ?? null,
          what: p.what ?? null,
          how: p.how ?? null,
          stepWhen: p.stepWhen ?? null,
          moduleTitle: p.moduleTitle ?? null,
          moduleVersion: typeof p.moduleVersion === "number" ? p.moduleVersion : null,
          reviewedAt: p.reviewedAt ?? null,
        }))
        .filter((p) => p.contractId && !seen.has(p.contractId) && seen.add(p.contractId));
      setReviewedPlans(mapped);
    } catch {
      setReviewedPlans([]);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadReviewedPlans();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void load();
        void loadReviewedPlans();
      }
    };
    const onFocus = () => {
      void load();
      void loadReviewedPlans();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [load, loadReviewedPlans]);

  return (
    <section data-testid="foundry-my-learning" className="flex flex-col gap-4 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold text-white/90">{t.title}</h2>
          <p className="text-xs text-white/50">{t.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          data-testid="my-learning-back"
          className="shrink-0 rounded-lg border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/70"
        >
          {backText}
        </button>
      </div>

      {items === null ? (
        <p className="text-sm text-white/40" role="status">{t.loading}</p>
      ) : items.length === 0 ? (
        <div data-testid="my-learning-empty" className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-6 text-center">
          <p className="text-sm text-white/70">{t.empty}</p>
          <p className="mt-1 text-xs text-white/45">{t.emptyHint}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((it) => (
            <li
              key={it.entryId}
              data-testid="my-learning-item"
              className="flex flex-col gap-2 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[0.95rem] font-medium text-white/90">{it.eventTitle}</span>
                <span className="shrink-0 rounded-md bg-white/[0.06] px-2 py-0.5 text-[0.7rem] uppercase tracking-wide text-white/55">
                  {it.contentType === "document" ? t.document : t.video}
                </span>
              </div>
              <span className="text-xs text-emerald-300/70">
                {t.completedOn} · {formatDate(it.completedAt, loc)}
              </span>
              {/* PRIMARY artifact: the learner's own Shared Understanding (Host-reviewable). */}
              <div className="mt-1 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
                <span className="text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#C9A66B]/80">
                  {t.sharedLabel}
                </span>
                {it.sharedUnderstanding ? (
                  <p data-testid="my-learning-shared" className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-white/85">
                    {it.sharedUnderstanding}
                  </p>
                ) : (
                  <p className="mt-1.5 text-sm leading-6 text-white/40">{t.noShared}</p>
                )}
              </div>
              {/* Private Reflection is NOT shown here — it lives in Center. Deep-link to the exact entry. */}
              <a
                href={`/${loc}/app?tab=center&view=reflections&entry=${encodeURIComponent(it.entryId)}`}
                data-testid="view-reflection-in-center"
                className="self-start text-xs font-medium text-[#C9A66B]/80 underline underline-offset-4"
              >
                {t.viewInCenter} →
              </a>
            </li>
          ))}
        </ul>
      )}

      {reviewedPlans.length > 0 ? (
        <div data-testid="reviewed-plans" className="mt-1 flex flex-col gap-3">
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#C9A66B]/70">
            {t.reviewedTitle}
          </span>
          <ul className="flex flex-col gap-3">
            {reviewedPlans.map((p) => (
              <li
                key={p.contractId}
                data-testid="reviewed-plan-item"
                className="flex flex-col gap-2 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.03] px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    data-testid="reviewed-plan-status"
                    className="rounded-md border border-emerald-400/25 px-2 py-0.5 text-[0.72rem] font-medium text-emerald-200/85"
                  >
                    {t.reviewedStatus}
                  </span>
                  {p.reviewedAt ? (
                    <span className="text-[0.72rem] text-white/45">
                      {t.reviewedOn} · {formatDate(p.reviewedAt, loc)}
                    </span>
                  ) : null}
                </div>
                {p.moduleTitle ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 break-words text-[0.95rem] font-medium text-white/90">{p.moduleTitle}</span>
                    {p.moduleVersion != null ? (
                      <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[0.66rem] text-white/50">
                        {t.moduleVersion(p.moduleVersion)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <dl className="mt-0.5 flex flex-col gap-1.5">
                  {([
                    [t.labelWho, p.who],
                    [t.labelWhat, p.what],
                    [t.labelHow, p.how],
                    [t.labelWhen, p.stepWhen],
                  ] as const)
                    .filter(([, v]) => (v ?? "").trim() !== "")
                    .map(([label, v]) => (
                      <div key={label} className="flex flex-col gap-0.5">
                        <dt className="text-[0.66rem] font-medium uppercase tracking-[0.12em] text-white/40">{label}</dt>
                        <dd className="whitespace-pre-wrap break-words text-base leading-6 text-white/85">{v}</dd>
                      </div>
                    ))}
                </dl>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
