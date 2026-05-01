"use client";

import * as React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { TrainProvider, type TrainProgress } from "@/contexts/TrainContext";
import { fetchJson } from "@/lib/read-json";
import { PageLoadingFallback } from "@/components/bty-arena";

async function getJson(url: string) {
  const r = await fetchJson<Record<string, unknown>>(url);
  return { ok: r.ok, json: r.ok ? r.json : null };
}

async function postJson(url: string, body: unknown) {
  const r = await fetchJson<Record<string, unknown>>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: r.ok, json: r.ok ? r.json : null };
}

function mapApiProgressToTrainProgress(json: Record<string, unknown>): TrainProgress {
  const lastCompletedDay = Number(json.lastCompletedDay ?? 0);
  const completedDays = Array.from({ length: lastCompletedDay }, (_, i) => i + 1);
  const todayUnlockedDay = Number(json.unlockedMaxDay ?? 1);
  return {
    ok: true,
    startDateISO: String(json.startDateISO ?? ""),
    lastCompletedDay,
    completedDays,
    todayUnlockedDay,
  };
}

export default function TrainShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  // 1) state는 항상 훅 상단에서 선언 (조건문 금지)
  const [progress, setProgress] = React.useState<TrainProgress | null>(null);
  const [pLoading, setPLoading] = React.useState(true);
  const [showCompletionSummary, setShowCompletionSummary] = React.useState(false);
  const [completionSummary, setCompletionSummary] = React.useState<{
    title: string;
    bullets: string[];
    questions: string[];
  } | null>(null);

  // 2) progress fetch (재사용)
  const refreshProgress = React.useCallback(async () => {
    setPLoading(true);
    try {
      const { ok, json } = await getJson("/api/train/progress");
      if (ok && json?.ok && json?.hasSession) {
        setProgress(mapApiProgressToTrainProgress(json as Record<string, unknown>));
      } else {
        setProgress(null);
      }
    } catch {
      setProgress(null);
    } finally {
      setPLoading(false);
    }
  }, []);

  // 3) 최초 로드: auth 준비되면 progress 가져오기
  React.useEffect(() => {
    if (loading) return;
    if (!user) {
      setProgress(null);
      setPLoading(false);
      return;
    }
    refreshProgress();
  }, [loading, user?.id, refreshProgress]);

  // 4) 오늘 완료 처리
  const markTodayComplete = React.useCallback(
    async (day: number) => {
      setShowCompletionSummary(true);

      const { ok, json } = await postJson("/api/train/complete", { day });
      if (!ok || !json?.ok) {
        await refreshProgress();
        return;
      }
      await refreshProgress();
    },
    [refreshProgress]
  );

  // 5) 완료 요약 — /api/train/completion-pack 호출
  const generateCompletionSummary = React.useCallback(
    ({ day }: { day: number; lessonText: string }) => {
      setCompletionSummary(null);
      getJson(`/api/train/completion-pack?day=${day}`)
        .then(({ ok, json }) => {
          if (ok && json?.pack) {
            const pack = json.pack as { summary?: string[]; questions?: string[]; day?: number };
            setCompletionSummary({
              title: `Day ${pack.day ?? day} — Completion Summary`,
              bullets: pack.summary ?? [],
              questions: pack.questions ?? [],
            });
          }
        })
        .catch(() => { /* optional — stay silent on failure */ });
    },
    []
  );

  // 6) Provider value는 항상 useMemo로 고정 (progress null이어도 OK)
  const ctxValue = React.useMemo(
    () => ({
      progress,
      pLoading,
      refreshProgress,
      markTodayComplete,
      completionSummary,
      showCompletionSummary,
      setShowCompletionSummary,
      generateCompletionSummary,
    }),
    [
      progress,
      pLoading,
      refreshProgress,
      markTodayComplete,
      completionSummary,
      showCompletionSummary,
      generateCompletionSummary,
    ]
  );

  // 7) 렌더 분기는 "훅 호출 이후"에만
  if (loading || pLoading) return <PageLoadingFallback />;
  if (!user) return <div style={{ padding: 24 }}>Login required.</div>;

  if (!progress) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Train progress not ready</div>
        <div style={{ opacity: 0.7, marginBottom: 16 }}>
          /api/train/progress 응답이 없거나(ok:false) 데이터가 비어있어요.
        </div>
        <button
          type="button"
          onClick={() => refreshProgress()}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return <TrainProvider value={ctxValue}>{children}</TrainProvider>;
}
