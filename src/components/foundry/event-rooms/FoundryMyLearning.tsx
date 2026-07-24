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
  back: string;
  loading: string;
  applyCta: string;
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
    back: "← Required learning",
    loading: "Loading…",
    applyCta: "Apply this in real life",
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
    back: "← 필수 학습",
    loading: "불러오는 중…",
    applyCta: "현실에서 적용하기",
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

export default function FoundryMyLearning({ locale, onBack }: { locale: string; onBack: () => void }) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const [items, setItems] = useState<MyLearningItem[] | null>(null);

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

  useEffect(() => {
    void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
    };
  }, [load]);

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
          {t.back}
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
              {/* Slice 3.1B-3N-5C.3: optional "Apply this in real life" → the Today-owned Field Action
                  producer for this completed module. Practice completion does NOT gate this CTA. */}
              {it.eventId ? (
                <a
                  href={`/${loc}/app?tab=today&fieldActionEvent=${encodeURIComponent(it.eventId)}`}
                  data-testid="my-learning-apply-cta"
                  className="mt-1 self-start rounded-lg border border-emerald-400/25 bg-emerald-400/[0.06] px-3 py-1.5 text-xs font-medium text-emerald-200/85 hover:bg-emerald-400/[0.1]"
                >
                  {t.applyCta} →
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
