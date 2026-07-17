"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Arena Practice discovery — the ONE shared surface, rendered by ArenaLayoutShell
 * ABOVE the page content, so it appears on the Arena tab regardless of
 * ArenaEntryClient's state-specific early returns (mode-select, NEXT_SCENARIO_READY,
 * re-exposure, blocked-contract, …) and regardless of App-Router segment caching.
 *
 * Gated to the Arena LOBBY path only (the bottom-nav Arena tab lands on
 * `/{locale}/bty-arena`), so it never intrudes on the immersive run/play surface.
 *
 * Every state is VISIBLE (loading / list / empty / error+retry) — an error is never
 * rendered as a legitimate empty list, and nothing is silently dropped. Refetches
 * on mount, route change, focus, and visibility so a just-published practice
 * appears without a cold launch.
 */

type AvailablePractice = {
  id: string;
  practice_title: string;
  source_training_title: string;
  completed: boolean;
};

const COPY = {
  en: {
    heading: "Practice",
    from: "From",
    start: "Start practice",
    done: "Done",
    empty: "No Arena practices yet.",
    error: "Couldn't load practices — Retry",
  },
  ko: {
    heading: "연습",
    from: "원본",
    start: "연습 시작",
    done: "완료",
    empty: "아직 Arena 연습이 없습니다.",
    error: "연습 목록을 불러오지 못했습니다 — 다시 시도",
  },
};

function isArenaLobbyPath(pathname: string): boolean {
  // Only the bare Arena lobby (e.g. /en/bty-arena), not /bty-arena/play|run|practice|quick|…
  return /\/bty-arena\/?$/.test(pathname);
}

export function ArenaPracticeDiscovery({ locale }: { locale?: string }) {
  const loc = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const pathname = usePathname() ?? "";
  const onLobby = isArenaLobbyPath(pathname);

  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [practices, setPractices] = useState<AvailablePractice[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/arena/practice", { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        // 401/403/5xx → visible retry (a signed-in eligible user should get 200).
        setStatus("error");
        return;
      }
      const data = (await res.json()) as { practices?: AvailablePractice[] };
      setPractices(Array.isArray(data.practices) ? data.practices : []);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!onLobby) return;
    let alive = true;
    void load();
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
    // re-run on route change into the lobby as well as on mount.
  }, [onLobby, pathname, load]);

  if (!onLobby) return null;

  return (
    <section className="mx-auto mb-4 w-full max-w-md">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--arena-text)]/50">
        {t.heading}
      </p>

      {status === "loading" ? (
        <div aria-hidden className="h-16 rounded-2xl border border-[var(--arena-text)]/10 bg-[var(--arena-text)]/[0.02]" />
      ) : status === "error" ? (
        <button
          type="button"
          onClick={() => {
            setStatus("loading");
            void load();
          }}
          className="w-full rounded-2xl border border-[var(--arena-text)]/20 px-5 py-3 text-left text-sm text-[var(--arena-text)]/70"
        >
          {t.error}
        </button>
      ) : practices.length === 0 ? (
        <p className="rounded-2xl border border-[var(--arena-text)]/10 px-5 py-3 text-sm text-[var(--arena-text)]/45">
          {t.empty}
        </p>
      ) : (
        <div className="space-y-2">
          {practices.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-[var(--arena-text)]/15 bg-white/40 px-5 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate font-semibold text-[var(--arena-text)]">{p.practice_title}</p>
                {p.completed ? (
                  <span className="shrink-0 text-[0.6rem] uppercase tracking-[0.12em] text-[var(--arena-accent)]/80">
                    {t.done}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 truncate text-xs text-[var(--arena-text)]/55">
                {t.from}: {p.source_training_title}
              </p>
              <Link
                href={`/${loc}/bty-arena/practice/${p.id}`}
                className="mt-3 inline-flex min-h-[40px] items-center justify-center rounded-xl px-5 text-sm font-semibold text-white"
                style={{ background: "var(--arena-accent, #5b8fa8)" }}
              >
                {t.start}
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
