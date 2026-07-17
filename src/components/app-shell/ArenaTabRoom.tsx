"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Native app-shell ARENA tab content (BtyDailyAppShell).
 *
 * Replaces the old static LockedRoom "being prepared" placeholder — which never
 * resolved and hid the user's published practices. This room loads the user's
 * Foundry-published Arena practices INDEPENDENTLY: there is no canonical Arena
 * bootstrap gating it here, and a bounded-timeout fetch guarantees the tab never
 * stays indefinitely at a generic preparing state.
 *
 * Resolves to exactly one visible state: loading (bounded) → practices list /
 * calm empty ("being prepared") / explicit error + Retry. A subtle entry to the
 * full canonical Arena remains available and never blocks the practice list.
 */

type AvailablePractice = {
  id: string;
  practice_title: string;
  source_training_title: string;
  completed: boolean;
};

const COPY = {
  en: {
    eyebrow: "ARENA",
    loading: "Preparing your decision training…",
    from: "From",
    start: "Start practice",
    done: "Done",
    error: "We couldn't load your Practices.",
    retry: "Retry",
    enterArena: "Enter Arena training",
  },
  ko: {
    eyebrow: "아레나",
    loading: "결정 훈련 공간을 준비하고 있습니다…",
    from: "원본",
    start: "연습 시작",
    done: "완료",
    error: "연습을 불러오지 못했습니다.",
    retry: "다시 시도",
    enterArena: "아레나 훈련 시작",
  },
};

const FETCH_TIMEOUT_MS = 10_000;

export function ArenaTabRoom({
  locale,
  lockedTag,
  lockedBody,
}: {
  locale: string;
  /** Calm "being prepared" copy reused for the genuinely-empty state (never jarring). */
  lockedTag: string;
  lockedBody: string;
}) {
  const loc = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const router = useRouter();

  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [practices, setPractices] = useState<AvailablePractice[]>([]);

  const load = useCallback(async () => {
    setStatus("loading");
    // Bounded: a hung request resolves to an explicit error, never an endless loader.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch("/api/arena/practice", {
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const data = (await res.json()) as { practices?: AvailablePractice[] };
      setPractices(Array.isArray(data.practices) ? data.practices : []);
      setStatus("ok");
    } catch {
      setStatus("error");
    } finally {
      clearTimeout(timer);
    }
  }, []);

  const startedRef = useRef(false);
  useEffect(() => {
    let alive = true;
    void load();
    startedRef.current = true;
    // Refetch when the app returns to the foreground (e.g. after publishing in the
    // Foundry tab and coming back) — the shell also remounts this on tab re-select.
    const onActive = () => {
      if (alive && (typeof document === "undefined" || document.visibilityState === "visible")) void load();
    };
    window.addEventListener("focus", onActive);
    document.addEventListener("visibilitychange", onActive);
    return () => {
      alive = false;
      window.removeEventListener("focus", onActive);
      document.removeEventListener("visibilitychange", onActive);
    };
  }, [load]);

  const enterArena = (
    <button
      type="button"
      onClick={() => router.push(`/${loc}/bty-arena`)}
      className="mt-6 text-xs font-medium uppercase tracking-[0.14em] text-white/40 transition-colors hover:text-white/70"
    >
      {t.enterArena} →
    </button>
  );

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-2 text-center">
        <span className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">{t.eyebrow}</span>
        <div className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-[#C9A66B]" />
        <p className="max-w-[18rem] text-[0.95rem] leading-6 text-white/60">{t.loading}</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-2 text-center">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">{t.eyebrow}</span>
        <p className="max-w-[18rem] text-[0.95rem] leading-6 text-white/70">{t.error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border border-white/20 px-6 py-2.5 text-sm font-semibold text-white/80 hover:text-white"
        >
          {t.retry}
        </button>
        {enterArena}
      </div>
    );
  }

  if (practices.length === 0) {
    // Genuinely empty → the calm "being prepared" tone (not an error, not a blank).
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-2 text-center">
        <span className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">{lockedTag}</span>
        <p className="max-w-[18rem] text-[0.95rem] leading-6 text-white/60">{lockedBody}</p>
        {enterArena}
      </div>
    );
  }

  return (
    <div className="btyFadeIn mx-auto flex w-full max-w-md flex-col gap-3 px-1 pt-2">
      <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">{t.eyebrow}</span>
      {practices.map((p) => (
        <div key={p.id} className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-[0.98rem] font-semibold text-white/90">{p.practice_title}</p>
            {p.completed ? (
              <span className="shrink-0 text-[0.6rem] uppercase tracking-[0.12em] text-[#C9A66B]/80">{t.done}</span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-white/45">
            {t.from}: {p.source_training_title}
          </p>
          <button
            type="button"
            onClick={() => router.push(`/${loc}/bty-arena/practice/${p.id}`)}
            className="mt-3 w-full rounded-xl bg-[#C9A66B] px-5 py-2.5 text-sm font-semibold text-[#0B1F3A]"
          >
            {t.start}
          </button>
        </div>
      ))}
      <div className="self-center">{enterArena}</div>
    </div>
  );
}
