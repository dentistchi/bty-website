"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ArenaScenarioDraft, SelectedPath } from "@/domain/foundry/arena-draft/types";
import type { PathInput } from "@/domain/foundry/arena-draft/path";
import { ArenaPracticePlayer } from "@/components/bty-arena/practice/ArenaPracticePlayer";

/**
 * Client driver for a published practice: load the immutable snapshot, record a
 * (zero-XP) start, play through the real learner surface, record completion once.
 * All records live in foundry_arena_practice_runs — the canonical Arena run/XP/
 * pattern/leadership machinery is never touched.
 */

type Loaded = {
  id: string;
  practice_title: string;
  source_training_title: string;
  scenario: ArenaScenarioDraft;
};

const COPY = {
  en: { loadError: "This practice isn't available.", back: "Back to Arena", loading: "Loading…" },
  ko: { loadError: "이 연습을 사용할 수 없습니다.", back: "Arena로 돌아가기", loading: "불러오는 중…" },
};

export function ArenaPracticePlayClient({ locale, practiceId }: { locale: string; practiceId: string }) {
  const loc = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const router = useRouter();
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [practice, setPractice] = useState<Loaded | null>(null);
  const [initialPath, setInitialPath] = useState<SelectedPath | null>(null);
  const runIdRef = useRef<string | null>(null);
  const startedRef = useRef(false);

  const backToArena = useCallback(() => router.push(`/${loc}/bty-arena`), [router, loc]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/arena/practice/${encodeURIComponent(practiceId)}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (cancelled) return;
        if (!res.ok) return setState("error");
        const data = (await res.json()) as { practice?: Loaded };
        if (!data.practice?.scenario) return setState("error");
        setPractice(data.practice);
        // Record a start (idempotent / duplicate-tap safe) and read the stored path
        // BEFORE the player mounts, so a reload restores the same branch. Best-effort:
        // a failed start never blocks playing the (already-loaded) practice.
        if (!startedRef.current) {
          startedRef.current = true;
          try {
            const s = await fetch(`/api/arena/practice/${encodeURIComponent(practiceId)}/start`, {
              method: "POST",
              credentials: "include",
              cache: "no-store",
            });
            if (s.ok) {
              const sd = (await s.json()) as { run_id?: string; selected_path?: SelectedPath | null };
              runIdRef.current = sd.run_id ?? null;
              if (!cancelled && sd.selected_path) setInitialPath(sd.selected_path); // restore branch
            }
          } catch {
            /* start is best-effort */
          }
        }
        if (!cancelled) setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [practiceId]);

  // Persist each cumulative decision-path write (Slice 3.2I). Server validates every id
  // against the published snapshot; best-effort from the client's side.
  const onPath = useCallback(
    (path: PathInput) => {
      const runId = runIdRef.current;
      if (!runId) return;
      void fetch(`/api/arena/practice/${encodeURIComponent(practiceId)}/path`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, ...path }),
      }).catch(() => {
        /* path write is best-effort; completion still finalizes the run */
      });
    },
    [practiceId],
  );

  const onComplete = useCallback(async () => {
    const runId = runIdRef.current;
    if (!runId) return;
    try {
      await fetch(`/api/arena/practice/${encodeURIComponent(practiceId)}/complete`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });
    } catch {
      /* completion record is best-effort; the learner still sees the end screen */
    }
  }, [practiceId]);

  if (state === "loading") {
    return <div aria-hidden className="min-h-[50vh]" />;
  }
  if (state === "error" || !practice) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-base text-bty-navy/80">{t.loadError}</p>
        <button type="button" onClick={backToArena} className="rounded-2xl bg-bty-navy px-6 py-3 text-sm font-semibold text-white">
          {t.back}
        </button>
      </div>
    );
  }

  return (
    <div className="py-4">
      <ArenaPracticePlayer
        scenario={practice.scenario}
        locale={loc}
        mode="play"
        sourceTrainingTitle={practice.source_training_title}
        initialPath={initialPath}
        onExit={backToArena}
        onComplete={onComplete}
        onPath={onPath}
      />
    </div>
  );
}
