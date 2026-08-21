"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArenaPracticePlayer } from "@/components/bty-arena/practice/ArenaPracticePlayer";
import {
  completePractice,
  fetchPracticeList,
  startPractice,
  type AvailablePractice,
  type PlayablePractice,
} from "./arenaRoomActions";
import type { PracticeSurface } from "./practiceSurface";

/**
 * Native in-shell Arena Practice room (Slice 3.0C-1).
 *
 * The ENTIRE journey — list → start → play (Primary → Tradeoff → Action Decision)
 * → complete → list — is LOCAL React state inside BtyDailyAppShell's arena tab.
 * There is NO router, no Link, no window.location: this component must never
 * navigate. BtyDailyAppShell keeps owning the selected bottom tab; ArenaRoom owns
 * only its own view state; ArenaPracticePlayer (reused unchanged) owns the phase
 * reducer. Renders as normal flow content inside the shell's <main overflow-y-auto>
 * (no fixed overlay, no nested scroll, no portal). Zero XP, no canonical Arena run.
 */

type ArenaRoomView =
  | { kind: "list" }
  | { kind: "starting"; practiceId: string; error?: string }
  | { kind: "playing"; practice: PlayablePractice; runId: string };

type CompleteStatus = "none" | "saving" | "saved" | "error";

const COPY = {
  en: {
    eyebrow: "PRACTICE",
    loading: "Preparing your decision training…",
    from: "From",
    start: "Start practice",
    again: "Practice again",
    done: "Done",
    error: "We couldn't load your Practices.",
    retry: "Retry",
    back: "Back to list",
    starting: "Starting your practice…",
    startError: "We couldn't start this practice.",
    completeSaving: "Saving your completion…",
    completeError: "We couldn't save your completion.",
  },
  ko: {
    eyebrow: "연습",
    loading: "결정 훈련 공간을 준비하고 있습니다…",
    from: "원본",
    start: "연습 시작",
    again: "다시 연습",
    done: "완료",
    error: "연습을 불러오지 못했습니다.",
    retry: "다시 시도",
    back: "목록으로",
    starting: "연습을 시작하는 중…",
    startError: "이 연습을 시작하지 못했습니다.",
    completeSaving: "완료 상태를 저장하는 중…",
    completeError: "완료 상태를 저장하지 못했습니다.",
  },
};

const LIST_TIMEOUT_MS = 10_000;

