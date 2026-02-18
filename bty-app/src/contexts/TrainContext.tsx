"use client";

import * as React from "react";

export type TrainProgress = {
  ok: true;
  startDateISO: string;              // "YYYY-MM-DD"
  lastCompletedDay: number;          // 0..28
  completedDays: number[];           // [1,2,3...]
  todayUnlockedDay: number;          // 오늘 접근 가능한 day (규칙 반영)
};

type TrainCtxValue = {
  progress: TrainProgress | null;
  pLoading: boolean;
  refreshProgress: () => Promise<void>;
  markTodayComplete: (day: number) => Promise<void>;

  // 완료 요약 UI (지금은 더미, 나중에 LLM)
  completionSummary: { title: string; bullets: string[]; questions: string[] } | null;
  showCompletionSummary: boolean;
  setShowCompletionSummary: (v: boolean) => void;
  generateCompletionSummary: (args: { day: number; lessonText: string }) => void;
};

const TrainContext = React.createContext<TrainCtxValue | null>(null);

export function useTrain() {
  const v = React.useContext(TrainContext);
  if (!v) throw new Error("useTrain must be used within TrainProvider");
  return v;
}

export function TrainProvider({
  value,
  children,
}: {
  value: TrainCtxValue;
  children: React.ReactNode;
}) {
  return <TrainContext.Provider value={value}>{children}</TrainContext.Provider>;
}
