"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { TrainLayoutProvider } from "@/contexts/TrainLayoutContext";
import { useTrainUI } from "@/contexts/TrainUIContext";
import { safeJson } from "@/lib/utils";
import TrainSidebar from "./TrainSidebar";
import { RightPanel } from "./RightPanel";

type Progress = {
  startDateISO: string;
  lastCompletedDay: number;
  lastCompletedAt: string | null;
};

export default function TrainShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { openCompletionPanel, setPackLoading } = useTrainUI();

  const [progress, setProgress] = useState<Progress | null>(null);
  const [pLoading, setPLoading] = useState(true);
  const [showCompletionSummary, setShowCompletionSummary] = useState(false);

  const refreshProgress = useCallback(async () => {
    setPLoading(true);
    try {
      const j = await safeJson("/api/train/progress");
      if (j?.ok) {
        setProgress({
          startDateISO: j.startDateISO,
          lastCompletedDay: j.lastCompletedDay,
          lastCompletedAt: j.lastCompletedAt,
        });
      } else {
        // API가 ok:false를 반환해도 로딩은 해제
        setProgress(null);
      }
    } catch (e) {
      // 네트워크 에러 등
      setProgress(null);
    } finally {
      // ✅ 무조건 로딩 해제
      setPLoading(false);
    }
  }, []);

  const generatePackForDay = useCallback(
    async (day: number) => {
      setPackLoading(true);
      try {
        const r = await fetch(`/api/train/completion-pack?day=${day}`, { credentials: "include" });
        const j = await r.json();
        if ((j?.ok === true || j?.ok?.toString() === "true") && j.pack) {
          const pack = j.pack;
          openCompletionPanel({
            day: pack.day ?? day,
            title: "",
            summary: pack.summary ?? [],
            questions: pack.questions ?? [],
          });
        }
      } finally {
        setPackLoading(false);
      }
    },
    [openCompletionPanel, setPackLoading]
  );

  const onCompleteToday = useCallback(async (day: number) => {
    // 1) 완료 기록
    const r = await fetch("/api/train/complete", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day }),
    });
    const j = await r.json();
    if (!j?.ok) return;

    // 2) progress 갱신
    await refreshProgress();

    // 3) completion pack 생성(현재 day 기준)
    await generatePackForDay(day);
  }, [refreshProgress, generatePackForDay]);

  const onMarkCompleteSuccess = useCallback(() => {
    setShowCompletionSummary(true);
  }, []);

  useEffect(() => {
    console.log("[Train] effect fired", { loading, hasUser: !!user, uid: user?.id });
    if (loading) return;
    if (!user) return;

    let alive = true;

    (async () => {
      try {
        const j = await safeJson("/api/train/progress");
        if (!alive) return;

        if (!j?.ok) {
          setProgress(null);
          setPLoading(false);
          return;
        }

        setProgress({
          startDateISO: j.startDateISO,
          lastCompletedDay: j.lastCompletedDay,
          lastCompletedAt: j.lastCompletedAt,
        });
      } catch (e) {
        if (!alive) return;
        setProgress(null);
      } finally {
        if (!alive) return;
        // ✅ 무조건 로딩 해제
        setPLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [loading, user?.id]);

  if (loading || pLoading) {
    return <div className="min-h-screen p-6">loading...</div>;
  }

  if (!user) {
    return <div className="min-h-screen p-6">로그인이 필요합니다.</div>;
  }

  if (!progress) {
    return <div className="min-h-screen p-6">progress not ready</div>;
  }

  return (
    <TrainLayoutProvider
      progress={progress}
      refreshProgress={refreshProgress}
      onMarkCompleteSuccess={onMarkCompleteSuccess}
    >
      <div className="min-h-screen grid grid-cols-[280px_1fr_360px]">
        <aside className="border-r bg-white">
          <TrainSidebar
            userEmail={user.email ?? ""}
            progress={progress}
            onRefresh={refreshProgress}
            onMarkCompleteSuccess={onMarkCompleteSuccess}
          />
        </aside>

        <main className="bg-[#fafafa] overflow-auto">{children}</main>

        <aside className="border-l bg-white overflow-auto">
          <RightPanel />
        </aside>
      </div>
    </TrainLayoutProvider>
  );
}
