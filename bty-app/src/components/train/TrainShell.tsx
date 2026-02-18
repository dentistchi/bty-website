"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { TrainLayoutProvider } from "@/contexts/TrainLayoutContext";
import TrainSidebar from "./TrainSidebar";
import CoachChatPane from "./CoachChatPane";

type Progress = {
  startDateISO: string;
  lastCompletedDay: number;
  lastCompletedAt: string | null;
};

export default function TrainShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  const [progress, setProgress] = useState<Progress | null>(null);
  const [pLoading, setPLoading] = useState(true);
  const [showCompletionSummary, setShowCompletionSummary] = useState(false);

  const refreshProgress = useCallback(async () => {
    setPLoading(true);
    const r = await fetch("/api/train/progress", { credentials: "include" });
    const j = await r.json();
    if (j?.ok)
      setProgress({
        startDateISO: j.startDateISO,
        lastCompletedDay: j.lastCompletedDay,
        lastCompletedAt: j.lastCompletedAt,
      });
    setPLoading(false);
  }, []);

  const onMarkCompleteSuccess = useCallback(() => {
    setShowCompletionSummary(true);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    refreshProgress();
  }, [loading, user?.id, refreshProgress]);

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
          <CoachChatPane
            progress={progress}
            showCompletionSummary={showCompletionSummary}
            onViewedCompletionSummary={() => setShowCompletionSummary(false)}
          />
        </aside>
      </div>
    </TrainLayoutProvider>
  );
}
