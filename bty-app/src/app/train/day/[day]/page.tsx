"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TrainSidebar, type TrainProgress } from "@/components/train/TrainSidebar";

type ProgressResp =
  | { ok: true; hasSession: false }
  | { ok: true; hasSession: true; userId: string; startDateISO: string; completedDays: number[]; completionsByDay: Record<string, string> }
  | { ok: false; error: string; detail?: string };

export default function TrainDayPage() {
  const params = useParams<{ day: string }>();
  const router = useRouter();
  const selectedDay = useMemo(() => {
    const n = Number(params.day);
    return Number.isFinite(n) ? n : 1;
  }, [params.day]);

  const [progress, setProgress] = useState<TrainProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/train/progress", { credentials: "include" });
        const data = (await res.json()) as ProgressResp;

        if (!mounted) return;

        if (data.ok && data.hasSession) {
          setProgress({
            startDateISO: data.startDateISO,
            completionsByDay: data.completionsByDay,
          });
        } else {
          setProgress(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  // 로그인 없으면 안내(원하면 / 로 보내도 됨)
  if (!loading && !progress) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-gray-600">로그인이 필요합니다.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid grid-cols-12">
      {/* 왼쪽 목차 */}
      <div className="col-span-12 md:col-span-3 border-r">
        {loading || !progress ? (
          <div className="p-4 text-sm text-gray-500">로딩 중…</div>
        ) : (
          <TrainSidebar
            progress={progress}
            selectedDay={selectedDay}
            onSelectDay={(day) => router.push(`/train/day/${day}`)}
          />
        )}
      </div>

      {/* 가운데 레슨 */}
      <main className="col-span-12 md:col-span-6 p-6">
        <h1 className="text-xl font-semibold">Day {selectedDay}</h1>
        <p className="mt-2 text-gray-600">여기에 레슨(나중에 마크다운/DB)</p>
      </main>

      {/* 오른쪽 챗 */}
      <aside className="col-span-12 md:col-span-3 border-l p-6">
        <div className="text-sm font-semibold">코치 챗</div>
        <div className="mt-3 rounded-xl border p-3 text-sm text-gray-600">(우선 UI만)</div>
      </aside>
    </div>
  );
}
