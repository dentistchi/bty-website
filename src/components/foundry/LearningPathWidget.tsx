"use client";

/**
 * Foundry learning path: GET `/api/bty/foundry/learning-path` ({@link getActiveLearningPathWithPrograms}),
 * Realtime `user_learning_paths`, POST path change. Header badge colors: Integrity / Resilience / Leadership / Empathy.
 */

import React from "react";
import type { LearningPathName } from "@/engine/foundry/learning-path.service";
import { LEARNING_PATH_MAP } from "@/engine/foundry/learning-path.service";
import { getSupabase } from "@/lib/supabase";
import type { Locale } from "@/lib/i18n";

const PATH_KEYS: LearningPathName[] = ["Integrity", "Resilience", "Leadership", "Empathy"];

/** Badge / selector colors — teal / amber / purple / coral */
const PATH_THEME: Record<
  LearningPathName,
  { badgeBg: string; badgeFg: string; softBg: string; border: string }
> = {
  Integrity: { badgeBg: "#0d9488", badgeFg: "#ffffff", softBg: "rgba(13, 148, 136, 0.12)", border: "#0d9488" },
  Resilience: { badgeBg: "#d97706", badgeFg: "#ffffff", softBg: "rgba(217, 119, 6, 0.12)", border: "#d97706" },
  Leadership: { badgeBg: "#7c3aed", badgeFg: "#ffffff", softBg: "rgba(124, 58, 237, 0.12)", border: "#7c3aed" },
  Empathy: { badgeBg: "#e9967a", badgeFg: "#1e293b", softBg: "rgba(233, 150, 122, 0.2)", border: "#e9967a" },
};

const CURRENT_BORDER = "#14b8a6";

type ApiOk = {
  ok: true;
  path_name: LearningPathName;
  programs_ordered: string[];
  current_index: number;
  completion_pct: number;
  programs: { program_id: string; title: string; completion_pct: number }[];
};

function pathLabel(name: LearningPathName, loc: "ko" | "en"): string {
  if (loc === "ko") {
    switch (name) {
      case "Integrity":
        return "무결성";
      case "Resilience":
        return "회복탄력";
      case "Leadership":
        return "리더십";
      case "Empathy":
        return "공감";
      default:
        return name;
    }
  }
  return name;
}

export type LearningPathWidgetProps = {
  /** Must match the signed-in user (Realtime + API). */
  userId: string;
  locale?: Locale | string;
  className?: string;
  /** Show four path cards (Integrity / Resilience / Leadership / Empathy) inline; POST on tap. */
  inlineFourPathPicker?: boolean;
};

const STYLE_ID = "learning-path-widget-keyframes";

