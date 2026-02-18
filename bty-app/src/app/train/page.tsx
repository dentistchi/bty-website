"use client";

import React from "react";
import {
  TrainSidebar,
  type TrainProgress,
  computeDayStates,
  getActionableDay,
  getDefaultSelectedDay,
} from "@/components/train/TrainSidebar";
import { cn } from "@/lib/utils";

type LoadState = "loading" | "ready" | "no-session" | "error";

async function fetchProgress(): Promise<{ ok: boolean; hasSession?: boolean; startDateISO?: string; completionsByDay?: Record<string, string> }> {
  const r = await fetch("/api/train/progress", { credentials: "include" });
  return r.json();
}

export default function TrainPage() {
  const [state, setState] = React.useState<LoadState>("loading");
  const [progress, setProgress] = React.useState<TrainProgress | null>(null);
  const [selectedDay, setSelectedDay] = React.useState(1);

  const [isCompleting, setIsCompleting] = React.useState(false);
  const [toast, setToast] = React.useState<string>("");

  // 1) progress 로드
  React.useEffect(() => {
    (async () => {
      try {
        const j = await fetchProgress();
        if (!j?.ok) {
          setState("error");
          return;
        }
        if (!j?.hasSession) {
          setState("no-session");
          return;
        }

        const p: TrainProgress = {
          startDateISO: j.startDateISO!,
          completionsByDay: j.completionsByDay ?? {},
        };

        setProgress(p);
        setSelectedDay(getDefaultSelectedDay(p));
        setState("ready");
      } catch {
        setState("error");
      }
    })();
  }, []);

  // 2) progress 바뀌면 selectedDay를 "자동 보정"
  // - 사용자가 클릭해서 다른 day 보고 있으면 그대로 두고 싶다면,
  //   아래 로직을 "초기 1회"로 제한하거나, "선택 day가 잠기면 보정"만 하도록 바꿀 수 있음.
  React.useEffect(() => {
    if (!progress) return;
    const states = computeDayStates(progress);
    const cur = states.find((s) => s.day === selectedDay);
    // 현재 선택이 "잠김"이면 기본 day로 되돌림
    if (cur && !cur.unlocked) {
      setSelectedDay(getDefaultSelectedDay(progress));
    }
  }, [progress, selectedDay]);

  const actionableDay = React.useMemo(() => {
    if (!progress) return null;
    return getActionableDay(progress);
  }, [progress]);

  const selectedState = React.useMemo(() => {
    if (!progress) return null;
    return computeDayStates(progress).find((s) => s.day === selectedDay) ?? null;
  }, [progress, selectedDay]);

  const canComplete =
    !!progress &&
    !!selectedState &&
    selectedState.unlocked &&
    !selectedState.completed &&
    actionableDay === selectedDay;

  async function completeToday() {
    if (!progress || !canComplete) return;

    setToast("");
    setIsCompleting(true);

    // optimistic update
    const optimisticISO = new Date().toISOString();
    const prev = progress;
    const next: TrainProgress = {
      ...prev,
      completionsByDay: { ...prev.completionsByDay, [String(selectedDay)]: optimisticISO },
    };
    setProgress(next);

    try {
      const r = await fetch("/api/train/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ day: selectedDay }),
      });
      const j = await r.json();

      if (!j?.ok) {
        // rollback
        setProgress(prev);
        setToast(j?.error ? `완료 실패: ${j.error}` : "완료 실패");
        return;
      }

      // 서버 재동기화 (권장)
      const fresh = await fetchProgress();
      if (fresh?.ok && fresh?.hasSession) {
        const p2: TrainProgress = {
          startDateISO: fresh.startDateISO!,
          completionsByDay: fresh.completionsByDay ?? {},
        };
        setProgress(p2);
        // 완료하면 다음 actionable로 자동 이동
        setSelectedDay(getDefaultSelectedDay(p2));
      }

      setToast("완료! 내일 아침에 다음 Day가 열려요.");
    } catch {
      setProgress(prev);
      setToast("완료 실패");
    } finally {
      setIsCompleting(false);
    }
  }

  if (state === "loading") return <div className="p-6">loading...</div>;

  if (state === "no-session") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-dojo-purple-muted bg-white p-6">
          <div className="text-lg font-semibold text-dojo-purple-dark">로그인이 필요합니다</div>
          <div className="mt-2 text-sm text-dojo-ink-soft">
            트레이닝은 로그인 후 이용할 수 있어요.
          </div>
        </div>
      </div>
    );
  }

  if (state === "error" || !progress) return <div className="p-6">error</div>;

  return (
    <div className="h-[calc(100vh-0px)] grid grid-cols-[320px_1fr_360px]">
      {/* 왼쪽: 목차 */}
      <TrainSidebar progress={progress} selectedDay={selectedDay} onSelectDay={setSelectedDay} />

      {/* 가운데: 레슨 */}
      <main className="p-6 overflow-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xl font-semibold text-dojo-purple-dark">Day {selectedDay}</div>
            <div className="mt-1 text-sm text-dojo-ink-soft">
              {selectedState?.completed
                ? "이미 완료한 Day입니다."
                : selectedState?.unlocked
                ? actionableDay === selectedDay
                  ? "오늘의 실천을 진행해요."
                  : "열려있지만 '하루 1실천' 규칙상 오늘은 이 Day를 완료할 수 없어요."
                : "아직 잠겨있어요."}
            </div>
          </div>

          <button
            type="button"
            onClick={completeToday}
            disabled={!canComplete || isCompleting}
            className={cn(
              "px-4 py-2 rounded-xl font-medium",
              canComplete && !isCompleting
                ? "bg-dojo-purple text-white hover:bg-dojo-purple-dark"
                : "bg-gray-200 text-gray-500 cursor-not-allowed"
            )}
          >
            {isCompleting ? "저장 중..." : "오늘 실천 완료"}
          </button>
        </div>

        {toast && (
          <div className="mt-4 text-sm rounded-xl border border-dojo-purple-muted bg-dojo-purple/5 p-3 text-dojo-purple-dark">
            {toast}
          </div>
        )}

        <div className="mt-6 space-y-4">
          <section className="rounded-2xl border border-dojo-purple-muted bg-white p-5">
            <div className="text-sm font-semibold text-dojo-purple-dark">레슨</div>
            <div className="mt-2 text-sm text-dojo-ink-soft leading-relaxed">
              (여기에 Day {selectedDay} 레슨 컨텐츠를 넣을 예정)
              <br />
              지금은 틀만 잡고, 나중에 마크다운/DB/컴포넌트로 교체하면 돼.
            </div>
          </section>

          <section className="rounded-2xl border border-dojo-purple-muted bg-white p-5">
            <div className="text-sm font-semibold text-dojo-purple-dark">오늘의 체크</div>
            <ul className="mt-2 text-sm text-dojo-ink-soft list-disc pl-5 space-y-1">
              <li>오늘의 한 가지 실천을 10분만 해보기</li>
              <li>끝나면 "완료"를 눌러 기록 남기기</li>
              <li>내일 아침 {5}시 이후 다음 Day 오픈</li>
            </ul>
          </section>
        </div>
      </main>

      {/* 오른쪽: 챗 */}
      <aside className="border-l border-dojo-purple-muted p-6 overflow-auto bg-white">
        <div className="text-lg font-semibold text-dojo-purple-dark">코치 챗</div>
        <div className="mt-2 text-sm text-dojo-ink-soft">
          (여기엔 나중에 챗 UI를 붙이고, Day {selectedDay} 컨텍스트를 주입할 거야)
        </div>

        <div className="mt-6 rounded-2xl border border-dojo-purple-muted bg-gray-50 p-4">
          <div className="text-sm font-medium text-dojo-purple-dark">프롬프트(예시)</div>
          <div className="mt-2 text-sm text-dojo-ink-soft whitespace-pre-wrap">
{`오늘은 Day ${selectedDay}야.
내가 지금 느끼는 감정/저항을 정리하도록 질문 3개만 해줘.
그리고 오늘 실천을 "10분 버전"으로 줄여서 제안해줘.`}
          </div>
        </div>
      </aside>
    </div>
  );
}
