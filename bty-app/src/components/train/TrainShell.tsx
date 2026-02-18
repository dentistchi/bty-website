"use client";

import * as React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { TrainProvider, type TrainProgress } from "@/contexts/TrainContext";

async function getJson(url: string) {
  const r = await fetch(url, { credentials: "include" });
  const j = await r.json().catch(() => null);
  return { ok: r.ok, json: j };
}

async function postJson(url: string, body: unknown) {
  const r = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => null);
  return { ok: r.ok, json: j };
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

  // 5) 완료 요약(지금은 더미 → 나중에 LLM)
  const generateCompletionSummary = React.useCallback(
    ({ day, lessonText }: { day: number; lessonText: string }) => {
      const excerpt = lessonText?.slice(0, 180).trim();
      setCompletionSummary({
        title: `Day ${day} — Completion Summary`,
        bullets: [
          "You showed up today. That's the win.",
          excerpt ? `Key theme: ${excerpt}${excerpt.length >= 180 ? "…" : ""}` : "Key theme captured from today's lesson.",
          "Keep it small. Repeat tomorrow.",
        ],
        questions: [
          "What was the smallest moment you noticed the old pattern today?",
          "If a friend had the same day, what would you say to them (1 sentence)?",
          "What's one 5-minute action you can repeat tomorrow morning?",
        ],
      });
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
  if (loading || pLoading) return <div style={{ padding: 24 }}>loading...</div>;
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