export function ArenaRoom({
  locale,
  lockedTag,
  lockedBody,
  onSurfaceChange,
}: {
  locale: string;
  /** Calm "being prepared" copy reused for the genuinely-empty state (never blank/jarring). */
  lockedTag: string;
  lockedBody: string;
  /**
   * R2 — report WHICH surface is showing. This room owns its view state internally, so a parent
   * that renders anything alongside it (the Host authoring entry) has no other way to know whether
   * the learner runtime has taken over. It still never navigates and never reads role.
   */
  onSurfaceChange?: (surface: PracticeSurface) => void;
}) {
  const loc = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];

  const [listStatus, setListStatus] = useState<"loading" | "ok" | "error">("loading");
  const [practices, setPractices] = useState<AvailablePractice[]>([]);
  const [view, setView] = useState<ArenaRoomView>({ kind: "list" });
  const [completeStatus, setCompleteStatus] = useState<CompleteStatus>("none");

  const surface: PracticeSurface =
    view.kind === "starting"
      ? "runtime_starting"
      : view.kind === "playing"
        ? "runtime_playing"
        : listStatus === "loading"
          ? "index_loading"
          : listStatus === "error"
            ? "index_error"
            : practices.length === 0
              ? "index_empty"
              : "index_list";

  // Reported from an effect, not during render: a parent must never be asked to update state while
  // this component is rendering, and the value must survive a cold prop update.
  useEffect(() => {
    onSurfaceChange?.(surface);
  }, [surface, onSurfaceChange]);

  // ---- practice list (bounded fetch; visible loading/list/empty/error) ----
  const loadList = useCallback(async () => {
    setListStatus("loading");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LIST_TIMEOUT_MS);
    const r = await fetchPracticeList(fetch, controller.signal);
    clearTimeout(timer);
    if (r.ok) {
      setPractices(r.practices);
      setListStatus("ok");
    } else {
      setListStatus("error");
    }
  }, []);

  useEffect(() => {
    void loadList();
    const onActive = () => {
      if (typeof document === "undefined" || document.visibilityState === "visible") void loadList();
    };
    window.addEventListener("focus", onActive);
    document.addEventListener("visibilitychange", onActive);
    return () => {
      window.removeEventListener("focus", onActive);
      document.removeEventListener("visibilitychange", onActive);
    };
  }, [loadList]);

  // ---- start (contract: snapshot -> validate -> POST start -> runId; then play) ----
  const startingRef = useRef(false);
  const handleStart = useCallback(async (practiceId: string) => {
    if (startingRef.current) return;
    startingRef.current = true;
    setView({ kind: "starting", practiceId });
    try {
      const r = await startPractice(fetch, practiceId);
      if (r.ok) {
        setCompleteStatus("none");
        setView({ kind: "playing", practice: r.practice, runId: r.runId });
      } else {
        setView({ kind: "starting", practiceId, error: r.reason });
      }
    } finally {
      startingRef.current = false;
    }
  }, []);

  const toList = useCallback(() => {
    setCompleteStatus("none");
    setView({ kind: "list" });
    void loadList();
  }, [loadList]);

  // ---- completion (persist, honest; preserve local state + retry on failure) ----
  const saveCompletion = useCallback(
    async (practiceId: string, runId: string): Promise<boolean> => {
      setCompleteStatus("saving");
      const r = await completePractice(fetch, practiceId, runId);
      setCompleteStatus(r.ok ? "saved" : "error");
      return r.ok;
    },
    [],
  );

  // Player reached the end → persist once (idempotent server-side).
  const handleComplete = useCallback(() => {
    if (view.kind !== "playing") return;
    void saveCompletion(view.practice.id, view.runId);
  }, [view, saveCompletion]);

  // Player "Done" → ensure completion is saved before returning (final retry); if it
  // still fails, stay so the user can Retry — never a false persisted completion.
  const handleExit = useCallback(async () => {
    if (view.kind === "playing" && completeStatus !== "saved") {
      const ok = await saveCompletion(view.practice.id, view.runId);
      if (!ok) return; // stay on the player; the error strip offers Retry / Back to list
    }
    toList();
  }, [view, completeStatus, saveCompletion, toList]);

  // ------------------------------------------------------------------ render ----
  if (view.kind === "starting") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-2 text-center">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">{t.eyebrow}</span>
        {view.error ? (
          <>
            <p className="max-w-[18rem] text-[0.95rem] leading-6 text-white/70">{t.startError}</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void handleStart(view.practiceId)}
                className="rounded-xl bg-[#C9A66B] px-6 py-2.5 text-sm font-semibold text-[#0B1F3A]"
              >
                {t.retry}
              </button>
              <button type="button" onClick={toList} className="text-sm text-white/50 hover:text-white/80">
                {t.back}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-[#C9A66B]" />
            <p className="text-sm text-white/60">{t.starting}</p>
          </>
        )}
      </div>
    );
  }

  if (view.kind === "playing") {
    return (
      <div className="flex flex-col">
        {completeStatus === "error" ? (
          <div className="mb-3 flex flex-col gap-2 rounded-xl border border-red-400/30 bg-red-400/[0.06] px-4 py-3 text-center">
            <span className="text-sm text-red-200/90">{t.completeError}</span>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => void saveCompletion(view.practice.id, view.runId)}
                className="rounded-lg bg-[#C9A66B] px-4 py-1.5 text-xs font-semibold text-[#0B1F3A]"
              >
                {t.retry}
              </button>
              <button type="button" onClick={toList} className="text-xs text-white/50 hover:text-white/80">
                {t.back}
              </button>
            </div>
          </div>
        ) : completeStatus === "saving" ? (
          <p className="mb-3 text-center text-xs text-white/40">{t.completeSaving}</p>
        ) : null}
        {/*
          THE PLAYER BRINGS ITS OWN PAGE (Slice R4-R5A).

          `ArenaPracticePlayer` is a LIGHT-SURFACE component: it paints its prose with
          `text-bty-navy` (= `--bty-brand-navy` = #0B1F3A) and its choice cards with `bg-white`,
          because it was written for — and still serves — the cream `/bty-arena` page. This shell's
          root is `bg-[#0B1F3A]`. Mounting it bare put the SAME colour on the SAME colour: the
          scenario title, the section headings, the escalation narrative, the decision question, the
          completion screen and the source-training line all rendered at 1.00:1, while the white
          choice cards stayed perfectly readable. The learner saw answers with no question.

          CORRECTED AT CLOSURE (R4-R5A-R1). This comment originally cited `ArenaPracticeFlow`'s
          `bg-bty-soft/40` wrapper as a working precedent this mount was copying. IT IS NOT ONE.
          That utility emits NO CSS RULE: `soft` and `navy` are declared in tailwind.config.ts as
          bare `var(...)` values with no `<alpha-value>` placeholder, so Tailwind v3 cannot compute
          an alpha and drops the class. The shipped stylesheet carries `.bg-bty-soft` and nothing
          for `/40` — meaning the Host draft preview paints no background either. The class was
          written with the right intention and has never taken effect.

          So the opacity here is not a refinement of that precedent; it is the only form of it that
          renders at all. The same defect is why the ORIGINAL contrast table in this comment was
          wrong and has been removed: it computed dimmed navy over cream for text that was never
          being painted navy. `text-bty-navy/NN` also emits nothing, so those elements inherited —
          `--arena-text` (#2D2A36) on the legacy page, `text-white` from this shell — which is how
          the Founder found white prose on the cream surface after R4-R5A shipped. The full
          root-cause note and the four repaired call sites live in ArenaPracticePlayer.tsx.

          What remains true: this wrapper is layout-only, and R4-R5A changed nothing inside the
          player — no phase logic, no choice behaviour, no state machine, no shell theme. (R4-R5A-R1
          then changed four text COLOUR classes there, and nothing else.) The completion
          error/saving banners above stay OUTSIDE this surface: they are shell-owned, already
          white-on-navy, and already readable.
        */}
        <div className="btyFadeIn min-h-[60vh] rounded-2xl bg-bty-soft p-3" data-testid="practice-player-surface">
          <ArenaPracticePlayer
            scenario={view.practice.scenario}
            locale={loc}
            mode="play"
            sourceTrainingTitle={view.practice.source_training_title}
            onExit={() => void handleExit()}
            onComplete={handleComplete}
          />
        </div>
      </div>
    );
  }

  // view.kind === "list"
  if (listStatus === "loading") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-2 text-center">
        <span className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">{t.eyebrow}</span>
        <div className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-[#C9A66B]" />
        <p className="max-w-[18rem] text-[0.95rem] leading-6 text-white/60">{t.loading}</p>
      </div>
    );
  }
  if (listStatus === "error") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-2 text-center">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">{t.eyebrow}</span>
        <p className="max-w-[18rem] text-[0.95rem] leading-6 text-white/70">{t.error}</p>
        <button
          type="button"
          onClick={() => void loadList()}
          className="rounded-xl border border-white/20 px-6 py-2.5 text-sm font-semibold text-white/80 hover:text-white"
        >
          {t.retry}
        </button>
      </div>
    );
  }
  if (practices.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-2 text-center">
        <span className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">{lockedTag}</span>
        <p className="max-w-[18rem] text-[0.95rem] leading-6 text-white/60">{lockedBody}</p>
      </div>
    );
  }
  // Slice 3.1B-3N-5D.1B: Arena shares the app-shell surface contract. The list root fills the shared
  // shell scroll region (px-5) width like the sibling tabs (Center/Foundry) — no `mx-auto max-w-md px-1`
  // self-wrapper — and the cards use the canonical shell card scale (px-4 py-3, 0.95rem title, px-4
  // button) so moving Today into Arena reads at one consistent scale. Text is NOT shrunk below the shell
  // norm (0.95rem/text-sm match Center/Foundry) — and there is no CSS zoom / transform / scale hack.
  return (
    <div className="btyFadeIn flex w-full flex-col gap-3 pt-2">
      <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#C9A66B]/90">{t.eyebrow}</span>
      {practices.map((p) => (
        <div key={p.id} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-[0.95rem] font-semibold text-white/90">{p.practice_title}</p>
            {p.completed ? (
              <span className="shrink-0 text-[0.6rem] uppercase tracking-[0.12em] text-[#C9A66B]/80">{t.done}</span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-white/45">
            {t.from}: {p.source_training_title}
          </p>
          <button
            type="button"
            onClick={() => void handleStart(p.id)}
            className="mt-3 w-full rounded-xl bg-[#C9A66B] px-4 py-2.5 text-sm font-semibold text-[#0B1F3A]"
          >
            {p.completed ? t.again : t.start}
          </button>
        </div>
      ))}
    </div>
  );
}