export function LearningPathWidget({
  userId,
  locale = "en",
  className,
  inlineFourPathPicker = false,
}: LearningPathWidgetProps) {
  const loc = locale === "ko" ? "ko" : "en";
  const [data, setData] = React.useState<ApiOk | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [selectedPath, setSelectedPath] = React.useState<LearningPathName | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [advanceFlashIndex, setAdvanceFlashIndex] = React.useState<number | null>(null);
  const prevIndexRef = React.useRef<number | null>(null);

  const load = React.useCallback(async () => {
    if (!userId.trim()) {
      setError(loc === "ko" ? "사용자 없음" : "Missing user");
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const res = await fetch("/api/bty/foundry/learning-path", {
        credentials: "include",
      });
      const json = (await res.json()) as ApiOk | { ok: false; error?: string };
      if (!res.ok || !("ok" in json) || json.ok !== true) {
        throw new Error((json as { error?: string }).error ?? "LOAD_FAILED");
      }
      setData(json);
    } catch {
      setError(loc === "ko" ? "경로를 불러오지 못했습니다." : "Failed to load learning path.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId, loc]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (data) {
      prevIndexRef.current = data.current_index;
    }
  }, [data?.current_index, data]);

  React.useEffect(() => {
    const uid = userId.trim();
    if (!uid) return;

    let client: ReturnType<typeof getSupabase> | null = null;
    try {
      client = getSupabase();
    } catch {
      return;
    }

    const channel = client
      .channel(`user_learning_paths:${uid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_learning_paths",
          filter: `user_id=eq.${uid}`,
        },
        (payload: { eventType?: string; new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
          const prevRaw = payload.old?.current_index;
          const nextRaw = payload.new?.current_index;
          const prev = typeof prevRaw === "number" ? prevRaw : prevIndexRef.current;
          const next = typeof nextRaw === "number" ? nextRaw : null;
          if (next != null && prev != null && next > prev) {
            setAdvanceFlashIndex(next);
            window.setTimeout(() => setAdvanceFlashIndex(null), 900);
          }
          void load();
        },
      )
      .subscribe();

    return () => {
      client?.removeChannel(channel);
    };
  }, [userId, load]);

  const savePathName = React.useCallback(
    async (pathName: LearningPathName) => {
      setSaving(true);
      setSaveError(null);
      try {
        const res = await fetch("/api/bty/foundry/learning-path", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pathName }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) throw new Error(json.error ?? "SAVE_FAILED");
        setModalOpen(false);
        setSelectedPath(null);
        await load();
      } catch {
        setSaveError(loc === "ko" ? "경로 저장에 실패했습니다." : "Failed to save path.");
      } finally {
        setSaving(false);
      }
    },
    [load, loc],
  );

  const confirmPathChange = React.useCallback(async () => {
    if (!selectedPath) return;
    await savePathName(selectedPath);
  }, [selectedPath, savePathName]);

  if (loading && !data) {
    return (
      <div className={className} role="status" aria-busy="true">
        <p className="m-0 text-sm text-slate-500">{loc === "ko" ? "불러오는 중…" : "Loading…"}</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={className} role="alert">
        <p className="m-0 text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const theme = PATH_THEME[data.path_name];
  const pctRounded = Math.min(100, Math.max(0, Math.round(data.completion_pct)));

  return (
    <div
      className={`relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className ?? ""}`}
    >
      {inlineFourPathPicker ? (
        <>
          <div className="mb-2 grid grid-cols-2 gap-2">
            {PATH_KEYS.map((name) => {
              const th = PATH_THEME[name];
              const active = data.path_name === name;
              return (
                <button
                  key={name}
                  type="button"
                  disabled={saving}
                  className="rounded-xl border-2 px-3 py-3 text-left text-sm font-semibold transition-colors disabled:opacity-50"
                  style={{
                    borderColor: active ? th.border : "#e2e8f0",
                    background: active ? th.softBg : "transparent",
                    color: "#0f172a",
                  }}
                  onClick={() => void savePathName(name)}
                >
                  <span className="block text-xs font-bold" style={{ color: th.border }}>
                    {pathLabel(name, loc)}
                  </span>
                  <span className="mt-1 block text-[10px] font-normal text-slate-500">
                    {LEARNING_PATH_MAP[name].length}{" "}
                    {loc === "ko" ? "개 프로그램" : "programs"}
                  </span>
                </button>
              );
            })}
          </div>
          {saveError ? <p className="mb-3 m-0 text-xs text-red-600">{saveError}</p> : null}
        </>
      ) : null}
      <style id={STYLE_ID}>{`
        @keyframes pathAdvanceFlash {
          0% { background: rgba(20, 184, 166, 0.25); }
          100% { background: transparent; }
        }
        .lpw-row-advance {
          animation: pathAdvanceFlash 0.85s ease-out;
        }
      `}</style>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex rounded-full px-3 py-1 text-xs font-bold"
            style={{ background: theme.badgeBg, color: theme.badgeFg }}
          >
            {pathLabel(data.path_name, loc)}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {loc === "ko" ? "학습 경로" : "Learning path"}
          </span>
        </div>
        {!inlineFourPathPicker ? (
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            onClick={() => {
              setSaveError(null);
              setSelectedPath(data.path_name);
              setModalOpen(true);
            }}
          >
            {loc === "ko" ? "경로 변경" : "Change path"}
          </button>
        ) : null}
      </div>

      <div className="mb-3">
        <div className="mb-1 flex justify-between text-[11px] text-slate-500">
          <span>{loc === "ko" ? "전체 진행률" : "Overall progress"}</span>
          <span className="tabular-nums font-medium text-slate-700 dark:text-slate-200">{pctRounded}%</span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
          role="progressbar"
          aria-valuenow={pctRounded}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-teal-500 transition-[width] duration-500"
            style={{ width: `${pctRounded}%` }}
          />
        </div>
      </div>

      <ol className="m-0 list-none space-y-0 p-0">
        {data.programs.map((p, index) => {
          const done = p.completion_pct >= 100;
          const current = index === data.current_index;
          const flash = advanceFlashIndex === index;
          return (
            <li
              key={p.program_id}
              className={`flex items-start gap-2 border-b border-slate-100 py-2.5 last:border-b-0 dark:border-slate-800 ${flash ? "lpw-row-advance" : ""}`}
              style={{
                borderLeftWidth: current ? 4 : 0,
                borderLeftStyle: current ? "solid" : undefined,
                borderLeftColor: current ? CURRENT_BORDER : undefined,
                paddingLeft: current ? 10 : 12,
              }}
            >
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold"
                style={{
                  borderColor: done ? theme.border : "#cbd5e1",
                  background: done ? theme.softBg : "transparent",
                  color: done ? theme.border : "#94a3b8",
                }}
                aria-label={done ? (loc === "ko" ? "완료" : "Done") : loc === "ko" ? "미완료" : "Not done"}
              >
                {done ? "✓" : ""}
              </span>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-sm font-medium leading-snug text-slate-800 dark:text-slate-100">{p.title}</p>
                <p className="m-0 mt-0.5 text-[10px] text-slate-400">{p.program_id}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lpw-modal-title"
          onClick={() => {
            setModalOpen(false);
            setSelectedPath(null);
            setSaveError(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="lpw-modal-title" className="m-0 text-base font-semibold text-slate-900 dark:text-slate-100">
              {loc === "ko" ? "학습 경로 선택" : "Choose learning path"}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {loc === "ko"
                ? "경로를 바꾸면 현재 진행 위치가 처음으로 초기화됩니다."
                : "Changing path resets your position to the start."}
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PATH_KEYS.map((name) => {
                const th = PATH_THEME[name];
                const active = selectedPath === name;
                return (
                  <button
                    key={name}
                    type="button"
                    className="rounded-xl border-2 px-3 py-3 text-left text-sm font-semibold transition-colors"
                    style={{
                      borderColor: active ? th.border : "#e2e8f0",
                      background: active ? th.softBg : "transparent",
                      color: "#0f172a",
                    }}
                    onClick={() => setSelectedPath(name)}
                  >
                    <span className="block text-xs font-bold" style={{ color: th.border }}>
                      {pathLabel(name, loc)}
                    </span>
                    <span className="mt-1 block text-[10px] font-normal text-slate-500">
                      {LEARNING_PATH_MAP[name].length}{" "}
                      {loc === "ko" ? "개 프로그램" : "programs"}
                    </span>
                  </button>
                );
              })}
            </div>
            {saveError ? <p className="mt-3 m-0 text-xs text-red-600">{saveError}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={() => {
                  setModalOpen(false);
                  setSelectedPath(null);
                  setSaveError(null);
                }}
              >
                {loc === "ko" ? "취소" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={!selectedPath || saving}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => void confirmPathChange()}
              >
                {saving ? (loc === "ko" ? "저장 중…" : "Saving…") : loc === "ko" ? "확인" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default LearningPathWidget;
