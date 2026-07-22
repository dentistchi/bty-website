"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * My Learning — the learner-owned private surface (Slice 3.1B-3H).
 *
 * Reuses the EXISTING owner-scoped read GET /api/bty/foundry/history →
 * listUserFoundryHistory (linked_user_id = authenticated caller). The Private Reflection
 * (`responseText`) is the learner's OWN and is NEVER Host-visible (Host projections exclude it,
 * server-side). This surface is read-only in V1 (no edit/delete) and shows ONLY an explicit DTO
 * allow-list — never the raw history object, never the AI reflection body, Host review note,
 * scores, analytics, or other learners' content.
 */

type Locale = "en" | "ko";

/** Explicit client DTO allow-list — do NOT spread the raw history row into the view. */
type MyLearningItem = {
  eventId: string;
  eventTitle: string;
  contentType: "youtube" | "document";
  completedAt: string;
  responseText: string;
};

const COPY: Record<Locale, {
  title: string;
  subtitle: string;
  privateLabel: string;
  privateNote: string;
  completedOn: string;
  video: string;
  document: string;
  empty: string;
  emptyHint: string;
  back: string;
  loading: string;
}> = {
  en: {
    title: "My Learning",
    subtitle: "Your completed trainings and private reflections.",
    privateLabel: "My private reflection",
    privateNote: "Only you can see this reflection.",
    completedOn: "Completed",
    video: "Video",
    document: "PDF",
    empty: "No completed trainings yet.",
    emptyHint: "When you finish a training, it appears here with your private reflection.",
    back: "← Required learning",
    loading: "Loading…",
  },
  ko: {
    title: "내 학습",
    subtitle: "완료한 교육과 비공개 성찰입니다.",
    privateLabel: "나의 비공개 성찰",
    privateNote: "이 성찰은 본인만 볼 수 있습니다.",
    completedOn: "완료",
    video: "영상",
    document: "PDF",
    empty: "아직 완료한 교육이 없습니다.",
    emptyHint: "교육을 마치면 여기에서 비공개 성찰과 함께 볼 수 있습니다.",
    back: "← 필수 학습",
    loading: "불러오는 중…",
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
        ok?: boolean;
        history?: Array<{ eventId?: string; eventTitle?: string; contentType?: string; completedAt?: string; responseText?: string }>;
      };
      // Explicit allow-list mapping — never spread the raw row (Host note / AI reflection / scores excluded).
      const mapped: MyLearningItem[] = (data?.history ?? []).map((h) => ({
        eventId: String(h.eventId ?? ""),
        eventTitle: String(h.eventTitle ?? "Foundry training"),
        contentType: h.contentType === "document" ? "document" : "youtube",
        completedAt: String(h.completedAt ?? ""),
        responseText: String(h.responseText ?? ""),
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
              key={it.eventId}
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
              <div className="mt-1 rounded-xl border border-white/8 bg-black/20 px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#C9A66B]/80">
                    {t.privateLabel}
                  </span>
                  <span aria-hidden="true" className="text-[0.7rem] text-white/35">·</span>
                  <span className="text-[0.7rem] text-white/45">{t.privateNote}</span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-white/85">{it.responseText}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
