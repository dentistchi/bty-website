"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import TrainSidebar from "./TrainSidebar";
import CoachChatPane from "./CoachChatPane";

type Progress = {
  startDateISO: string;
  lastCompletedDay: number;
  lastCompletedAt: string | null;
};

export default function TrainShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [progress, setProgress] = useState<Progress | null>(null);
  const [pLoading, setPLoading] = useState(true);

  async function refreshProgress() {
    setPLoading(true);
    const r = await fetch("/api/train/progress", { credentials: "include" });
    const j = await r.json();
    if (j?.ok) setProgress({ startDateISO: j.startDateISO, lastCompletedDay: j.lastCompletedDay, lastCompletedAt: j.lastCompletedAt });
    setPLoading(false);
  }

  useEffect(() => {
    if (loading) return;
    if (!user) return; // 로그인 게이트는 바깥에서 처리해도 됨
    refreshProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id]);

  // 3열 그리드
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
    <div className="min-h-screen grid grid-cols-[280px_1fr_360px]">
      <aside className="border-r bg-white">
        <TrainSidebar
          userEmail={user.email ?? ""}
          progress={progress}
          onRefresh={refreshProgress}
        />
      </aside>

      <main className="bg-[#fafafa] overflow-auto">
        {children}
      </main>

      <aside className="border-l bg-white overflow-auto">
        <CoachChatPane progress={progress} />
      </aside>
    </div>
  );
}
